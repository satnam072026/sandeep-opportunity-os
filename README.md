# Sandeep Opportunity OS

Private **Opportunity Intelligence System & Personal Operating System** for **Sandeep Gautam** ([sandeep-gautam.com](https://www.sandeep-gautam.com/)).

Continuously discovers, verifies, deduplicates, scores, and tracks high-value opportunities across four pipelines:
1. **Freelance Client Leads** (Cyprus & UK SMEs with deterministic website improvement opportunities)
2. **Full-Time Jobs With Visa / Relocation Potential** (0–3 yr Frontend, React, TypeScript, Angular, WordPress roles)
3. **Master's Programmes & Scholarships** (Official EU/UK/Cyprus postgraduate programmes and merit/alumni scholarships)
4. **Remote Jobs & Internships** (Remote roles with strict regional & timezone eligibility gating)

## Repository Structure

- `docs/` — Complete system documentation (`ARCHITECTURE.md`, `DATA_MODEL.md`, `RESEARCH_PIPELINE.md`, `SCORING.md`, `SHEETS_SYNC.md`, `SECURITY.md`, `DEPLOYMENT.md`)
- `cloudflare/migrations/0001_schema.sql` — Cloudflare D1 schema, including multi-agent job leasing
- `worker/` — same-origin Cloudflare Worker API; secrets never enter the browser bundle
- `src/types/opportunity.ts` — Strict TypeScript domain models
- `src/engine/scoring.ts` — Explainable multi-component scoring & gate engine
- `src/engine/deduplication.ts` — Canonical URL & fingerprint deduplicator
- `src/engine/sheetsSync.ts` — Idempotent Google Sheets v4 synchronization engine
- `tests/opportunity_os.test.mjs` — Zero-dependency Node.js automated test suite

## Quick Verification

```bash
node tests/opportunity_os.test.mjs
```

## Cloudflare deployment

The application targets **Cloudflare D1 + Workers**. Supabase, Neon, and Alibaba database clients have been removed.

Live deployment: `https://sandeep-opportunity-os.sandeep-os.workers.dev`

1. Create a D1 database and copy its ID into `wrangler.jsonc`.
2. Run `npm run db:remote:setup` to apply the schema and verified seed.
3. Add the three Worker secrets documented in `.env.example`.
4. Run `npm run deploy`.

Do not prefix database credentials, administrator passwords, or agent tokens with `VITE_`; Vite variables are public.

For a zero-cost end-to-end localhost test, run `npm run start:local` and open the URL printed by Wrangler. It uses an isolated local D1 database seeded with the verified dataset.
