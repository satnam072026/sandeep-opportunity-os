import { mkdir, readFile, writeFile } from "node:fs/promises";

const seed = JSON.parse(await readFile(new URL("../src/data/verified_seed_24.json", import.meta.url), "utf8"));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const statements = [
  "BEGIN TRANSACTION;",
  `INSERT INTO profiles (id, payload) VALUES ('sandeep', ${quote(JSON.stringify(seed.candidate_profile))}) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP;`,
  ...seed.opportunities.map((opportunity) => `INSERT INTO opportunities (id, category, score_total, last_verified_at, payload) VALUES (${quote(opportunity.id)}, ${quote(opportunity.category)}, ${Number(opportunity.score_total)}, ${quote(opportunity.last_verified_at)}, ${quote(JSON.stringify(opportunity))}) ON CONFLICT(id) DO UPDATE SET category = excluded.category, score_total = excluded.score_total, last_verified_at = excluded.last_verified_at, payload = excluded.payload, updated_at = CURRENT_TIMESTAMP;`),
  "COMMIT;",
  ""
];

await mkdir(new URL("../cloudflare/", import.meta.url), { recursive: true });
await writeFile(new URL("../cloudflare/seed.sql", import.meta.url), statements.join("\n"));
console.log(`Generated Cloudflare D1 seed with ${seed.opportunities.length} opportunities.`);
