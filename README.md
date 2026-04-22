# SuperMover

Pack, label, and track every box of your move. Part of the Neutheria superset.

- **Frontend**: React + Vite (Cloudflare Pages)
- **API**: Hono worker on Cloudflare Workers
- **Storage**: Cloudflare D1 (per-user, isolated by Kinde `sub`)
- **Auth**: Kinde

## Local development

```bash
# Frontend (http://localhost:5173)
npm install
npm run dev

# Worker API (http://localhost:8787)
cd worker && npm install && npm run dev
```

See `DEPLOYMENT.md` for the full Cloudflare + Kinde deployment walkthrough.
