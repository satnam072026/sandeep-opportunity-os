import verifiedSeed from "../src/data/verified_seed_24.json";

const STATUSES = new Set(["New", "Saved", "Preparing", "Contacted", "Applied", "Interviewing", "Follow-Up", "Won", "Rejected", "Archived"]);
const PRIORITIES = new Set(["High", "Medium", "Low", "P0", "P1", "P2"]);

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...headers }
});

function parseCookies(header = "") {
  return Object.fromEntries(String(header || "").split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value));
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

async function hmac(value, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function secureEqual(left, right) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(left))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(right)))
  ]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let mismatch = 0;
  for (let index = 0; index < av.length; index += 1) mismatch |= av[index] ^ bv[index];
  return mismatch === 0;
}

async function requireAdmin(request, env) {
  const token = parseCookies(request.headers.get("cookie"))["__Host-sandeep_session"];
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  return Boolean(expiresAt && signature && Number(expiresAt) >= Date.now() && await secureEqual(signature, await hmac(expiresAt, env.APP_SESSION_SECRET)));
}

async function requireAgent(request, env) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "") || "";
  return Boolean(env.AGENT_API_TOKEN && supplied && await secureEqual(supplied, env.AGENT_API_TOKEN));
}

async function readBody(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 262_144) throw new Error("PAYLOAD_TOO_LARGE");
  return request.json();
}

async function ensureSeeded(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM opportunities").first();
  if (Number(row?.count || 0) > 0) return;
  const statements = [
    env.DB.prepare("INSERT OR IGNORE INTO profiles (id, payload) VALUES ('sandeep', ?)").bind(JSON.stringify(verifiedSeed.candidate_profile)),
    ...verifiedSeed.opportunities.map((opportunity) => env.DB.prepare("INSERT OR IGNORE INTO opportunities (id, category, score_total, last_verified_at, payload) VALUES (?, ?, ?, ?, ?)").bind(opportunity.id, opportunity.category, opportunity.score_total, opportunity.last_verified_at, JSON.stringify(opportunity)))
  ];
  await env.DB.batch(statements);
}

async function handleApi(request, env, url) {
  if (!env.APP_SESSION_SECRET || env.APP_SESSION_SECRET.length < 32 || !env.APP_ADMIN_PASSWORD || env.APP_ADMIN_PASSWORD.length < 12) {
    return json({ error: "Server secrets are not configured" }, 503);
  }

  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return json({ error: "Forbidden origin" }, 403);
    if (request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "Cross-site request rejected" }, 403);
  }

  if (url.pathname === "/api/health" && request.method === "GET") {
    await env.DB.prepare("SELECT 1").first();
    return json({ ok: true, database: "cloudflare-d1" });
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const body = await readBody(request);
    if (!await secureEqual(body?.password || "", env.APP_ADMIN_PASSWORD)) return json({ error: "Invalid credentials" }, 401);
    const expiresAt = String(Date.now() + 8 * 60 * 60 * 1000);
    const token = `${expiresAt}.${await hmac(expiresAt, env.APP_SESSION_SECRET)}`;
    return json({ ok: true }, 200, {
      "set-cookie": `__Host-sandeep_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`
    });
  }

  if (url.pathname === "/api/state" && request.method === "GET") {
    await ensureSeeded(env);
    const [opportunities, profile] = await Promise.all([
      env.DB.prepare(`SELECT o.payload AS record, w.payload AS workflow FROM opportunities o LEFT JOIN workflow_states w ON w.opportunity_id = o.id ORDER BY o.score_total DESC, o.id ASC`).all(),
      env.DB.prepare("SELECT payload FROM profiles WHERE id = 'sandeep'").first()
    ]);
    return json({
      opportunities: opportunities.results.map((row) => {
        const record = JSON.parse(row.record);
        if (!row.workflow) return record;
        const workflow = JSON.parse(row.workflow);
        return { ...record, workflow, user_status: workflow.status, priority: workflow.priority, favorite: workflow.favorite, follow_up_date: workflow.follow_up_date, contacted_date: workflow.contacted_date, applied_date: workflow.applied_date, personal_notes: workflow.personal_notes };
      }),
      profile: profile?.payload ? JSON.parse(profile.payload) : null
    });
  }

  const workflowMatch = url.pathname.match(/^\/api\/workflows\/([A-Za-z0-9_-]{1,80})$/u);
  if (workflowMatch && request.method === "PUT") {
    if (!await requireAdmin(request, env)) return json({ error: "Authentication required" }, 401);
    const input = await readBody(request);
    if (!STATUSES.has(input.status) || !PRIORITIES.has(input.priority) || typeof input.favorite !== "boolean") return json({ error: "Invalid workflow state" }, 400);
    const payload = { status: input.status, priority: input.priority, favorite: input.favorite, follow_up_date: input.follow_up_date || null, contacted_date: input.contacted_date || null, applied_date: input.applied_date || null, personal_notes: String(input.personal_notes || "").slice(0, 10_000) };
    const exists = await env.DB.prepare("SELECT 1 FROM opportunities WHERE id = ?").bind(workflowMatch[1]).first();
    if (!exists) return json({ error: "Opportunity not found" }, 404);
    await env.DB.prepare(`INSERT INTO workflow_states (opportunity_id, payload) VALUES (?, ?) ON CONFLICT(opportunity_id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`).bind(workflowMatch[1], JSON.stringify(payload)).run();
    return json(payload);
  }

  if (url.pathname === "/api/profile" && request.method === "PUT") {
    if (!await requireAdmin(request, env)) return json({ error: "Authentication required" }, 401);
    const payload = await readBody(request);
    if (!payload || typeof payload.full_name !== "string" || typeof payload.portfolio_url !== "string") return json({ error: "Invalid profile" }, 400);
    await env.DB.prepare(`INSERT INTO profiles (id, payload) VALUES ('sandeep', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`).bind(JSON.stringify(payload)).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/agent-jobs" && request.method === "POST") {
    if (!await requireAgent(request, env)) return json({ error: "Invalid agent token" }, 401);
    const body = await readBody(request);
    const sheetKey = String(body?.sheet_key || "").slice(0, 200);
    const jobType = String(body?.job_type || "").slice(0, 80);
    const priority = Math.max(-100, Math.min(100, Number(body?.priority || 0)));
    if (!sheetKey || !jobType || !Number.isFinite(priority)) return json({ error: "sheet_key and job_type are required" }, 400);
    const inserted = await env.DB.prepare(`INSERT INTO agent_jobs (sheet_key, job_type, priority, payload) VALUES (?, ?, ?, ?) RETURNING id, status`).bind(sheetKey, jobType, priority, JSON.stringify(body?.payload || {})).first();
    return json(inserted, 201);
  }

  if (url.pathname === "/api/agent-jobs/claim" && request.method === "POST") {
    if (!await requireAgent(request, env)) return json({ error: "Invalid agent token" }, 401);
    const body = await readBody(request);
    const workerId = String(body?.worker_id || "").slice(0, 100);
    if (!workerId) return json({ error: "worker_id is required" }, 400);
    const job = await env.DB.prepare(`UPDATE agent_jobs SET status = 'running', lease_owner = ?, lease_expires_at = datetime('now', '+10 minutes'), attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM agent_jobs WHERE status = 'queued' OR (status = 'running' AND lease_expires_at < CURRENT_TIMESTAMP) ORDER BY priority DESC, created_at ASC LIMIT 1) RETURNING *`).bind(workerId).first();
    return json({ job: job || null });
  }

  const completeMatch = url.pathname.match(/^\/api\/agent-jobs\/(\d+)\/complete$/u);
  if (completeMatch && request.method === "POST") {
    if (!await requireAgent(request, env)) return json({ error: "Invalid agent token" }, 401);
    const body = await readBody(request);
    const result = await env.DB.prepare(`UPDATE agent_jobs SET status = ?, result = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND lease_owner = ? RETURNING id`).bind(body?.ok === false ? "failed" : "completed", JSON.stringify(body?.result || {}), completeMatch[1], body?.worker_id).first();
    if (!result) return json({ error: "Job lease does not belong to this worker" }, 409);
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") return json({ error: "Payload too large" }, 413);
      console.error("Request failed", error instanceof Error ? error.message : "Unknown error");
      return json({ error: "Internal server error" }, 500);
    }
  }
};

