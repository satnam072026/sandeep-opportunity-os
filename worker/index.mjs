import verifiedSeed from "../src/data/verified_seed_24.json" with { type: "json" };
import { runCanonicalSync } from "../supabase/functions/_shared/canonicalSync.mjs";

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
  // 1. Cloudflare Access JWT assertion or authenticated email
  const cfJwt = request.headers.get("cf-access-jwt-assertion");
  if (cfJwt && cfJwt.length > 20) return true;
  const cfEmail = request.headers.get("cf-access-authenticated-user-email");
  if (cfEmail && cfEmail.includes("@")) return true;

  // 2. Cookie session (__Host-sandeep_session or sandeep_session)
  const cookies = parseCookies(request.headers.get("cookie"));
  const cookieToken = cookies["__Host-sandeep_session"] || cookies["sandeep_session"];
  if (cookieToken && env.APP_SESSION_SECRET) {
    const [expiresAt, signature] = cookieToken.split(".");
    if (expiresAt && signature && Number(expiresAt) >= Date.now()) {
      if (await secureEqual(signature, await hmac(expiresAt, env.APP_SESSION_SECRET))) {
        return true;
      }
    }
  }

  // 3. Authorization: Bearer <token>
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.replace(/^Bearer\s+/iu, "").trim();
  if (bearerToken) {
    if (bearerToken.includes(".") && env.APP_SESSION_SECRET) {
      const [expiresAt, signature] = bearerToken.split(".");
      if (expiresAt && signature && Number(expiresAt) >= Date.now()) {
        if (await secureEqual(signature, await hmac(expiresAt, env.APP_SESSION_SECRET))) {
          return true;
        }
      }
    }
    if (env.ADMIN_API_KEY && await secureEqual(bearerToken, env.ADMIN_API_KEY)) return true;
    if (env.APP_ADMIN_PASSWORD && await secureEqual(bearerToken, env.APP_ADMIN_PASSWORD)) return true;
  }

  // 4. Custom header: x-admin-key
  const adminKey = request.headers.get("x-admin-key") || "";
  if (adminKey) {
    if (env.ADMIN_API_KEY && await secureEqual(adminKey, env.ADMIN_API_KEY)) return true;
    if (env.APP_ADMIN_PASSWORD && await secureEqual(adminKey, env.APP_ADMIN_PASSWORD)) return true;
  }

  return false;
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

async function executeServerSync(env, triggerType = "MANUAL_UI") {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    return json({ error: "Google service account credentials not configured in Cloudflare Worker" }, 503);
  }

  await ensureSeeded(env);

  // 1. Fetch current opportunities and profile from D1
  const [oppRows] = await Promise.all([
    env.DB.prepare(`SELECT o.payload AS record, w.payload AS workflow FROM opportunities o LEFT JOIN workflow_states w ON w.opportunity_id = o.id`).all()
  ]);

  const currentRecords = (oppRows.results || []).map((row) => {
    const record = JSON.parse(row.record);
    if (!row.workflow) return record;
    const wf = JSON.parse(row.workflow);
    return {
      ...record,
      workflow: wf,
      user_status: wf.status,
      priority: wf.priority,
      favorite: wf.favorite,
      follow_up_date: wf.follow_up_date,
      contacted_date: wf.contacted_date,
      applied_date: wf.applied_date,
      personal_notes: wf.personal_notes
    };
  });

  // 2. Run canonical sync engine
  const syncResult = await runCanonicalSync({
    googleSaEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    googlePrivateKey: env.GOOGLE_PRIVATE_KEY,
    currentRecords,
    dryRun: true,
    triggerType
  });

  const { telemetry, records } = syncResult;

  // 3. Ensure Cloudflare D1 canonical database is recorded in source diagnostics
  if (!telemetry.sourceDiagnostics.some((s) => s.id === "cloudflare_d1_db")) {
    telemetry.sourceDiagnostics.push({
      id: "cloudflare_d1_db",
      name: "Cloudflare D1 SQL Database (Production)",
      status: "Connected (DB)",
      statusCode: 200,
      message: "Canonical relational database active on Cloudflare Edge with 7-field CRM protection.",
      recordsCount: records.length
    });
  }

  // 4. Compute dynamic agent health strictly for the 3 configured agents (Bago Muse, Haya Satnam, Kattu AI)
  const bagoDiag = telemetry.sourceDiagnostics.filter((s) =>
    ["muse_social_job_hunter", "master_job_application_tracker", "graduate_schemes_tracker"].includes(s.id)
  );
  const bagoOk = bagoDiag.filter((s) => s.status === "Connected").length;
  const bagoHealth = bagoOk === bagoDiag.length ? "Healthy" : bagoOk > 0 ? "Degraded" : "Permission required";

  const satnamDiag = telemetry.sourceDiagnostics.filter((s) =>
    ["masters_workbook", "satnam_global_jobs"].includes(s.id)
  );
  const satnamOk = satnamDiag.filter((s) => s.status === "Connected").length;
  const satnamHealth = satnamOk === satnamDiag.length ? "Healthy" : satnamOk > 0 ? "Degraded" : "Permission required";

  const kattuDiag = telemetry.sourceDiagnostics.filter((s) => s.id.startsWith("kattu_"));
  const kattuOk = kattuDiag.filter((s) => s.status === "Connected").length;
  const kattuHealth = kattuOk === kattuDiag.length ? "Healthy" : kattuOk > 0 ? "Degraded" : "Permission required";

  const agentHealth = {
    bago_muse: {
      health: bagoHealth,
      lastSync: telemetry.completedAt,
      message: `${bagoOk}/${bagoDiag.length} sources connected (Bago Social Sheet + Drive Workbooks)`
    },
    haya_satnam: {
      health: satnamHealth,
      lastSync: telemetry.completedAt,
      message: satnamOk > 0
        ? `${satnamOk}/${satnamDiag.length} sources connected (Master's workbook active; Muse_Satnam root pending)`
        : "Awaiting Google Service Account reader access on Muse_Satnam workspace"
    },
    kattu_ai: {
      health: kattuHealth,
      lastSync: telemetry.completedAt,
      message: kattuOk > 0
        ? `${kattuOk}/${kattuDiag.length} regional sheets connected`
        : "Awaiting Google Service Account reader access on Kattu Regional Sheets (India, EU, UK, USA)"
    }
  };

  telemetry.agentHealth = agentHealth;

  // 5. Batch upsert into D1 opportunities & workflow_states
  const oppStatements = [];
  const wfStatements = [];

  for (const opp of records) {
    oppStatements.push(
      env.DB.prepare(
        `INSERT INTO opportunities (id, category, score_total, last_verified_at, payload)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           category = excluded.category,
           score_total = excluded.score_total,
           last_verified_at = excluded.last_verified_at,
           payload = excluded.payload,
           updated_at = CURRENT_TIMESTAMP`
      ).bind(
        opp.id,
        opp.category,
        Number(opp.score_total || 0),
        opp.last_verified_at || new Date().toISOString(),
        JSON.stringify(opp)
      )
    );

    if (opp.workflow || opp.user_status) {
      const wf = opp.workflow || {
        status: opp.user_status || "New",
        priority: opp.priority || "P2",
        favorite: Boolean(opp.favorite),
        follow_up_date: opp.follow_up_date || null,
        personal_notes: opp.personal_notes || "",
        contacted_date: opp.contacted_date || null,
        applied_date: opp.applied_date || null
      };
      wfStatements.push(
        env.DB.prepare(
          `INSERT INTO workflow_states (opportunity_id, payload)
           VALUES (?, ?)
           ON CONFLICT(opportunity_id) DO UPDATE SET
             payload = excluded.payload,
             updated_at = CURRENT_TIMESTAMP`
        ).bind(opp.id, JSON.stringify(wf))
      );
    }
  }

  const allStatements = [...oppStatements, ...wfStatements];
  const BATCH_SIZE = 50;
  for (let i = 0; i < allStatements.length; i += BATCH_SIZE) {
    await env.DB.batch(allStatements.slice(i, i + BATCH_SIZE));
  }

  // 6. Record run in research_runs table
  await env.DB.prepare(
    `INSERT INTO research_runs (worker_id, summary, started_at, completed_at)
     VALUES ('cloudflare-worker', ?, ?, ?)`
  ).bind(
    JSON.stringify(telemetry),
    telemetry.startedAt,
    telemetry.completedAt
  ).run();

  return json({
    ok: true,
    telemetry,
    recordsCount: records.length,
    records
  });
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

  if (url.pathname === "/api/sync" && request.method === "POST") {
    if (!await requireAdmin(request, env)) return json({ error: "Authentication required" }, 401);
    return await executeServerSync(env, "MANUAL_UI");
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const body = await readBody(request);
    const password = body?.password || body?.pass || "";
    if (!await secureEqual(password, env.APP_ADMIN_PASSWORD)) return json({ error: "Invalid credentials" }, 401);
    const expiresAt = String(Date.now() + 8 * 60 * 60 * 1000);
    const signature = await hmac(expiresAt, env.APP_SESSION_SECRET);
    const token = `${expiresAt}.${signature}`;
    return json({
      ok: true,
      token,
      user: {
        id: "usr_sandeep_admin",
        name: "Sandeep Gautam",
        email: "bagosandeep@gmail.com",
        role: "admin"
      }
    }, 200, {
      "set-cookie": `__Host-sandeep_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`
    });
  }

  if (url.pathname === "/api/state" && request.method === "GET") {
    if (!await requireAdmin(request, env)) return json({ error: "Authentication required" }, 401);
    await ensureSeeded(env);
    const [opportunities, profile, latestRun] = await Promise.all([
      env.DB.prepare(`SELECT o.payload AS record, w.payload AS workflow FROM opportunities o LEFT JOIN workflow_states w ON w.opportunity_id = o.id ORDER BY o.score_total DESC, o.id ASC`).all(),
      env.DB.prepare("SELECT payload FROM profiles WHERE id = 'sandeep'").first(),
      env.DB.prepare("SELECT summary, started_at, completed_at FROM research_runs ORDER BY id DESC LIMIT 1").first()
    ]);
    const runSummary = latestRun?.summary ? JSON.parse(latestRun.summary) : null;
    return json({
      opportunities: opportunities.results.map((row) => {
        const record = JSON.parse(row.record);
        if (!row.workflow) return record;
        const workflow = JSON.parse(row.workflow);
        return { ...record, workflow, user_status: workflow.status, priority: workflow.priority, favorite: workflow.favorite, follow_up_date: workflow.follow_up_date, contacted_date: workflow.contacted_date, applied_date: workflow.applied_date, personal_notes: workflow.personal_notes };
      }),
      profile: profile?.payload ? JSON.parse(profile.payload) : null,
      lastSync: runSummary,
      agentHealth: runSummary?.agentHealth || null,
      sourceHealth: runSummary?.sourceDiagnostics || null
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
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(executeServerSync(env, "SCHEDULED_CRON"));
  }
};

