# Sandeep Opportunity OS — Deployment & Operations Guide (`docs/DEPLOYMENT.md`)

## 1. Deploying Code to Hostinger via GitHub (`SandeepProjects`)

1. Create a private or public repository under `https://github.com/SandeepProjects/sandeep-opportunity-os`.
2. Push this repository (`git init && git add . && git commit -m "feat: initial Sandeep Opportunity OS release" && git push`).
3. Deploy the full-stack application to Cloudflare Workers with `npm run deploy`.
4. Set the Worker secrets documented in `.env.example`. Keep `VITE_API_BASE_URL` blank because the frontend and API share a domain.

## 2. How Live Data Updates Work Without Git Commits

- Daily scheduled workers update **Cloudflare D1 / Google Sheets** through the authenticated agent API.
- The frontend reads live data from the same-origin Worker API, so secrets never appear in JavaScript or browser storage.

## Cloudflare D1 setup

1. Create the D1 database named `sandeep-opportunity-os`.
2. Put its database ID in `wrangler.jsonc`.
3. Run `npm run db:remote:setup` once.
4. Set strong, independent `APP_SESSION_SECRET`, `APP_ADMIN_PASSWORD`, and `AGENT_API_TOKEN` Worker secrets.
5. Deploy and verify `/api/health` before enabling agents.
