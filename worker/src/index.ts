import { Hono } from "hono";
import { cors } from "hono/cors";
import { createRemoteJWKSet, jwtVerify } from "jose";

type Bindings = {
  DB: D1Database;
  KINDE_DOMAIN: string;
  KINDE_AUDIENCE: string;
  CORS_ORIGIN: string;
};

type Variables = {
  userId: string;
};

type BoxInput = {
  id: number;
  category: string;
  items: string[];
  isFragile: boolean;
  createdAt?: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS (allow local dev + configured origin)
app.use("*", async (c, next) => {
  const handler = cors({
    origin: (origin) => {
      if (!origin) return c.env.CORS_ORIGIN;
      if (origin === c.env.CORS_ORIGIN) return origin;
      if (/^http:\/\/localhost:\d+$/.test(origin)) return origin;
      return c.env.CORS_ORIGIN;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  });
  return handler(c, next);
});

// Auth middleware — verify Kinde JWT
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();

  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = auth.slice(7);
  const domain = c.env.KINDE_DOMAIN;

  try {
    const JWKS = createRemoteJWKSet(
      new URL(`${domain}/.well-known/jwks.json`)
    );
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: [domain, `${domain}/`],
      audience: c.env.KINDE_AUDIENCE || undefined,
    });

    if (!payload.sub) {
      return c.json({ error: "Invalid token: missing sub" }, 401);
    }

    c.set("userId", payload.sub);
    await next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: "Invalid token", detail: message }, 401);
  }
});

// ─── Boxes ─────────────────────────────────────────────

function rowToBox(row: {
  box_id: number;
  category: string;
  items: string;
  is_fragile: number;
  created_at: string;
}): BoxInput {
  let items: string[] = [];
  try {
    const parsed = JSON.parse(row.items);
    if (Array.isArray(parsed)) items = parsed.map(String);
  } catch {
    items = [];
  }
  return {
    id: row.box_id,
    category: row.category,
    items,
    isFragile: Boolean(row.is_fragile),
    createdAt: row.created_at,
  };
}

function validateBox(b: unknown): b is BoxInput {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  if (typeof o.id !== "number" || !Number.isFinite(o.id)) return false;
  if (typeof o.category !== "string") return false;
  if (!Array.isArray(o.items)) return false;
  if (o.items.some((i) => typeof i !== "string")) return false;
  if (typeof o.isFragile !== "boolean") return false;
  return true;
}

// List all boxes for the current user
app.get("/boxes", async (c) => {
  const userId = c.get("userId");
  const { results } = await c.env.DB.prepare(
    "SELECT box_id, category, items, is_fragile, created_at FROM boxes WHERE user_id = ? ORDER BY box_id ASC"
  )
    .bind(userId)
    .all<{
      box_id: number;
      category: string;
      items: string;
      is_fragile: number;
      created_at: string;
    }>();
  return c.json(results.map(rowToBox));
});

// Full sync: replace all boxes for user with the submitted set
app.post("/boxes/sync", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ boxes: unknown }>();
  if (!Array.isArray(body.boxes)) {
    return c.json({ error: "boxes must be an array" }, 400);
  }

  const boxes: BoxInput[] = [];
  for (const raw of body.boxes) {
    if (!validateBox(raw)) {
      return c.json({ error: "invalid box in payload" }, 400);
    }
    boxes.push(raw);
  }

  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare("DELETE FROM boxes WHERE user_id = ?").bind(userId),
  ];

  for (const box of boxes) {
    stmts.push(
      c.env.DB.prepare(
        "INSERT INTO boxes (user_id, box_id, category, items, is_fragile, created_at) VALUES (?, ?, ?, ?, ?, COALESCE(?, date('now')))"
      ).bind(
        userId,
        box.id,
        box.category,
        JSON.stringify(box.items),
        box.isFragile ? 1 : 0,
        box.createdAt ?? null
      )
    );
  }

  await c.env.DB.batch(stmts);
  return c.json({ ok: true, count: boxes.length });
});

// Create / update a single box (upsert by box_id within user scope)
app.post("/boxes", async (c) => {
  const userId = c.get("userId");
  const raw = await c.req.json<unknown>();
  if (!validateBox(raw)) return c.json({ error: "invalid box" }, 400);

  await c.env.DB.prepare(
    `INSERT INTO boxes (user_id, box_id, category, items, is_fragile, created_at)
     VALUES (?, ?, ?, ?, ?, COALESCE(?, date('now')))
     ON CONFLICT(user_id, box_id) DO UPDATE SET
       category = excluded.category,
       items = excluded.items,
       is_fragile = excluded.is_fragile,
       updated_at = datetime('now')`
  )
    .bind(
      userId,
      raw.id,
      raw.category,
      JSON.stringify(raw.items),
      raw.isFragile ? 1 : 0,
      raw.createdAt ?? null
    )
    .run();

  return c.json({ ok: true });
});

// Delete a box by id
app.delete("/boxes", async (c) => {
  const userId = c.get("userId");
  const id = c.req.query("id");
  if (!id) return c.json({ error: "id required" }, 400);
  await c.env.DB.prepare(
    "DELETE FROM boxes WHERE user_id = ? AND box_id = ?"
  )
    .bind(userId, Number(id))
    .run();
  return c.json({ ok: true });
});

export default app;
