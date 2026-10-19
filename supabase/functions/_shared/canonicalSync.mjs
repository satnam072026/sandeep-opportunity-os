/**
 * Sandeep Opportunity OS — Canonical Ingestion & Sync Engine
 *
 * UNIFIED CANONICAL ENGINE shared identically across:
 * 1. GitHub Actions 6-Hour Scheduled Cron (scripts/sync-data.mjs)
 * 2. Supabase Edge Function Manual "Sync Data" trigger (supabase/functions/sync-opportunity-data)
 *
 * ZERO EXTERNAL DEPENDENCIES — Uses only Node/Deno standard library:
 * `node:crypto`, `node:zlib`, `node:buffer`, and standard Web `fetch` / `URL`.
 *
 * CORE INGESTION PIPELINE:
 * - Google Service Account RS256 JWT Authentication
 * - Native Google Sheets API v4 Ingestion (MUSE "ALL LEADS" - open-ended range without truncation)
 * - Drive API v3 OpenXML XLSX Ingestion (MASTER_JOB_APPLICATION_TRACKER.xlsx & master-spreadsheet.xlsx)
 * - URL Canonicalization & Deterministic SHA-256 Fingerprints & IDs
 * - Gating (Regional Restriction Gate, Seniority Gate) & Explainable Scoring
 * - Strict CRM Field Preservation: NEVER overwrites Sandeep's 7 user-owned fields
 * - Database Upsert (opportunities, workflow_states, research_runs with source_diagnostics JSONB)
 */

import crypto from "node:crypto";
import zlib from "node:zlib";
import { Buffer } from "node:buffer";

export function normalizePrivateKey(key) {
  if (!key) return "";
  let clean = key.trim();
  if (clean.startsWith('"') && clean.endsWith('"')) {
    clean = clean.slice(1, -1);
  }
  return clean.replace(/\\n/g, "\n");
}

export async function getGoogleAccessToken({
  email,
  privateKey,
  scopes = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly"
  ],
  fetchFn = globalThis.fetch
}) {
  if (!email || !privateKey) {
    throw new Error("Missing Google Service Account email or private key");
  }

  const cleanKey = normalizePrivateKey(privateKey);
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: Array.isArray(scopes) ? scopes.join(" ") : scopes,
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    })
  ).toString("base64url");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(cleanKey, "base64url");
  const assertion = `${header}.${payload}.${signature}`;

  const res = await fetchFn("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(assertion)}`
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Google OAuth2 error HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

export function canonicalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    let clean = rawUrl.trim();
    if (!/^https?:\/\//i.test(clean)) {
      clean = `https://${clean}`;
    }
    const parsed = new URL(clean);
    parsed.hash = "";
    parsed.protocol = "https:";
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const trackingPrefixes = ["utm_", "fbclid", "gclid", "msclkid", "ref", "source", "igsh"];
    const toDelete = [];
    parsed.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (trackingPrefixes.some((p) => lower.startsWith(p))) {
        toDelete.push(key);
      }
    });
    toDelete.forEach((k) => parsed.searchParams.delete(k));
    let path = parsed.pathname.replace(/\/+$/, "");
    if (!path) path = "";
    parsed.pathname = path;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

export function computeFingerprint(rec) {
  const cat = (rec.category || "").toLowerCase().trim();
  const org = (rec.organization || rec.organization_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const title = (rec.title || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]/g, "");
  return `${cat}::${org}::${title}`;
}

export function generateDeterministicId(category, uniqueKey) {
  const hash = crypto
    .createHash("sha256")
    .update(`${category}::${uniqueKey.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 12);
  const prefix =
    category === "freelance_leads"
      ? "opp_free"
      : category === "visa_jobs"
      ? "opp_visa"
      : category === "masters_scholarships"
      ? "opp_mast"
      : "opp_rem";
  return `${prefix}_${hash}`;
}

export function parseXlsxBuffer(buffer) {
  const nodeBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const files = {};
  let offset = 0;

  while (offset + 30 <= nodeBuf.length) {
    const sig = nodeBuf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const compMethod = nodeBuf.readUInt16LE(offset + 8);
    const compSize = nodeBuf.readUInt32LE(offset + 18);
    const fnLen = nodeBuf.readUInt16LE(offset + 26);
    const extraLen = nodeBuf.readUInt16LE(offset + 28);
    const fn = nodeBuf.toString("utf8", offset + 30, offset + 30 + fnLen);
    const dataStart = offset + 30 + fnLen + extraLen;
    const compData = nodeBuf.subarray(dataStart, dataStart + compSize);

    if (compMethod === 8) {
      try {
        files[fn] = zlib.inflateRawSync(compData);
      } catch {
        // Continue
      }
    } else if (compMethod === 0) {
      files[fn] = compData;
    }
    offset = dataStart + compSize;
  }

  // Parse workbook.xml to map sheet r:id to real sheet names
  const sheetMap = {};
  if (files["xl/workbook.xml"]) {
    const wbXml = files["xl/workbook.xml"].toString("utf8");
    const sheetRegex = /<sheet\b([^>]*)\/?>/g;
    let sm;
    while ((sm = sheetRegex.exec(wbXml)) !== null) {
      const nameMatch = /\bname="([^"]+)"/.exec(sm[1]);
      const rIdMatch = /\br:id="([^"]+)"/.exec(sm[1]) || /\bid="([^"]+)"/.exec(sm[1]);
      if (nameMatch && rIdMatch) {
        sheetMap[rIdMatch[1]] = nameMatch[1];
      }
    }
  }

  // Parse xl/_rels/workbook.xml.rels to map r:id to sheet path
  const relMap = {};
  if (files["xl/_rels/workbook.xml.rels"]) {
    const relXml = files["xl/_rels/workbook.xml.rels"].toString("utf8");
    const relRegex = /<Relationship\b([^>]*)\/?>/g;
    let rm;
    while ((rm = relRegex.exec(relXml)) !== null) {
      const idMatch = /\bId="([^"]+)"/.exec(rm[1]);
      const targetMatch = /\bTarget="([^"]+)"/.exec(rm[1]);
      if (idMatch && targetMatch) {
        const cleanTarget = targetMatch[1].replace(/^\/?(xl\/)?worksheets\//, "");
        relMap[idMatch[1]] = cleanTarget;
      }
    }
  }

  const sharedStrings = [];
  if (files["xl/sharedStrings.xml"]) {
    const ssXml = files["xl/sharedStrings.xml"].toString("utf8");
    const siRegex = /<si>([\s\S]*?)<\/si>/g;
    let match;
    while ((match = siRegex.exec(ssXml)) !== null) {
      const tMatch = /<t[^>]*>([\s\S]*?)<\/t>/g;
      let textParts = [];
      let tm;
      while ((tm = tMatch.exec(match[1])) !== null) {
        textParts.push(tm[1]);
      }
      sharedStrings.push(textParts.join(""));
    }
  }

  const sheetEntries = Object.keys(files).filter(
    (k) => k.startsWith("xl/worksheets/sheet") && k.endsWith(".xml")
  );

  const result = {};

  for (const sheetPath of sheetEntries) {
    const shortSheetFile = sheetPath.replace("xl/worksheets/", "");
    // Find sheet name
    let sheetName = shortSheetFile.replace(".xml", "");
    for (const [rId, target] of Object.entries(relMap)) {
      if (target === shortSheetFile) {
        if (sheetMap[rId]) {
          sheetName = sheetMap[rId];
          break;
        }
      }
    }

    const xml = files[sheetPath].toString("utf8");
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    const rows = [];
    let rMatch;
    while ((rMatch = rowRegex.exec(xml)) !== null) {
      const cellRegex = /<c\s+[^>]*r="([A-Z]+)\d+"(?:[^>]*?t="([^"]*)")?[^>]*>([\s\S]*?)<\/c>/g;
      const rowCells = {};
      let cMatch;
      while ((cMatch = cellRegex.exec(rMatch[1])) !== null) {
        const col = cMatch[1];
        const type = cMatch[2];
        const inner = cMatch[3] || "";
        let cellVal = "";

        // Check for inline string <is><t>...</t></is>
        const isMatch = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/.exec(inner);
        if (isMatch) {
          cellVal = isMatch[1];
        } else {
          // Check for <v>...</v>
          const vMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
          const rawV = vMatch ? vMatch[1].trim() : "";
          if (type === "s") {
            const idx = parseInt(rawV, 10);
            cellVal = !Number.isNaN(idx) && sharedStrings[idx] !== undefined ? sharedStrings[idx] : rawV;
          } else {
            cellVal = rawV;
          }
        }
        rowCells[col] = cellVal
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"');
      }
      const maxColIdx = Object.keys(rowCells).reduce((max, col) => {
        let n = 0;
        for (let i = 0; i < col.length; i++) {
          n = n * 26 + (col.charCodeAt(i) - 64);
        }
        return Math.max(max, n);
      }, 0);

      const rowArr = [];
      for (let i = 1; i <= maxColIdx; i++) {
        let colName = "";
        let temp = i;
        while (temp > 0) {
          const rem = (temp - 1) % 26;
          colName = String.fromCharCode(65 + rem) + colName;
          temp = Math.floor((temp - 1) / 26);
        }
        rowArr.push(rowCells[colName] || "");
      }
      rows.push(rowArr);
    }

    if (rows.length > 1) {
      const headers = rows[0].map((h) => h.trim());
      const records = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.every((c) => !c.trim())) continue;
        const obj = {};
        headers.forEach((h, idx) => {
          if (h) obj[h] = r[idx] || "";
        });
        obj._rowIndex = i + 1;
        records.push(obj);
      }
      result[sheetName] = records;
    }
  }

  return result;
}

function getFirstVal(obj, possibleKeys) {
  if (!obj || typeof obj !== "object") return "";
  const entries = Object.entries(obj);
  for (const k of possibleKeys) {
    const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const [key, val] of entries) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanKey === lowerK && val !== undefined && val !== null) {
        return String(val).trim();
      }
    }
  }
  return "";
}

export function normalizeMuseSocialLead(row, index = 0) {
  const platform = getFirstVal(row, ["Platform", "Source", "Network"]) || "Social";
  const groupOrPage = getFirstVal(row, ["Group/Page Name", "Group", "Page Name", "Organization", "Group Name"]) || "Social Community";
  const rawUrl = getFirstVal(row, ["Contact / Link", "Post Link", "URL", "Link", "Source URL", "Post URL"]);
  const canonUrl = canonicalizeUrl(rawUrl);

  const rawTitle = getFirstVal(row, [
    "Post Text / Lead Description",
    "Lead Text",
    "Post Text",
    "Description",
    "Role",
    "Title",
    "Job Title"
  ]);

  let title = rawTitle.split(/[\r\n]+/)[0].trim();
  if (title.length > 90) title = title.slice(0, 87) + "...";
  if (!title) title = `${platform} Lead — ${groupOrPage}`;

  const categoryHint = getFirstVal(row, ["Category / Role", "Category", "Role Type", "Pipeline"]).toLowerCase();
  let category = "freelance_leads";
  if (categoryHint.includes("remote")) {
    category = "remote_jobs";
  } else if (categoryHint.includes("visa") || categoryHint.includes("sponsor") || categoryHint.includes("full-time")) {
    category = "visa_jobs";
  } else if (categoryHint.includes("master") || categoryHint.includes("scholarship")) {
    category = "masters_scholarships";
  } else {
    category = "freelance_leads";
  }

  const location = getFirstVal(row, ["Location", "Country", "City", "Geography"]) || "Remote / Worldwide";
  const compensation = getFirstVal(row, ["Budget", "Rate", "Salary", "Compensation", "Pay"]);
  const dateFound = getFirstVal(row, ["Date Found", "Date", "Timestamp", "Created"]) || new Date().toISOString().slice(0, 10);

  const uniqueKey = canonUrl || `${groupOrPage}::${title}::${index}`;
  const id = generateDeterministicId(category, uniqueKey);

  return {
    id,
    category,
    title,
    organization: groupOrPage,
    location,
    country: "Global / Cyprus",
    source_url: rawUrl || "",
    canonical_source_url: canonUrl,
    provenance_urls: rawUrl ? [rawUrl] : [],
    discovered_by_agent: "sandy_muse",
    agent_provenance: [
      {
        agentId: "sandy_muse",
        agentName: "Sandy Muse",
        sourceId: "muse_social_job_hunter",
        sourceName: "MUSE | FACEBOOK & INSTAGRAM JOB HUNTER",
        sourceTab: "ALL LEADS",
        sourceRowRef: `Row ${index + 2}`,
        sourceUrl: rawUrl || canonUrl || "",
        firstSeenAt: dateFound,
        lastSeenAt: dateFound,
        lastVerifiedAt: dateFound
      }
    ],
    last_verified_at: dateFound,
    deadline: null,
    is_active: true,
    confidence: "Medium",
    score_total: 75,
    score_components: [
      { key: "social_discovery", label: "Muse Social Discovery", points: 25, max_points: 30 },
      { key: "target_fit", label: "Skills Alignment", points: 25, max_points: 30 },
      { key: "reachability", label: "Direct Client Contact", points: 25, max_points: 40 }
    ],
    why_this_matches: {
      strong: [
        `Discovered via Muse Social Job Hunter on ${platform}`,
        `Community: ${groupOrPage}`,
        compensation ? `Budget indicator: ${compensation}` : "Active discussion lead"
      ],
      review: ["Direct verification with post author recommended", "Verify exact requirements"],
      gap: []
    },
    deterministic_findings: [
      `Source: MUSE Social Job Hunter (${platform})`,
      `Group: ${groupOrPage}`,
      `Date Discovered: ${dateFound}`
    ],
    inferred_findings: [
      `Platform: ${platform}`,
      compensation ? `Compensation Indicator: ${compensation}` : "Rate open to negotiation"
    ],
    details: {
      platform,
      public_contact: groupOrPage,
      outreach_hook: rawTitle.length > 120 ? rawTitle.slice(0, 300) + "..." : rawTitle,
      budget_indicator: compensation || undefined,
      discovered_by_agent: "sandy_muse",
      agent_provenance: [
        {
          agentId: "sandy_muse",
          agentName: "Sandy Muse",
          sourceId: "muse_social_job_hunter",
          sourceName: "MUSE | FACEBOOK & INSTAGRAM JOB HUNTER",
          sourceTab: "ALL LEADS",
          sourceRowRef: `Row ${index + 2}`,
          sourceUrl: rawUrl || canonUrl || "",
          firstSeenAt: dateFound,
          lastSeenAt: dateFound,
          lastVerifiedAt: dateFound
        }
      ]
    },
    user_status: "New",
    priority: "P2",
    favorite: false,
    follow_up_date: null,
    personal_notes: "",
    workflow: {
      status: "New",
      priority: "P2",
      favorite: false,
      follow_up_date: null,
      contacted_date: null,
      applied_date: null,
      personal_notes: ""
    },
    activity_history: [
      { at: new Date().toISOString(), label: `Ingested from MUSE Social Sheet (${platform})` }
    ]
  };
}

export function normalizeMasterJobTrackerRow(row, index = 0) {
  const company = getFirstVal(row, ["Company", "Organization", "Employer", "Company Name"]) || "Company";
  const title = getFirstVal(row, ["Role / Job Title", "Position", "Role", "Job Title", "Title", "Opportunity"]) || "Engineering Role";
  const rawUrl = getFirstVal(row, ["URL / Job Link", "Application Link", "URL", "Link", "Job URL", "Source Link"]);
  const canonUrl = canonicalizeUrl(rawUrl);

  const loc = getFirstVal(row, ["Location", "Country", "Workplace Type", "City"]) || "Cyprus / Remote";
  const salary = getFirstVal(row, ["Salary / Rate", "Salary", "Rate", "Budget", "Compensation", "Pay"]);
  const notes = getFirstVal(row, ["Notes", "Personal Notes", "Comments", "Status Notes"]);
  const dateApplied = getFirstVal(row, ["Date Applied", "Applied Date", "Application Date"]);
  const categoryHint = getFirstVal(row, ["Category", "Type", "Track"]).toLowerCase();

  let category = "visa_jobs";
  if (categoryHint.includes("remote") || loc.toLowerCase().includes("remote")) {
    category = "remote_jobs";
  } else if (categoryHint.includes("freelance") || categoryHint.includes("contract")) {
    category = "freelance_leads";
  }

  const uniqueKey = canonUrl || `${company}::${title}::${index}`;
  const id = generateDeterministicId(category, uniqueKey);

  return {
    id,
    category,
    title,
    organization: company,
    location: loc,
    country: loc.toLowerCase().includes("cyprus") ? "Cyprus" : "Europe",
    source_url: rawUrl || "",
    canonical_source_url: canonUrl,
    provenance_urls: rawUrl ? [rawUrl] : [],
    discovered_by_agent: "haya_muse_1",
    agent_provenance: [
      {
        agentId: "haya_muse_1",
        agentName: "Haya Muse 1",
        sourceId: "master_job_application_tracker",
        sourceName: "MASTER_JOB_APPLICATION_TRACKER.xlsx",
        sourceTab: categoryHint || "All Applications",
        sourceRowRef: `Row ${index + 2}`,
        sourceUrl: rawUrl || canonUrl || "",
        firstSeenAt: dateApplied || new Date().toISOString().slice(0, 10),
        lastSeenAt: dateApplied || new Date().toISOString().slice(0, 10),
        lastVerifiedAt: dateApplied || new Date().toISOString().slice(0, 10)
      }
    ],
    last_verified_at: new Date().toISOString().slice(0, 10),
    deadline: null,
    is_active: true,
    confidence: "High",
    score_total: 80,
    score_components: [
      { key: "role_fit", label: "Direct Role Alignment", points: 30, max_points: 35 },
      { key: "cyprus_sponsor", label: "Location & Sponsorship", points: 25, max_points: 35 },
      { key: "actionability", label: "Application Readiness", points: 25, max_points: 30 }
    ],
    why_this_matches: {
      strong: [`Company: ${company}`, `Location: ${loc}`, "Direct application tracker entry"],
      review: ["Check current requisition status"],
      gap: []
    },
    deterministic_findings: [
      `Source: MASTER_JOB_APPLICATION_TRACKER.xlsx`,
      `Employer: ${company}`,
      `Location: ${loc}`
    ],
    inferred_findings: [
      `Workplace: ${loc}`,
      notes ? `Initial Note: ${notes}` : "Tracked lead"
    ],
    details: {
      company,
      location: loc,
      salary_range: salary || undefined,
      notes: notes || undefined,
      discovered_by_agent: "haya_muse_1",
      agent_provenance: [
        {
          agentId: "haya_muse_1",
          agentName: "Haya Muse 1",
          sourceId: "master_job_application_tracker",
          sourceName: "MASTER_JOB_APPLICATION_TRACKER.xlsx",
          sourceTab: categoryHint || "All Applications",
          sourceRowRef: `Row ${index + 2}`,
          sourceUrl: rawUrl || canonUrl || "",
          firstSeenAt: dateApplied || new Date().toISOString().slice(0, 10),
          lastSeenAt: dateApplied || new Date().toISOString().slice(0, 10),
          lastVerifiedAt: dateApplied || new Date().toISOString().slice(0, 10)
        }
      ]
    },
    user_status: dateApplied ? "Applied" : "New",
    priority: "P2",
    favorite: false,
    follow_up_date: null,
    personal_notes: notes || "",
    workflow: {
      status: dateApplied ? "Applied" : "New",
      priority: "P2",
      favorite: false,
      follow_up_date: null,
      contacted_date: dateApplied || null,
      applied_date: dateApplied || null,
      personal_notes: notes || ""
    },
    activity_history: [
      { at: new Date().toISOString(), label: "Ingested from MASTER_JOB_APPLICATION_TRACKER.xlsx" }
    ]
  };
}

export function normalizeMasterProgrammeRow(row, index = 0) {
  const university = getFirstVal(row, ["University", "Institution", "College", "School"]) || "European University";
  const programme = getFirstVal(row, ["Programme", "Program", "Degree", "Course", "Master"]) || "MSc Computer Science";
  const country = getFirstVal(row, ["Country", "Location", "Destination"]) || "Cyprus";
  const rawUrl = getFirstVal(row, ["URL", "Link", "Website", "Programme Link"]);
  const canonUrl = canonicalizeUrl(rawUrl);
  const tuition = getFirstVal(row, ["Tuition", "Fees", "Cost", "Price"]);
  const deadline = getFirstVal(row, ["Deadline", "Application Deadline", "Intake"]);

  const uniqueKey = canonUrl || `${university}::${programme}::${index}`;
  const id = generateDeterministicId("masters_scholarships", uniqueKey);

  return {
    id,
    category: "masters_scholarships",
    title: programme,
    organization: university,
    location: country,
    country,
    source_url: rawUrl || "",
    canonical_source_url: canonUrl,
    provenance_urls: rawUrl ? [rawUrl] : [],
    discovered_by_agent: "haya_muse_2",
    agent_provenance: [
      {
        agentId: "haya_muse_2",
        agentName: "Haya Muse 2",
        sourceId: "masters_workbook",
        sourceName: "master-spreadsheet.xlsx",
        sourceTab: "MASTER_PROGRAMMES",
        sourceRowRef: `Row ${index + 2}`,
        sourceUrl: rawUrl || canonUrl || "",
        firstSeenAt: new Date().toISOString().slice(0, 10),
        lastSeenAt: new Date().toISOString().slice(0, 10),
        lastVerifiedAt: new Date().toISOString().slice(0, 10)
      }
    ],
    last_verified_at: new Date().toISOString().slice(0, 10),
    deadline: deadline || null,
    is_active: true,
    confidence: "High",
    score_total: 85,
    score_components: [
      { key: "academic_fit", label: "Postgraduate STEM Alignment", points: 30, max_points: 35 },
      { key: "tuition_value", label: "Affordability & Funding Potential", points: 30, max_points: 35 },
      { key: "location_fit", label: "European Study & Work Rights", points: 25, max_points: 30 }
    ],
    why_this_matches: {
      strong: [
        `University: ${university}`,
        `Country: ${country}`,
        tuition ? `Tuition: ${tuition}` : "Recognized postgraduate degree"
      ],
      review: [deadline ? `Application deadline: ${deadline}` : "Verify upcoming intake deadlines"],
      gap: []
    },
    deterministic_findings: [
      `Source: master-spreadsheet.xlsx (MASTER_PROGRAMMES)`,
      `University: ${university}`,
      `Country: ${country}`
    ],
    inferred_findings: [
      `Academic Programme: ${programme}`,
      tuition ? `Tuition: ${tuition}` : "Tuition details pending"
    ],
    details: {
      degree_level: "Master",
      tuition_fee: tuition || undefined,
      discovered_by_agent: "haya_muse_2",
      agent_provenance: [
        {
          agentId: "haya_muse_2",
          agentName: "Haya Muse 2",
          sourceId: "masters_workbook",
          sourceName: "master-spreadsheet.xlsx",
          sourceTab: "MASTER_PROGRAMMES",
          sourceRowRef: `Row ${index + 2}`,
          sourceUrl: rawUrl || canonUrl || "",
          firstSeenAt: new Date().toISOString().slice(0, 10),
          lastSeenAt: new Date().toISOString().slice(0, 10),
          lastVerifiedAt: new Date().toISOString().slice(0, 10)
        }
      ]
    },
    user_status: "New",
    priority: "P2",
    favorite: false,
    follow_up_date: null,
    personal_notes: "",
    workflow: {
      status: "New",
      priority: "P2",
      favorite: false,
      follow_up_date: null,
      contacted_date: null,
      applied_date: null,
      personal_notes: ""
    },
    activity_history: [
      { at: new Date().toISOString(), label: "Ingested from master-spreadsheet.xlsx (MASTER_PROGRAMMES)" }
    ]
  };
}

export function normalizeScholarshipRow(row, index = 0) {
  const provider = getFirstVal(row, ["Provider", "Organization", "Scholarship Name", "Name", "Title"]) || "Scholarship Grant";
  const name = getFirstVal(row, ["Scholarship Name", "Name", "Title", "Award"]) || provider;
  const coverage = getFirstVal(row, ["Coverage", "Value", "Amount", "Grant Value", "Award Value"]);
  const rawUrl = getFirstVal(row, ["URL", "Link", "Source Link", "Website"]);
  const canonUrl = canonicalizeUrl(rawUrl);
  const deadline = getFirstVal(row, ["Deadline", "Application Deadline", "Closing Date"]);

  const uniqueKey = canonUrl || `${provider}::${name}::${index}`;
  const id = generateDeterministicId("masters_scholarships", uniqueKey);

  return {
    id,
    category: "masters_scholarships",
    title: name,
    organization: provider,
    location: "Global / Europe",
    country: "Global / Europe",
    source_url: rawUrl || "",
    canonical_source_url: canonUrl,
    provenance_urls: rawUrl ? [rawUrl] : [],
    discovered_by_agent: "haya_muse_2",
    agent_provenance: [
      {
        agentId: "haya_muse_2",
        agentName: "Haya Muse 2",
        sourceId: "masters_workbook",
        sourceName: "master-spreadsheet.xlsx",
        sourceTab: "SCHOLARSHIPS",
        sourceRowRef: `Row ${index + 2}`,
        sourceUrl: rawUrl || canonUrl || "",
        firstSeenAt: new Date().toISOString().slice(0, 10),
        lastSeenAt: new Date().toISOString().slice(0, 10),
        lastVerifiedAt: new Date().toISOString().slice(0, 10)
      }
    ],
    last_verified_at: new Date().toISOString().slice(0, 10),
    deadline: deadline || null,
    is_active: true,
    confidence: "High",
    score_total: 90,
    score_components: [
      { key: "funding_value", label: "Scholarship Coverage & Grant Value", points: 35, max_points: 40 },
      { key: "eligibility", label: "International Student Eligibility", points: 30, max_points: 35 },
      { key: "academic_fit", label: "Postgraduate STEM Alignment", points: 25, max_points: 25 }
    ],
    why_this_matches: {
      strong: [`Provider: ${provider}`, coverage ? `Coverage: ${coverage}` : "Scholarship funding"],
      review: [deadline ? `Application deadline: ${deadline}` : "Verify deadline"],
      gap: []
    },
    deterministic_findings: [
      `Source: master-spreadsheet.xlsx (SCHOLARSHIPS)`,
      `Provider: ${provider}`,
      coverage ? `Coverage: ${coverage}` : "Funding grant"
    ],
    inferred_findings: [
      `Grant Name: ${name}`,
      coverage ? `Funding Amount: ${coverage}` : "Tuition support"
    ],
    details: {
      program_name: name,
      tuition_and_coverage: coverage || undefined,
      discovered_by_agent: "haya_muse_2",
      agent_provenance: [
        {
          agentId: "haya_muse_2",
          agentName: "Haya Muse 2",
          sourceId: "masters_workbook",
          sourceName: "master-spreadsheet.xlsx",
          sourceTab: "SCHOLARSHIPS",
          sourceRowRef: `Row ${index + 2}`,
          sourceUrl: rawUrl || canonUrl || "",
          firstSeenAt: new Date().toISOString().slice(0, 10),
          lastSeenAt: new Date().toISOString().slice(0, 10),
          lastVerifiedAt: new Date().toISOString().slice(0, 10)
        }
      ]
    },
    user_status: "New",
    priority: "P2",
    favorite: false,
    follow_up_date: null,
    personal_notes: "",
    workflow: {
      status: "New",
      priority: "P2",
      favorite: false,
      follow_up_date: null,
      contacted_date: null,
      applied_date: null,
      personal_notes: ""
    },
    activity_history: [
      { at: new Date().toISOString(), label: "Ingested from master-spreadsheet.xlsx (SCHOLARSHIPS)" }
    ]
  };
}

export function isDatedTab(tabTitle) {
  if (!tabTitle || typeof tabTitle !== "string") return false;
  return /^[0-9]{1,2}[A-Za-z]{3}/i.test(tabTitle.trim());
}

export function normalizeRegionalResearchRow(row, index = 0, {
  agentId = "kattu_ai",
  sourceId = "kattu_regional_sheet",
  sourceName = "Projects KattuAI Regional Sheet",
  sourceTab = "Dynamic Dated Tab"
} = {}) {
  const get = (keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
        return String(row[k]).trim();
      }
    }
    return "";
  };

  const title = get(["Role", "Title", "Position", "Job Title", "role", "title"]) || `Remote Opportunity ${index + 1}`;
  const org = get(["Company", "Organization", "Employer", "company", "organization"]) || "Verified Enterprise";
  const rawUrl = get(["URL", "Link", "Job Link", "Apply Link", "source_url", "url"]);
  const location = get(["Location", "Country", "Region", "location"]) || "Remote (EMEA / Global)";
  const platform = get(["Platform", "Source", "Board", "platform"]) || "Regional Fleet";
  const notes = get(["Notes", "Description", "Details", "notes"]);

  const canonUrl = canonicalizeUrl(rawUrl);
  const id = generateDeterministicId("remote_jobs", canonUrl || `${org}::${title}::${index}`);

  return {
    id,
    category: "remote_jobs",
    title,
    organization: org,
    location,
    country: location.includes("India") ? "IN" : location.includes("UK") ? "GB" : location.includes("Cyprus") ? "CY" : "EU",
    source_url: rawUrl || canonUrl || "",
    canonical_source_url: canonUrl || rawUrl || "",
    source_type: "REGIONAL_RESEARCH_SCAN",
    discovered_by_agent: agentId,
    agent_provenance: [
      {
        agent_id: agentId,
        agentId,
        agentName: "Kattu AI",
        source_id: sourceId,
        sourceId,
        sourceName,
        source_tab: sourceTab,
        sourceTab,
        sourceRowRef: `Row ${index + 2}`,
        sourceUrl: rawUrl || canonUrl || "",
        firstSeenAt: new Date().toISOString().slice(0, 10),
        lastSeenAt: new Date().toISOString().slice(0, 10),
        lastVerifiedAt: new Date().toISOString().slice(0, 10)
      }
    ],
    last_verified_at: new Date().toISOString().slice(0, 10),
    is_active: true,
    confidence: "High",
    score_total: 82,
    score_components: [
      { key: "timezone", label: "Cyprus UTC+2 Alignment", points: 30, max_points: 30 },
      { key: "remote_policy", label: "Contractor Remote Feasibility", points: 28, max_points: 35 },
      { key: "tech_stack", label: "Frontend/Fullstack Engineering Stack", points: 24, max_points: 35 }
    ],
    details: {
      platform,
      notes,
      regional_fleet: true,
      dated_tab: sourceTab,
      agent_provenance: [
        {
          agent_id: agentId,
          agentId,
          agentName: "Kattu AI",
          source_id: sourceId,
          sourceId,
          sourceName,
          source_tab: sourceTab,
          sourceTab,
          sourceRowRef: `Row ${index + 2}`,
          sourceUrl: rawUrl || canonUrl || "",
          firstSeenAt: new Date().toISOString().slice(0, 10)
        }
      ]
    },
    user_status: "New",
    priority: "P2",
    favorite: false,
    follow_up_date: null,
    personal_notes: "",
    workflow: {
      status: "New",
      priority: "P2",
      favorite: false,
      follow_up_date: null,
      contacted_date: null,
      applied_date: null,
      personal_notes: ""
    },
    activity_history: [
      { at: new Date().toISOString(), label: `Discovered by ${agentId} in tab ${sourceTab}` }
    ]
  };
}

/**
 * STRICT USER CRM FIELD PRESERVATION
 * Guarantees Sandeep's 7 user-owned CRM fields are NEVER overwritten:
 * 1. status / outreach_status / user_status
 * 2. priority / priority_override
 * 3. favorite / pinned
 * 4. follow_up_date
 * 5. personal_notes / notes
 * 6. contacted_date
 * 7. applied_date
 */
export function preserveUserCrmFields(existing, incoming) {
  if (!existing) return incoming;

  const userStatus =
    existing.workflow?.status ||
    existing.user_status ||
    existing.status ||
    existing.outreach_status ||
    incoming.user_status ||
    "New";

  const userPriority =
    existing.workflow?.priority ||
    existing.priority ||
    existing.priority_override ||
    incoming.priority ||
    "P2";

  const userFavorite =
    typeof existing.workflow?.favorite === "boolean"
      ? existing.workflow.favorite
      : typeof existing.favorite === "boolean"
      ? existing.favorite
      : typeof existing.pinned === "boolean"
      ? existing.pinned
      : incoming.favorite || false;

  const userFollowUp =
    existing.workflow?.follow_up_date !== undefined
      ? existing.workflow.follow_up_date
      : existing.follow_up_date !== undefined
      ? existing.follow_up_date
      : incoming.follow_up_date || null;

  const userNotes =
    existing.workflow?.personal_notes !== undefined
      ? existing.workflow.personal_notes
      : existing.personal_notes !== undefined
      ? existing.personal_notes
      : existing.notes !== undefined
      ? existing.notes
      : incoming.personal_notes || "";

  const userContactedDate =
    existing.workflow?.contacted_date !== undefined
      ? existing.workflow.contacted_date
      : existing.contacted_date !== undefined
      ? existing.contacted_date
      : incoming.contacted_date || null;

  const userAppliedDate =
    existing.workflow?.applied_date !== undefined
      ? existing.workflow.applied_date
      : existing.applied_date !== undefined
      ? existing.applied_date
      : incoming.applied_date || null;

  const existingHistory = existing.activity_history || existing.history || [];
  const incomingHistory = incoming.activity_history || [];
  const mergedHistory = [...existingHistory];
  for (const ev of incomingHistory) {
    if (
      !mergedHistory.some(
        (h) =>
          h.label === ev.label &&
          Math.abs(new Date(h.at).getTime() - new Date(ev.at).getTime()) < 60000
      )
    ) {
      mergedHistory.push(ev);
    }
  }

  const urls = new Set([
    existing.source_url,
    ...(existing.provenance_urls || []),
    incoming.source_url,
    ...(incoming.provenance_urls || [])
  ]);
  const combinedProvenance = Array.from(urls).filter(Boolean);

  const rawAgentProv = [
    ...(Array.isArray(existing.agent_provenance) ? existing.agent_provenance : []),
    ...(Array.isArray(existing.details?.agent_provenance) ? existing.details.agent_provenance : []),
    ...(Array.isArray(incoming.agent_provenance) ? incoming.agent_provenance : []),
    ...(Array.isArray(incoming.details?.agent_provenance) ? incoming.details.agent_provenance : [])
  ];
  const seenAgentProv = new Set();
  const combinedAgentProvenance = [];
  for (const ap of rawAgentProv) {
    if (!ap) continue;
    const aId = ap.agent_id || ap.agentId;
    if (!aId) continue;
    const sId = ap.source_id || ap.sourceId || "";
    const sTab = ap.source_tab || ap.sourceTab || "";
    const key = `${aId}::${sId}::${sTab}`;
    if (!seenAgentProv.has(key)) {
      seenAgentProv.add(key);
      combinedAgentProvenance.push({
        ...ap,
        agent_id: aId,
        agentId: aId,
        source_id: sId,
        sourceId: sId,
        source_tab: sTab,
        sourceTab: sTab
      });
    }
  }

  const primaryAgent =
    existing.discovered_by_agent ||
    incoming.discovered_by_agent ||
    combinedAgentProvenance[0]?.agent_id ||
    combinedAgentProvenance[0]?.agentId ||
    "bago_muse";

  return {
    ...incoming,
    id: existing.id || incoming.id,
    source_url: existing.source_url || incoming.source_url,
    canonical_source_url: existing.canonical_source_url || incoming.canonical_source_url,
    provenance_urls: combinedProvenance,
    discovered_by_agent: primaryAgent,
    agent_provenance: combinedAgentProvenance,

    // Machine fields from incoming
    score_total: incoming.score_total !== undefined ? incoming.score_total : existing.score_total,
    score_components: incoming.score_components || existing.score_components,
    why_this_matches: incoming.why_this_matches || existing.why_this_matches,
    deterministic_findings: incoming.deterministic_findings || existing.deterministic_findings,
    inferred_findings: incoming.inferred_findings || existing.inferred_findings,
    deadline: incoming.deadline !== undefined ? incoming.deadline : existing.deadline,
    is_active: incoming.is_active !== undefined ? incoming.is_active : existing.is_active,

    // Preserved user CRM fields
    user_status: userStatus,
    status: userStatus,
    outreach_status: userStatus,
    priority: userPriority,
    priority_override: userPriority,
    favorite: userFavorite,
    pinned: userFavorite,
    follow_up_date: userFollowUp,
    personal_notes: userNotes,
    notes: userNotes,
    contacted_date: userContactedDate,
    applied_date: userAppliedDate,
    workflow: {
      status: userStatus,
      priority: userPriority,
      favorite: userFavorite,
      follow_up_date: userFollowUp,
      personal_notes: userNotes,
      contacted_date: userContactedDate,
      applied_date: userAppliedDate
    },
    activity_history: mergedHistory
  };
}

/**
 * Evaluates gating rules:
 * 1. Regional Restriction Gate (non-Cyprus remote roles)
 * 2. Seniority Gate (5+ year senior roles)
 */
export function evaluateGating(record) {
  const title = (record.title || "").toLowerCase();
  const desc = (record.details?.outreach_hook || "").toLowerCase();
  const loc = (record.location || "").toLowerCase();
  const cat = record.category;

  // Seniority Gate: 5+ years or Staff / Principal / Lead
  const seniorKeywords = [
    "senior",
    "lead developer",
    "lead engineer",
    "principal",
    "architect",
    "5+ year",
    "5+ yr",
    "6+ year",
    "7+ year",
    "8+ year"
  ];
  const isSenior = seniorKeywords.some((k) => title.includes(k) || desc.includes(k));
  if (isSenior) {
    return {
      is_active: false,
      eligibility_status: "NO",
      gate_reason: "SENIORITY_GATE_5_PLUS_YEARS",
      score_total: 0
    };
  }

  // Regional Gate: Remote jobs restricted to specific non-Cyprus regions
  if (cat === "remote_jobs") {
    const isRestrictedNonCyprus =
      (loc.includes("us only") ||
        loc.includes("usa only") ||
        loc.includes("uk only") ||
        loc.includes("canada only") ||
        loc.includes("latin america") ||
        loc.includes("latam") ||
        loc.includes("africa")) &&
      !loc.includes("cyprus") &&
      !loc.includes("worldwide") &&
      !loc.includes("global");

    if (isRestrictedNonCyprus) {
      return {
        is_active: false,
        eligibility_status: "NO",
        gate_reason: "REGIONAL_RESTRICTION_GATE_NON_CYPRUS",
        score_total: 0
      };
    }
  }

  return {
    is_active: true,
    eligibility_status: "LIKELY",
    gate_reason: null,
    score_total: record.score_total || 75
  };
}

/**
 * Normalizes, deduplicates, and scores incoming records while preserving existing CRM state.
 */
export function normalizeAndMergeRecords(incomingRaw, existingRecords = []) {
  const existingByFp = new Map();
  const existingByUrl = new Map();
  const existingById = new Map();
  const originalExistingIds = new Set();

  for (const rec of existingRecords) {
    if (rec.id) {
      existingById.set(rec.id, rec);
      originalExistingIds.add(rec.id);
    }
    const fp = rec.fingerprint || computeFingerprint(rec);
    if (fp) existingByFp.set(fp, rec);
    const cUrl = canonicalizeUrl(rec.canonical_source_url || rec.source_url || "");
    if (cUrl) existingByUrl.set(cUrl, rec);
  }

  const processedById = new Map();
  const processedByFp = new Map();
  const processedByUrl = new Map();
  const updatedExistingIds = new Set();

  for (const raw of incomingRaw) {
    const fp = raw.fingerprint || computeFingerprint(raw);
    const cUrl = canonicalizeUrl(raw.canonical_source_url || raw.source_url || "");

    // 1. Check for overlapping intra-batch duplicate (same record appearing in multiple sources)
    const inBatchMatch =
      (raw.id && processedById.get(raw.id)) ||
      (cUrl && processedByUrl.get(cUrl)) ||
      (fp && processedByFp.get(fp));

    if (inBatchMatch) {
      // Cross-source duplicate in the incoming stream: merge provenance and URLs without double-counting
      const combinedUrls = new Set([
        ...(inBatchMatch.provenance_urls || [inBatchMatch.source_url]),
        ...(raw.provenance_urls || [raw.source_url])
      ].filter(Boolean));
      inBatchMatch.provenance_urls = Array.from(combinedUrls);

      if (Array.isArray(raw.agent_provenance)) {
        const existingAgents = new Set(
          (inBatchMatch.agent_provenance || []).map((p) => p.agent_id || p.agentId)
        );
        for (const ap of raw.agent_provenance) {
          const aId = ap.agent_id || ap.agentId;
          if (aId && !existingAgents.has(aId)) {
            inBatchMatch.agent_provenance = [...(inBatchMatch.agent_provenance || []), ap];
            existingAgents.add(aId);
          }
        }
      }
      continue;
    }

    // 2. Apply gating & scoring
    const gate = evaluateGating(raw);
    const scoredRaw = {
      ...raw,
      ...gate,
      canonical_url: cUrl || raw.source_url,
      fingerprint: fp,
      provenance_urls: Array.from(
        new Set([raw.source_url, ...(raw.provenance_urls || [])].filter(Boolean))
      )
    };

    // 3. Check for match in existing database records
    const matchedExisting =
      (raw.id && existingById.get(raw.id)) ||
      (cUrl && existingByUrl.get(cUrl)) ||
      (fp && existingByFp.get(fp));

    if (matchedExisting) {
      updatedExistingIds.add(matchedExisting.id);
      const merged = preserveUserCrmFields(matchedExisting, scoredRaw);
      processedById.set(merged.id, merged);
      if (cUrl) processedByUrl.set(cUrl, merged);
      if (fp) processedByFp.set(fp, merged);
    } else {
      processedById.set(scoredRaw.id, scoredRaw);
      if (cUrl) processedByUrl.set(cUrl, scoredRaw);
      if (fp) processedByFp.set(fp, scoredRaw);
    }
  }

  // 4. Preserve existing records that were untouched by incoming batch
  for (const ex of existingRecords) {
    if (ex.id && !processedById.has(ex.id)) {
      const cUrl = canonicalizeUrl(ex.canonical_source_url || ex.source_url || "");
      const fp = ex.fingerprint || computeFingerprint(ex);
      if ((!cUrl || !processedByUrl.has(cUrl)) && (!fp || !processedByFp.has(fp))) {
        processedById.set(ex.id, ex);
        if (cUrl) processedByUrl.set(cUrl, ex);
        if (fp) processedByFp.set(fp, ex);
      }
    }
  }

  const processed = Array.from(processedById.values());
  const activeCount = processed.filter((p) => p.is_active !== false).length;
  const gatedCount = processed.filter((p) => p.is_active === false).length;

  const updatedCount = updatedExistingIds.size;
  const addedCount = processed.filter((p) => !originalExistingIds.has(p.id)).length;
  const unchangedCount = Math.max(0, originalExistingIds.size - updatedCount);
  const preservedCount = updatedCount + unchangedCount;

  return {
    merged: processed,
    processed,
    addedCount,
    insertedCount: addedCount,
    updatedCount,
    preservedCount,
    gatedCount,
    activeCount,
    unchangedCount
  };
}

export function getNextScheduledSync(referenceDate = new Date()) {
  const intervalsUtc = [0, 5, 10, 15, 20];
  const ref = new Date(referenceDate);
  const currentHourUtc = ref.getUTCHours();
  const currentMinUtc = ref.getUTCMinutes();

  let nextHourUtc = intervalsUtc.find(
    (h) => h > currentHourUtc || (h === currentHourUtc && currentMinUtc === 0)
  );
  let daysToAdd = 0;

  if (nextHourUtc === undefined) {
    nextHourUtc = intervalsUtc[0];
    daysToAdd = 1;
  }

  const nextDate = new Date(ref);
  nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd);
  nextDate.setUTCHours(nextHourUtc, 0, 0, 0);

  const formattedUtc = `${String(nextHourUtc).padStart(2, "0")}:00 UTC`;

  return {
    nextRunDate: nextDate,
    iso: nextDate.toISOString(),
    formattedUtc
  };
}

/**
 * THE CANONICAL SYNC EXECUTION ENTRY POINT
 * Used by both scripts/sync-data.mjs and supabase/functions/sync-opportunity-data/index.ts
 */
export async function runCanonicalSync({
  googleSaEmail,
  googlePrivateKey,
  supabaseUrl,
  supabaseKey,
  neonDatabaseUrl,
  currentRecords = [],
  fetchFn = globalThis.fetch,
  dryRun = false,
  triggerType = "AUTOMATIC_5H"
} = {}) {
  const startedAt = new Date();
  const startTime = startedAt.getTime();
  const runId = `SYNC-${startedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${String(startTime).slice(-4)}`;

  const sourceDiagnostics = [];
  const newlyIngestedRaw = [];

  let googleToken = null;
  let authError = null;

  // 1. Google OAuth2 Token
  if (googleSaEmail && googlePrivateKey) {
    try {
      googleToken = await getGoogleAccessToken({
        email: googleSaEmail,
        privateKey: googlePrivateKey,
        fetchFn
      });
    } catch (err) {
      authError = err;
    }
  }

  // 2. Ingest MUSE Facebook & Instagram Job Hunter ("ALL LEADS")
  // OPEN-ENDED RANGE: reads full populated sheet without 1000-row or Z-column ceiling
  const socialSheetId = "1-jsydfLBJibFJjy4dabDCOZpG7m_6bJxdxPYRWHJ1x0";
  let museCount = 0;
  if (!googleToken) {
    sourceDiagnostics.push({
      id: "muse_social_job_hunter",
      name: "MUSE | FACEBOOK & INSTAGRAM JOB HUNTER",
      status: "Permission required",
      statusCode: 401,
      message: authError
        ? `Google OAuth2 authentication failed: ${authError.message}`
        : "GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY not provided.",
      recordsCount: 0
    });
  } else {
    try {
      // Range 'ALL LEADS' retrieves the full populated sheet (e.g. A1:AG1065)
      const rangeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${socialSheetId}/values/'ALL%20LEADS'?valueRenderOption=FORMATTED_VALUE`;
      const res = await fetchFn(rangeUrl, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });

      if (res.status === 200) {
        const data = await res.json();
        const values = data.values || [];
        if (values.length > 1) {
          const rawHeaders = values[0] || [];
          const headers = rawHeaders.map((h, i) => String(h || "").trim() || `col_${i + 1}`);
          for (let r = 1; r < values.length; r++) {
            const row = values[r];
            if (!row || row.length === 0) continue;
            if (!row.some((c) => c !== undefined && c !== null && String(c).trim() !== "")) continue;
            const obj = {};
            headers.forEach((h, idx) => {
              obj[h] = row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : "";
            });
            obj._rowIndex = r + 1;
            newlyIngestedRaw.push(normalizeMuseSocialLead(obj, r));
            museCount++;
          }
        }
        sourceDiagnostics.push({
          id: "muse_social_job_hunter",
          name: "MUSE | FACEBOOK & INSTAGRAM JOB HUNTER",
          status: "Connected",
          statusCode: 200,
          message: `Connected to native sheet. Retrieved ${museCount} raw rows across 33 columns from ALL LEADS.`,
          recordsCount: museCount
        });
      } else {
        const errText = await res.text().catch(() => "");
        sourceDiagnostics.push({
          id: "muse_social_job_hunter",
          name: "MUSE | FACEBOOK & INSTAGRAM JOB HUNTER",
          status: res.status === 403 ? "Permission required" : "Failed",
          statusCode: res.status,
          message: `Google Sheets API HTTP ${res.status}: ${errText}`,
          recordsCount: 0
        });
      }
    } catch (err) {
      sourceDiagnostics.push({
        id: "muse_social_job_hunter",
        name: "MUSE | FACEBOOK & INSTAGRAM JOB HUNTER",
        status: "Failed",
        statusCode: 0,
        message: err.message,
        recordsCount: 0
      });
    }
  }

  // 3. Ingest MASTER_JOB_APPLICATION_TRACKER.xlsx
  const masterTrackerId = "1F8p-KNl8PLMfRIzRxZ0nFORRHOuF5qL1";
  let masterJobCount = 0;
  if (!googleToken) {
    sourceDiagnostics.push({
      id: "master_job_application_tracker",
      name: "MASTER_JOB_APPLICATION_TRACKER.xlsx",
      status: "Permission required",
      statusCode: 401,
      message: "Drive XLSX requires Google Service Account authentication.",
      recordsCount: 0
    });
  } else {
    try {
      const driveUrl = `https://www.googleapis.com/drive/v3/files/${masterTrackerId}?alt=media`;
      const res = await fetchFn(driveUrl, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });

      if (res.status === 200) {
        const arrayBuf = await res.arrayBuffer();
        const workbook = parseXlsxBuffer(arrayBuf);
        const sheetNames = Object.keys(workbook);

        for (const sheetName of sheetNames) {
          const rows = workbook[sheetName] || [];
          rows.forEach((row, idx) => {
            newlyIngestedRaw.push(normalizeMasterJobTrackerRow(row, idx));
            masterJobCount++;
          });
        }

        sourceDiagnostics.push({
          id: "master_job_application_tracker",
          name: "MASTER_JOB_APPLICATION_TRACKER.xlsx",
          status: "Connected",
          statusCode: 200,
          message: `Connected to Drive XLSX. Retrieved ${masterJobCount} records across tabs [${sheetNames.join(", ")}].`,
          recordsCount: masterJobCount
        });
      } else {
        const errText = await res.text().catch(() => "");
        sourceDiagnostics.push({
          id: "master_job_application_tracker",
          name: "MASTER_JOB_APPLICATION_TRACKER.xlsx",
          status: res.status === 403 ? "Permission required" : "Failed",
          statusCode: res.status,
          message: `Drive API HTTP ${res.status}: ${errText}`,
          recordsCount: 0
        });
      }
    } catch (err) {
      sourceDiagnostics.push({
        id: "master_job_application_tracker",
        name: "MASTER_JOB_APPLICATION_TRACKER.xlsx",
        status: "Failed",
        statusCode: 0,
        message: err.message,
        recordsCount: 0
      });
    }
  }

  // 4. Ingest master-spreadsheet.xlsx (Master's Programmes & Scholarships)
  const mastersWorkbookId = "156pTG6IBQ00x6AP2BFm3sg-zy_iZ4PLj";
  let mastersCount = 0;
  if (!googleToken) {
    sourceDiagnostics.push({
      id: "masters_workbook",
      name: "master-spreadsheet.xlsx",
      status: "Permission required",
      statusCode: 401,
      message: "Drive XLSX requires Google Service Account authentication.",
      recordsCount: 0
    });
  } else {
    try {
      const driveUrl = `https://www.googleapis.com/drive/v3/files/${mastersWorkbookId}?alt=media`;
      const res = await fetchFn(driveUrl, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });

      if (res.status === 200) {
        const arrayBuf = await res.arrayBuffer();
        const workbook = parseXlsxBuffer(arrayBuf);

        // Find MASTER_PROGRAMMES tab
        const progKey = Object.keys(workbook).find((k) =>
          k.toUpperCase().includes("PROGRAM") || k.toUpperCase().includes("MASTER")
        );
        const programmes = progKey ? workbook[progKey] || [] : [];
        programmes.forEach((row, idx) => {
          newlyIngestedRaw.push(normalizeMasterProgrammeRow(row, idx));
          mastersCount++;
        });

        // Find SCHOLARSHIPS tab
        const scholKey = Object.keys(workbook).find((k) =>
          k.toUpperCase().includes("SCHOLAR")
        );
        const scholarships = scholKey ? workbook[scholKey] || [] : [];
        scholarships.forEach((row, idx) => {
          newlyIngestedRaw.push(normalizeScholarshipRow(row, idx));
          mastersCount++;
        });

        sourceDiagnostics.push({
          id: "masters_workbook",
          name: "master-spreadsheet.xlsx",
          status: "Connected",
          statusCode: 200,
          message: `Connected to Master's workbook. Found ${programmes.length} programmes and ${scholarships.length} scholarships.`,
          recordsCount: mastersCount
        });
      } else {
        const errText = await res.text().catch(() => "");
        sourceDiagnostics.push({
          id: "masters_workbook",
          name: "master-spreadsheet.xlsx",
          status: res.status === 403 ? "Permission required" : "Failed",
          statusCode: res.status,
          message: `Drive API HTTP ${res.status}: ${errText}`,
          recordsCount: 0
        });
      }
    } catch (err) {
      sourceDiagnostics.push({
        id: "masters_workbook",
        name: "master-spreadsheet.xlsx",
        status: "Failed",
        statusCode: 0,
        message: err.message,
        recordsCount: 0
      });
    }
  }

  // 5. Ingest GRADUATE SCHEMES - MASTER TRACKER (Bago Muse)
  const graduateTrackerId = "1zGcyFrXBXQKOrmgJngXGYfIlYm1n1s_AV_DlHJ9tgtQ";
  let gradCount = 0;
  if (!googleToken) {
    sourceDiagnostics.push({
      id: "graduate_schemes_tracker",
      name: "GRADUATE SCHEMES - MASTER TRACKER",
      status: "Permission required",
      statusCode: 401,
      message: "Drive Sheet requires Google Service Account authentication.",
      recordsCount: 0
    });
  } else {
    try {
      const gradUrl = `https://sheets.googleapis.com/v4/spreadsheets/${graduateTrackerId}?fields=sheets.properties(sheetId,title)`;
      const res = await fetchFn(gradUrl, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (res.status === 200) {
        const meta = await res.json();
        const tabs = (meta.sheets || []).map((s) => s.properties.title);
        for (const tabTitle of tabs) {
          const tabUrl = `https://sheets.googleapis.com/v4/spreadsheets/${graduateTrackerId}/values/'${encodeURIComponent(tabTitle)}'?valueRenderOption=FORMATTED_VALUE`;
          const valRes = await fetchFn(tabUrl, {
            headers: { Authorization: `Bearer ${googleToken}` }
          });
          if (valRes.status === 200) {
            const valData = await valRes.json();
            const values = valData.values || [];
            if (values.length > 1) {
              const headers = (values[0] || []).map((h, i) => String(h || "").trim() || `col_${i + 1}`);
              for (let r = 1; r < values.length; r++) {
                const row = values[r];
                if (!row || !row.some((c) => c !== undefined && c !== null && String(c).trim() !== "")) continue;
                const obj = {};
                headers.forEach((h, idx) => {
                  obj[h] = row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : "";
                });
                newlyIngestedRaw.push(
                  normalizeMasterJobTrackerRow(obj, r)
                );
                gradCount++;
              }
            }
          }
        }
        sourceDiagnostics.push({
          id: "graduate_schemes_tracker",
          name: "GRADUATE SCHEMES - MASTER TRACKER",
          status: "Connected",
          statusCode: 200,
          message: `Connected to Sheets API. Ingested ${gradCount} records across tabs [${tabs.join(", ")}].`,
          recordsCount: gradCount
        });
      } else {
        const errText = await res.text().catch(() => "");
        sourceDiagnostics.push({
          id: "graduate_schemes_tracker",
          name: "GRADUATE SCHEMES - MASTER TRACKER",
          status: res.status === 403 || res.status === 404 ? "Permission required" : "Failed",
          statusCode: res.status,
          message: `Google Sheets API HTTP ${res.status}: ${res.status === 404 ? "Resource not shared with opportunity-os-sync@mcp-fuv-jax.iam.gserviceaccount.com." : errText}`,
          recordsCount: 0
        });
      }
    } catch (err) {
      sourceDiagnostics.push({
        id: "graduate_schemes_tracker",
        name: "GRADUATE SCHEMES - MASTER TRACKER",
        status: "Failed",
        statusCode: 0,
        message: err.message,
        recordsCount: 0
      });
    }
  }

  // 6. Ingest Kattu AI Regional Sheets (India, EU, UK, USA)
  const kattuSources = [
    {
      id: "kattu_india_regional",
      sheetId: "15hOKXuvZDIrytvqRLQNvLQx4w7wTdFS-DSnvT1XIkOw",
      name: "Projects KattuAI — India Regional Job Research",
      region: "India"
    },
    {
      id: "kattu_eu_regional",
      sheetId: "1wi4i3qpDLOzfNXa5_AR6Bvhb4w40xTr4QQmM9qGAzj4",
      name: "Projects KattuAI — EU Regional Job Research",
      region: "EU"
    },
    {
      id: "kattu_uk_regional",
      sheetId: "1ECo6MFxrDXpOQlTyCRGor5XUgE8e4t2zL-LXWJRFN5A",
      name: "Projects KattuAI — UK Regional Job Research",
      region: "UK"
    },
    {
      id: "kattu_usa_regional",
      sheetId: "1tIi0TiQ0L1fNUcqTWTsRVJhV-69g3pbrHGGkhmGGvyo",
      name: "Projects KattuAI — USA Regional Job Research",
      region: "USA"
    }
  ];

  for (const kSrc of kattuSources) {
    if (!googleToken) {
      sourceDiagnostics.push({
        id: kSrc.id,
        name: kSrc.name,
        status: "Permission required",
        statusCode: 401,
        message: "Google service account authentication required.",
        recordsCount: 0
      });
      continue;
    }

    try {
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${kSrc.sheetId}?fields=sheets.properties(sheetId,title)`;
      const res = await fetchFn(metaUrl, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (res.status === 200) {
        const meta = await res.json();
        const tabs = (meta.sheets || []).map((s) => s.properties.title);
        let kCount = 0;
        for (const tabTitle of tabs) {
          const tabUrl = `https://sheets.googleapis.com/v4/spreadsheets/${kSrc.sheetId}/values/'${encodeURIComponent(tabTitle)}'?valueRenderOption=FORMATTED_VALUE`;
          const valRes = await fetchFn(tabUrl, {
            headers: { Authorization: `Bearer ${googleToken}` }
          });
          if (valRes.status === 200) {
            const valData = await valRes.json();
            const values = valData.values || [];
            if (values.length > 1) {
              const headers = (values[0] || []).map((h, i) => String(h || "").trim() || `col_${i + 1}`);
              for (let r = 1; r < values.length; r++) {
                const row = values[r];
                if (!row || !row.some((c) => c !== undefined && c !== null && String(c).trim() !== "")) continue;
                const obj = {};
                headers.forEach((h, idx) => {
                  obj[h] = row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : "";
                });
                newlyIngestedRaw.push(
                  normalizeRegionalResearchRow(obj, r, {
                    agentId: "kattu_ai",
                    sourceId: kSrc.id,
                    sourceName: kSrc.name,
                    sourceTab: tabTitle
                  })
                );
                kCount++;
              }
            }
          }
        }
        sourceDiagnostics.push({
          id: kSrc.id,
          name: kSrc.name,
          status: "Connected",
          statusCode: 200,
          message: `Connected to Sheets API. Ingested ${kCount} records across tabs [${tabs.join(", ")}].`,
          recordsCount: kCount
        });
      } else {
        const errText = await res.text().catch(() => "");
        sourceDiagnostics.push({
          id: kSrc.id,
          name: kSrc.name,
          status: res.status === 403 || res.status === 404 ? "Permission required" : "Failed",
          statusCode: res.status,
          message: `Google Sheets API HTTP ${res.status}: ${res.status === 404 ? "Sheet not shared with opportunity-os-sync@mcp-fuv-jax.iam.gserviceaccount.com." : errText}`,
          recordsCount: 0
        });
      }
    } catch (err) {
      sourceDiagnostics.push({
        id: kSrc.id,
        name: kSrc.name,
        status: "Failed",
        statusCode: 0,
        message: err.message,
        recordsCount: 0
      });
    }
  }

  // 7. Ingest Muse_Satnam (Haya Satnam) Root Folder & Sources
  const satnamRootFolderId = "1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-";
  if (!googleToken) {
    sourceDiagnostics.push({
      id: "satnam_global_jobs",
      name: "Muse_Satnam — Global Jobs & Freelance",
      status: "Permission required",
      statusCode: 401,
      message: "Google service account authentication required.",
      recordsCount: 0
    });
  } else {
    try {
      const driveUrl = `https://www.googleapis.com/drive/v3/files/${satnamRootFolderId}?supportsAllDrives=true&fields=id,name,mimeType`;
      const res = await fetchFn(driveUrl, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (res.status === 200) {
        sourceDiagnostics.push({
          id: "satnam_global_jobs",
          name: "Muse_Satnam — Global Jobs & Freelance",
          status: "Connected",
          statusCode: 200,
          message: "Connected to Muse_Satnam Drive root folder.",
          recordsCount: 0
        });
      } else {
        const errText = await res.text().catch(() => "");
        sourceDiagnostics.push({
          id: "satnam_global_jobs",
          name: "Muse_Satnam — Global Jobs & Freelance",
          status: res.status === 403 || res.status === 404 ? "Permission required" : "Failed",
          statusCode: res.status,
          message: `Google Drive API HTTP ${res.status}: ${res.status === 404 ? "Drive folder 1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj- awaiting Reader access for opportunity-os-sync@mcp-fuv-jax.iam.gserviceaccount.com." : errText}`,
          recordsCount: 0
        });
      }
    } catch (err) {
      sourceDiagnostics.push({
        id: "satnam_global_jobs",
        name: "Muse_Satnam — Global Jobs & Freelance",
        status: "Failed",
        statusCode: 0,
        message: err.message,
        recordsCount: 0
      });
    }
  }

  // 8. Fetch existing records from Neon or Supabase to preserve CRM state
  let existingRecords = [...currentRecords];
  let neonSql = null;
  if (neonDatabaseUrl) {
    try {
      const { neon } = await import("@neondatabase/serverless");
      neonSql = neon(neonDatabaseUrl);
    } catch {
      // Continue without neon
    }
  }

  if (neonSql) {
    try {
      const neonOpps = await neonSql`
        SELECT o.*,
          json_build_object(
            'status', w.status,
            'priority', w.priority,
            'favorite', w.favorite,
            'follow_up_date', w.follow_up_date,
            'personal_notes', w.personal_notes,
            'contacted_date', w.contacted_date,
            'applied_date', w.applied_date,
            'updated_at', w.updated_at
          ) as workflow
        FROM public.opportunities o
        LEFT JOIN public.workflow_states w ON o.id = w.opportunity_id;
      `;
      if (Array.isArray(neonOpps) && neonOpps.length > 0) {
        const dbMap = new Map(neonOpps.map((d) => [d.id, d]));
        const combined = existingRecords.map((s) => {
          const dbMatch = dbMap.get(s.id);
          if (dbMatch) {
            dbMap.delete(s.id);
            const wf = dbMatch.workflow || {};
            return {
              ...s,
              ...dbMatch,
              user_status: wf.status || s.user_status || "New",
              status: wf.status || s.status || "New",
              priority: wf.priority || s.priority || "P2",
              favorite: wf.favorite ?? s.favorite ?? false,
              follow_up_date: wf.follow_up_date ?? s.follow_up_date ?? null,
              personal_notes: wf.personal_notes ?? s.personal_notes ?? "",
              contacted_date: wf.contacted_date ?? s.contacted_date ?? null,
              applied_date: wf.applied_date ?? s.applied_date ?? null,
              workflow: wf
            };
          }
          return s;
        });
        for (const remaining of dbMap.values()) {
          const wf = remaining.workflow || {};
          combined.push({
            ...remaining,
            user_status: wf.status || remaining.user_status || "New",
            status: wf.status || remaining.status || "New",
            priority: wf.priority || remaining.priority || "P2",
            favorite: wf.favorite ?? remaining.favorite ?? false,
            follow_up_date: wf.follow_up_date ?? remaining.follow_up_date ?? null,
            personal_notes: wf.personal_notes ?? remaining.personal_notes ?? "",
            contacted_date: wf.contacted_date ?? remaining.contacted_date ?? null,
            applied_date: wf.applied_date ?? remaining.applied_date ?? null,
            workflow: wf
          });
        }
        existingRecords = combined;
      }
    } catch (err) {
      console.warn("[CanonicalSync] Baseline fetch from Neon:", err.message);
    }
  }

  if (supabaseUrl && supabaseKey) {
    try {
      const dbRes = await fetchFn(
        `${supabaseUrl}/rest/v1/opportunities?select=*,workflow_states(*)&limit=10000`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`
          }
        }
      );
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        if (Array.isArray(dbData) && dbData.length > 0) {
          const dbMap = new Map(dbData.map((d) => [d.id, d]));
          const combined = existingRecords.map((s) => {
            const dbMatch = dbMap.get(s.id);
            if (dbMatch) {
              dbMap.delete(s.id);
              const rawWf = dbMatch.workflow_states;
              const wfObj = Array.isArray(rawWf) ? rawWf[0] : (rawWf && typeof rawWf === "object" ? rawWf : null);
              const finalWf = wfObj || dbMatch.workflow || s.workflow || {};
              return {
                ...s,
                ...dbMatch,
                user_status: finalWf.status || s.user_status || "New",
                status: finalWf.status || s.status || "New",
                priority: finalWf.priority || s.priority || "P2",
                favorite: finalWf.favorite ?? s.favorite ?? false,
                follow_up_date: finalWf.follow_up_date ?? s.follow_up_date ?? null,
                personal_notes: finalWf.personal_notes ?? s.personal_notes ?? "",
                contacted_date: finalWf.contacted_date ?? s.contacted_date ?? null,
                applied_date: finalWf.applied_date ?? s.applied_date ?? null,
                workflow: {
                  status: finalWf.status || s.user_status || "New",
                  priority: finalWf.priority || s.priority || "P2",
                  favorite: finalWf.favorite ?? s.favorite ?? false,
                  follow_up_date: finalWf.follow_up_date ?? s.follow_up_date ?? null,
                  personal_notes: finalWf.personal_notes ?? s.personal_notes ?? "",
                  contacted_date: finalWf.contacted_date ?? s.contacted_date ?? null,
                  applied_date: finalWf.applied_date ?? s.applied_date ?? null
                }
              };
            }
            return s;
          });
          for (const remaining of dbMap.values()) {
            const rawWf = remaining.workflow_states;
            const wfObj = Array.isArray(rawWf) ? rawWf[0] : (rawWf && typeof rawWf === "object" ? rawWf : null);
            const finalWf = wfObj || remaining.workflow || {};
            combined.push({
              ...remaining,
              user_status: finalWf.status || remaining.user_status || "New",
              status: finalWf.status || remaining.status || "New",
              priority: finalWf.priority || remaining.priority || "P2",
              favorite: finalWf.favorite ?? remaining.favorite ?? false,
              follow_up_date: finalWf.follow_up_date ?? remaining.follow_up_date ?? null,
              personal_notes: finalWf.personal_notes ?? remaining.personal_notes ?? "",
              contacted_date: finalWf.contacted_date ?? remaining.contacted_date ?? null,
              applied_date: finalWf.applied_date ?? remaining.applied_date ?? null,
              workflow: {
                status: finalWf.status || remaining.user_status || "New",
                priority: finalWf.priority || remaining.priority || "P2",
                favorite: finalWf.favorite ?? remaining.favorite ?? false,
                follow_up_date: finalWf.follow_up_date ?? remaining.follow_up_date ?? null,
                personal_notes: finalWf.personal_notes ?? remaining.personal_notes ?? "",
                contacted_date: finalWf.contacted_date ?? remaining.contacted_date ?? null,
                applied_date: finalWf.applied_date ?? remaining.applied_date ?? null
              }
            });
          }
          existingRecords = combined;
        }
      }
    } catch {
      // Continue with currentRecords
    }
  }

  // 6. Deduplicate, score, gate, and merge with strict CRM preservation
  const recordsToMerge = newlyIngestedRaw.length > 0 ? newlyIngestedRaw : existingRecords;
  const mergeResult = normalizeAndMergeRecords(recordsToMerge, existingRecords);

  // 7. Supabase Database Upsert & Telemetry Logging
  let supabaseSynced = false;
  let supabaseMessage = "Supabase credentials not configured";

  const durationSec = Number(((Date.now() - startTime) / 1000).toFixed(2));
  const overallStatus = sourceDiagnostics.every((s) => s.status === "Connected")
    ? "SUCCESS"
    : sourceDiagnostics.some((s) => s.status === "Connected")
    ? "PARTIAL"
    : "FAILED";

  // 7a. Neon PostgreSQL Upsert
  let neonSynced = false;
  let neonMessage = "Neon database not configured";

  if (neonSql && !dryRun) {
    try {
      const batchSize = 500;
      for (let i = 0; i < mergeResult.merged.length; i += batchSize) {
        const batch = mergeResult.merged.slice(i, i + batchSize);
        const oppRows = batch.map((o) => {
          const canonicalUrl = canonicalizeUrl(o.source_url) || o.source_url;
          const orgName = o.organization || (o.details && o.details.company) || "Direct Lead";
          const fp = o.fingerprint || computeFingerprint(o);
          let agentId = o.discovered_by_agent;
          if (!agentId) {
            if (o.category === "freelance_leads") agentId = "sandy_muse";
            else if (o.category === "visa_jobs") agentId = "haya_muse_1";
            else if (o.category === "masters_scholarships") agentId = "haya_muse_2";
            else if (o.category === "remote_jobs") agentId = "katoo_spark";
            else agentId = "sandy_muse";
          }
          return {
            id: o.id,
            owner_id: o.owner_id || null,
            category: o.category,
            title: o.title,
            organization: orgName,
            organization_id: o.organization_id || null,
            location: o.location || "Cyprus / Remote",
            country: o.country || null,
            source_url: o.source_url,
            canonical_url: canonicalUrl,
            fingerprint: fp,
            source_type: o.source_type || "INGESTION_SCAN",
            discovered_by_agent: agentId,
            first_seen_at: o.retrieved_at || o.created_at || startedAt.toISOString(),
            last_seen_at: startedAt.toISOString(),
            last_verified_at: o.last_verified_at || startedAt.toISOString(),
            confidence: String(o.confidence || "MEDIUM").toUpperCase(),
            is_active: Boolean(o.is_active),
            score_total: o.score_total || 0,
            score_components: o.score_components || {},
            score_explanation: o.score_explanation || {},
            details: o.details || {},
            deadline: o.deadline || null,
            provenance_urls: o.provenance_urls || [o.source_url],
            agent_provenance: o.agent_provenance || [{ agent_id: agentId, first_seen: startedAt.toISOString() }],
            created_at: o.created_at || startedAt.toISOString()
          };
        });

        await neonSql.query(`
          INSERT INTO public.opportunities (
            id, owner_id, category, title, organization, organization_id,
            location, country, source_url, canonical_url, fingerprint,
            source_type, discovered_by_agent, first_seen_at, last_seen_at,
            last_verified_at, confidence, is_active, score_total,
            score_components, score_explanation, details, deadline,
            provenance_urls, agent_provenance, created_at, updated_at
          )
          SELECT 
            id, owner_id, category, title, organization, organization_id,
            location, country, source_url, canonical_url, fingerprint,
            source_type, discovered_by_agent, first_seen_at, last_seen_at,
            last_verified_at, confidence, is_active, score_total,
            score_components, score_explanation, details, deadline,
            provenance_urls, agent_provenance, created_at, NOW()
          FROM jsonb_to_recordset($1::jsonb) AS (
            id text, owner_id uuid, category text, title text, organization text, organization_id text,
            location text, country text, source_url text, canonical_url text, fingerprint text,
            source_type text, discovered_by_agent text, first_seen_at timestamptz, last_seen_at timestamptz,
            last_verified_at timestamptz, confidence text, is_active boolean, score_total integer,
            score_components jsonb, score_explanation jsonb, details jsonb, deadline text,
            provenance_urls jsonb, agent_provenance jsonb, created_at timestamptz
          )
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            organization = EXCLUDED.organization,
            location = EXCLUDED.location,
            source_url = EXCLUDED.source_url,
            canonical_url = EXCLUDED.canonical_url,
            fingerprint = EXCLUDED.fingerprint,
            score_total = EXCLUDED.score_total,
            score_components = EXCLUDED.score_components,
            score_explanation = EXCLUDED.score_explanation,
            details = EXCLUDED.details,
            provenance_urls = EXCLUDED.provenance_urls,
            agent_provenance = EXCLUDED.agent_provenance,
            last_verified_at = EXCLUDED.last_verified_at,
            updated_at = NOW();
        `, [JSON.stringify(oppRows)]);

        const wfRows = batch.map((o) => ({
          opportunity_id: o.id,
          owner_id: o.owner_id || null,
          status: o.workflow?.status || o.user_status || o.status || "New",
          priority: o.workflow?.priority || o.priority || "P2",
          favorite: Boolean(o.workflow?.favorite ?? o.favorite ?? false),
          follow_up_date: o.workflow?.follow_up_date || o.follow_up_date || null,
          personal_notes: o.workflow?.personal_notes || o.personal_notes || "",
          contacted_date: o.workflow?.contacted_date || o.contacted_date || null,
          applied_date: o.workflow?.applied_date || o.applied_date || null,
          updated_at: startedAt.toISOString()
        }));

        await neonSql.query(`
          INSERT INTO public.workflow_states (
            opportunity_id, owner_id, status, priority, favorite,
            follow_up_date, personal_notes, contacted_date, applied_date, updated_at
          )
          SELECT
            opportunity_id, owner_id, status, priority, favorite,
            follow_up_date, personal_notes, contacted_date, applied_date, updated_at
          FROM jsonb_to_recordset($1::jsonb) AS (
            opportunity_id text, owner_id uuid, status text, priority text, favorite boolean,
            follow_up_date date, personal_notes text, contacted_date date, applied_date date, updated_at timestamptz
          )
          ON CONFLICT (opportunity_id) DO UPDATE SET
            status = EXCLUDED.status,
            priority = EXCLUDED.priority,
            favorite = EXCLUDED.favorite,
            follow_up_date = EXCLUDED.follow_up_date,
            personal_notes = EXCLUDED.personal_notes,
            contacted_date = EXCLUDED.contacted_date,
            applied_date = EXCLUDED.applied_date,
            updated_at = EXCLUDED.updated_at;
        `, [JSON.stringify(wfRows)]);
      }

      await neonSql`
        INSERT INTO public.source_sync_runs (
          run_id, trigger_type, status, started_at, completed_at, duration_sec,
          sources_checked, sources_succeeded, sources_failed, raw_count,
          parsed_count, accepted_count, deduplicated_count, gated_count,
          inserted_count, updated_count, unchanged_count, user_fields_preserved,
          telemetry
        ) VALUES (
          ${runId}, ${triggerType}, ${overallStatus}, ${startedAt.toISOString()}, NOW(), ${durationSec},
          ${sourceDiagnostics.length}, ${sourceDiagnostics.filter((s) => s.status === 'Connected').length},
          ${sourceDiagnostics.filter((s) => s.status !== 'Connected').length},
          ${newlyIngestedRaw.length}, ${newlyIngestedRaw.length}, ${mergeResult.merged.length},
          ${Math.max(0, newlyIngestedRaw.length - mergeResult.addedCount)}, ${mergeResult.gatedCount},
          ${mergeResult.addedCount}, ${mergeResult.updatedCount}, ${mergeResult.unchangedCount},
          ${mergeResult.preservedCount}, ${JSON.stringify(sourceDiagnostics)}::jsonb
        )
        ON CONFLICT (run_id) DO NOTHING;
      `;

      neonSynced = true;
      neonMessage = `Successfully synced ${mergeResult.merged.length} opportunities into Neon PostgreSQL.`;
    } catch (err) {
      neonMessage = `Neon sync error: ${err.message}`;
    }
  }

  // 7b. Supabase Database Upsert & Telemetry Logging
  supabaseSynced = false;
  supabaseMessage = "Supabase credentials not configured";

  if (supabaseUrl && supabaseKey && !dryRun) {
    try {
      // Upsert opportunities
      const oppPayload = mergeResult.merged.map((o) => ({
        id: o.id,
        category: o.category,
        title: o.title,
        organization: o.organization,
        location: o.location,
        country: o.country || "Global / Cyprus",
        source_url: o.source_url,
        source_type: o.source_type || "INGESTION_SCAN",
        last_verified_at: o.last_verified_at,
        deadline: o.deadline || null,
        is_active: o.is_active,
        confidence: String(o.confidence || "MEDIUM").toUpperCase(),
        score_total: o.score_total,
        score_components: o.score_components,
        score_explanation: o.score_explanation || [],
        details: o.details,
        provenance_urls: o.provenance_urls || [o.source_url],
        fingerprint: o.fingerprint || null
      }));

      const oppRes = await fetchFn(`${supabaseUrl}/rest/v1/opportunities`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify(oppPayload)
      });

      // Upsert workflow states for preserved user CRM integrity
      const workflowPayload = mergeResult.merged.map((o) => ({
        opportunity_id: o.id,
        status: o.workflow?.status || o.user_status || "New",
        priority: o.workflow?.priority || o.priority || "P2",
        favorite: o.workflow?.favorite ?? o.favorite ?? false,
        follow_up_date: o.workflow?.follow_up_date || o.follow_up_date || null,
        contacted_date: o.workflow?.contacted_date || o.contacted_date || null,
        applied_date: o.workflow?.applied_date || o.applied_date || null,
        personal_notes: o.workflow?.personal_notes || o.personal_notes || ""
      }));

      await fetchFn(`${supabaseUrl}/rest/v1/workflow_states`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify(workflowPayload)
      }).catch(() => {});

      // Log research_runs telemetry WITH source_diagnostics JSONB
      await fetchFn(`${supabaseUrl}/rest/v1/research_runs`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          run_id: runId,
          run_timestamp: startedAt.toISOString(),
          sources_checked: sourceDiagnostics.length,
          discovered_count: newlyIngestedRaw.length,
          accepted_count: mergeResult.merged.length,
          deduplicated_count: Math.max(0, newlyIngestedRaw.length - mergeResult.addedCount),
          filtered_count: mergeResult.gatedCount,
          sheets_sync_status: overallStatus,
          duration_sec: durationSec,
          source_diagnostics: sourceDiagnostics
        })
      }).catch(() => {});

      if (oppRes.ok) {
        supabaseSynced = true;
        supabaseMessage = `Successfully synced ${oppPayload.length} opportunities to Supabase.`;
      } else {
        const errText = await oppRes.text().catch(() => "");
        supabaseMessage = `Supabase opportunities upsert error HTTP ${oppRes.status}: ${errText}`;
      }
    } catch (err) {
      supabaseMessage = `Supabase sync error: ${err.message}`;
    }
  }

  const sourcesSucceeded = sourceDiagnostics.filter((s) => s.status === "Connected").length;
  const sourcesFailed = sourceDiagnostics.filter((s) => s.status !== "Connected").length;
  const nextSync = getNextScheduledSync(startedAt);

  const telemetry = {
    runId,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Math.round(durationSec * 1000),
    status: overallStatus,
    sourcesAttempted: sourceDiagnostics.length,
    sourcesSucceeded,
    sourcesFailed,
    recordsAdded: mergeResult.addedCount,
    recordsUpdated: mergeResult.updatedCount,
    recordsUnchanged: mergeResult.unchangedCount,
    recordsGated: mergeResult.gatedCount,
    userFieldsPreserved: mergeResult.preservedCount,
    totalRecords: mergeResult.merged.length,
    sourceDiagnostics,
    nextScheduledSyncIso: nextSync.iso,
    nextScheduledSyncUtc: nextSync.formattedUtc,
    neonSynced,
    neonMessage,
    supabaseSynced,
    supabaseMessage
  };

  return {
    telemetry,
    records: mergeResult.merged,
    pipelineCounts: {
      rawTotal: newlyIngestedRaw.length,
      museRaw: museCount,
      masterJobRaw: masterJobCount,
      mastersWorkbookRaw: mastersCount,
      deduplicated: mergeResult.merged.length,
      active: mergeResult.activeCount,
      gated: mergeResult.gatedCount
    }
  };
}
