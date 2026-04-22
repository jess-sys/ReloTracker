# SuperMover Deployment Guide

Pack, label, and track every box of your move. Mirrors the SuperPortal deployment
model: Vite static build on Cloudflare Pages, Hono worker on Cloudflare Workers,
Cloudflare D1 for storage, Kinde for auth.

- **Frontend**: `https://supermover.neutheria.ch`
- **Worker API**: `https://api.supermover.neutheria.ch`

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm i -g wrangler`)
- A [Cloudflare](https://dash.cloudflare.com/) account
- A [Kinde](https://kinde.com/) account

---

## 1. Kinde Setup

1. Create a new application in the Kinde dashboard — choose **Single Page App** type.
2. In the app settings, configure:
   - **Application homepage URI**: `https://supermover.neutheria.ch`
   - **Application login URI**: `https://supermover.neutheria.ch`
   - **Allowed callback URLs** (one per line):
     ```
     http://localhost:5173
     https://supermover.neutheria.ch
     ```
   - **Allowed logout redirect URLs** (one per line):
     ```
     http://localhost:5173
     https://supermover.neutheria.ch
     ```
3. Go to **Settings → APIs** and register a new API:
   - **Name**: `SuperMover API`
   - **Audience**: `https://api.supermover.neutheria.ch` (must match `VITE_KINDE_AUDIENCE`)
4. Note down:
   - **Domain** (e.g. `https://auth.neutheria.ch`)
   - **Client ID**
   - **API Audience**

---

## 2. Cloudflare D1 Database

```bash
cd worker

# Authenticate with Cloudflare (if not already)
wrangler login

# Create the D1 database
wrangler d1 create supermover
```

This outputs a `database_id`. Paste it into `worker/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "supermover"
database_id = "<paste-your-database-id-here>"
```

Apply the schema to both local and remote databases:

```bash
# Local (for development)
npm run db:init:local

# Remote (for production)
npm run db:init:remote
```

The schema creates a single `boxes` table keyed by `(user_id, box_id)`, so every
user has their own isolated box set.

---

## 3. Configure Secrets

### Frontend (`/.env.local`)

Create a `.env.local` file in the project root:

```env
VITE_API_URL=http://localhost:8787
VITE_KINDE_DOMAIN=https://auth.neutheria.ch
VITE_KINDE_CLIENT_ID=your_kinde_client_id
VITE_KINDE_REDIRECT_URI=http://localhost:5173
VITE_KINDE_LOGOUT_REDIRECT_URI=http://localhost:5173
VITE_KINDE_AUDIENCE=https://api.supermover.neutheria.ch
```

### Worker (`worker/.dev.vars`)

`worker/.dev.vars` is pre-populated:

```env
KINDE_DOMAIN=https://auth.neutheria.ch
KINDE_AUDIENCE=https://api.supermover.neutheria.ch
CORS_ORIGIN=http://localhost:5173
```

### Worker production vars (`worker/wrangler.toml`)

The `[vars]` section is already set for production:

```toml
[vars]
KINDE_DOMAIN = "https://auth.neutheria.ch"
KINDE_AUDIENCE = "https://api.supermover.neutheria.ch"
CORS_ORIGIN = "https://supermover.neutheria.ch"
```

### Build script (`build.sh`)

Open `build.sh` and replace `__REPLACE_WITH_SUPERMOVER_CLIENT_ID__` with the
Kinde Client ID you created in step 1.

---

## 4. Local Development

Install dependencies:

```bash
# Frontend
npm install

# Worker
cd worker && npm install
```

Run both in separate terminals:

```bash
# Terminal 1 — Frontend (http://localhost:5173)
npm run dev

# Terminal 2 — API Worker (http://localhost:8787)
cd worker && npm run dev
```

The worker uses local D1 (SQLite under the hood) in dev mode automatically.

---

## 5. Deploy the API Worker

```bash
cd worker
npm run deploy
```

### Custom domain setup

After deploying, configure the custom domain `api.supermover.neutheria.ch`:

1. Go to **Cloudflare dashboard → Workers & Pages → supermover-api → Settings → Domains & Routes**
2. Click **Add → Custom Domain**
3. Enter `api.supermover.neutheria.ch`
4. Cloudflare will automatically configure the DNS record if the zone is on your account

---

## 6. Deploy the Frontend to Cloudflare Pages

### Option A: Connect Git repository (recommended)

1. Go to **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**
2. Select your repository
3. Configure the build:
   - **Build command**: `npm install && npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `supermover` (if deploying from the superset monorepo)
4. Add environment variables in the Pages settings:
   ```
   VITE_API_URL=https://api.supermover.neutheria.ch
   VITE_KINDE_DOMAIN=https://auth.neutheria.ch
   VITE_KINDE_CLIENT_ID=your_kinde_client_id
   VITE_KINDE_REDIRECT_URI=https://supermover.neutheria.ch
   VITE_KINDE_LOGOUT_REDIRECT_URI=https://supermover.neutheria.ch
   VITE_KINDE_AUDIENCE=https://api.supermover.neutheria.ch
   ```
5. Deploy, then configure the custom domain `supermover.neutheria.ch` in the Pages dashboard.

### Option B: Direct upload

```bash
# Build locally with production env vars (uses build.sh)
npm run build:prod

# Upload the static output
npm run deploy
# or: wrangler pages deploy dist --project-name=supermover
```

---

## Post-deployment checklist

- [ ] Kinde API is registered with audience `https://api.supermover.neutheria.ch`
- [ ] `VITE_KINDE_AUDIENCE` is set in both local and production environments
- [ ] Kinde callback URLs include `https://supermover.neutheria.ch`
- [ ] D1 remote schema is applied (`npm run db:init:remote`)
- [ ] Worker `wrangler.toml` has correct `CORS_ORIGIN` and `KINDE_DOMAIN`
- [ ] Pages environment variables are set with production API URL and Kinde values
- [ ] Custom domain `supermover.neutheria.ch` is configured on the Pages project
- [ ] Custom domain `api.supermover.neutheria.ch` is active on the Worker

---

## API reference

All endpoints require an `Authorization: Bearer <kinde-access-token>` header,
and the server scopes every query to the `sub` of the verified JWT — so data is
always isolated per user.

| Method | Path                  | Body                                   | Description                                                    |
|--------|-----------------------|----------------------------------------|----------------------------------------------------------------|
| GET    | `/boxes`              | —                                      | List the current user's boxes                                  |
| POST   | `/boxes`              | `{ id, category, items, isFragile }`   | Upsert a single box (by `id`)                                  |
| POST   | `/boxes/sync`         | `{ boxes: [...] }`                     | Replace all of the current user's boxes with the submitted set |
| DELETE | `/boxes?id=<id>`      | —                                      | Delete a box                                                   |

The **Save** button in the UI calls `/boxes/sync` with the full local-storage
snapshot, which guarantees that what you see in the app is exactly what ends up
in D1.
