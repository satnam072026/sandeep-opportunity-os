/**
 * Sandeep Opportunity OS — Production Intelligence, Scoring, Queue, Workflow & Sheets Sync Engine
 * Used by both the frontend application, the CLI research runner, and automated tests.
 */

export const USER_OWNED_FIELDS = [
  "user_status",
  "priority",
  "favorite",
  "follow_up_date",
  "personal_notes",
  "contacted_date",
  "applied_date"
];

/**
 * Strips UTM/tracking parameters, lowercases hostname, and removes trailing slashes.
 * @param {string} rawUrl
 * @returns {string}
 */
export function canonicalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const stripParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "source", "igsh", "igshid", "mibextid", "rdid"
    ];
    for (const p of stripParams) {
      parsed.searchParams.delete(p);
    }
    let cleanPath = parsed.pathname.replace(/\/+$/, "");
    if (!cleanPath) cleanPath = "";
    const qs = parsed.searchParams.toString();
    return `${parsed.protocol}//${parsed.hostname}${cleanPath}${qs ? "?" + qs : ""}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/**
 * Deterministic fingerprint from category, normalized organization name, and normalized title.
 * @param {{ category?: string, organization?: string, title?: string }} item
 * @returns {string}
 */
export function computeFingerprint(item) {
  const cat = String(item.category || "unknown").toLowerCase().trim();
  const org = String(item.organization || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const title = String(item.title || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  // If org or title are generic/empty placeholders, include URL or ID to prevent destructive collapse
  const isGenericOrg = !org || ["social community", "direct employer", "not stated", "unknown", "na", "n a"].includes(org);
  const isGenericTitle = !title || ["lead", "job", "software engineer", "developer", "opportunity"].includes(title);
  if (isGenericOrg && isGenericTitle) {
    if (item.source_url) {
      return `${cat}::${org}::${title}::${canonicalizeUrl(item.source_url)}`;
    }
    if (item.id) {
      return `${cat}::${org}::${title}::${item.id}`;
    }
  }

  return `${cat}::${org}::${title}`;
}

/**
 * Deduplicates candidate records by canonical URL or deterministic fingerprint,
 * merging secondary provenance URLs onto the surviving canonical record.
 * @param {Array<Object>} records
 * @returns {{ deduplicated: Array<Object>, mergedCount: number }}
 */
export function deduplicateOpportunities(records) {
  const byFingerprint = new Map();
  const byUrl = new Map();
  let mergedCount = 0;

  for (const raw of records) {
    const canonUrl = canonicalizeUrl(raw.source_url || "");
    const fp = computeFingerprint(raw);
    const existing = byFingerprint.get(fp) || (canonUrl ? byUrl.get(canonUrl) : undefined);

    if (existing) {
      mergedCount += 1;
      const urls = new Set(existing.provenance_urls || [existing.source_url]);
      if (raw.source_url) urls.add(raw.source_url);
      if (Array.isArray(raw.provenance_urls)) {
        for (const u of raw.provenance_urls) urls.add(u);
      }
      existing.provenance_urls = Array.from(urls).filter(Boolean);
    } else {
      const clone = {
        ...raw,
        canonical_url: canonUrl,
        fingerprint: fp,
        provenance_urls: Array.from(
          new Set([raw.source_url, ...(raw.provenance_urls || [])].filter(Boolean))
        )
      };
      byFingerprint.set(fp, clone);
      if (canonUrl) byUrl.set(canonUrl, clone);
    }
  }

  return {
    deduplicated: Array.from(byFingerprint.values()),
    mergedCount
  };
}

/**
 * Enforces non-inferred legal/eligibility defaults and calculates explainable 0-100 score
 * with Seniority Gate (5+ years) and Regional Gate (non-Cyprus/non-EMEA exclusion).
 * @param {Object} record
 * @param {Object} profile
 * @returns {Object}
 */
export function calculateExplainableScore(record, profile = {}) {
  const safeProfile = {
    citizenship: profile.citizenship || "UNKNOWN",
    eu_eea_status: profile.eu_eea_status || "UNKNOWN",
    work_permit_status: profile.work_permit_status || "UNKNOWN"
  };

  const details = record.details || {};
  const yearsRequired = Number(details.years_required || 0);
  const seniorityGated = yearsRequired >= 5 || /\b(senior|lead|principal|staff)\b/i.test(String(record.title || ""));
  const regionRestricted = Boolean(details.region_restricted_out_of_cyprus) ||
    details.region_eligibility === "NO" ||
    details.cyprus_eligibility === "NO" ||
    details.remote_geography_class === "Excluded" ||
    /\b(us-only|africa-only|united states only|nigeria|kenya|egypt only)\b/i.test(
      `${record.title || ""} ${record.location || ""} ${details.remote_boundary || ""}`
    );

  // Never infer legal eligibility if unconfirmed
  let resolvedEligibility = record.eligibility_status || details.eligibility_confidence || details.visa_status || "UNKNOWN";
  if (resolvedEligibility === "CONFIRMED" && details.requires_eu_citizenship && safeProfile.eu_eea_status === "UNKNOWN") {
    resolvedEligibility = "UNKNOWN";
  }

  const components = normalizeScoreComponents(record);
  let rawSum = components.reduce((acc, c) => acc + Number(c.points || 0), 0);
  if (rawSum === 0 && typeof record.score_total === "number") {
    rawSum = record.score_total;
  }

  let penalty = 0;
  let gateReason = null;
  let isActive = record.is_active !== false;

  if (seniorityGated && record.category === "visa_jobs") {
    penalty = Math.max(penalty, 50);
    gateReason = "SENIORITY_GATE_5_PLUS_YEARS";
    isActive = false;
  }

  if (regionRestricted && record.category === "remote_jobs") {
    penalty = Math.max(penalty, 40);
    gateReason = "REGIONAL_RESTRICTION_GATE_NON_CYPRUS";
    resolvedEligibility = "NO";
    isActive = false;
  }

  const finalScore = Math.max(0, Math.min(100, rawSum - penalty));

  return {
    score_total: finalScore,
    is_active: isActive,
    eligibility_status: resolvedEligibility,
    gate_reason: gateReason,
    profile_legal_state: safeProfile
  };
}

function getNicosiaParts(date = new Date()) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Nicosia",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

function getLocalIsoDate(date = new Date()) {
  const parts = getNicosiaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getLocalTimeHHMM(date = new Date()) {
  const parts = getNicosiaParts(date);
  return `${parts.hour}:${parts.minute}`;
}

/**
 * Classifies a follow-up date relative to a reference ISO date (YYYY-MM-DD).
 * @param {string | null | undefined} followUpDate
 * @param {string} referenceDate
 * @returns {"Overdue" | "Due today" | "Tomorrow" | "This week" | "Later" | "No follow-up"}
 */
export function classifyFollowUpBucket(followUpDate, referenceDate = getLocalIsoDate()) {
  if (!followUpDate) return "No follow-up";
  const ref = new Date(`${referenceDate}T00:00:00Z`).getTime();
  const target = new Date(`${String(followUpDate).slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return "No follow-up";
  const diffDays = Math.round((target - ref) / 86400000);
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return "This week";
  return "Later";
}

/**
 * Groups records into Follow-Up Buckets for the Today Command Center and Saved view.
 * @param {Array<Object>} records
 * @param {string} referenceDate
 */
export function bucketFollowUps(records, referenceDate = getLocalIsoDate()) {
  const buckets = {
    "Overdue": [],
    "Due today": [],
    "Tomorrow": [],
    "This week": [],
    "Later": [],
    "No follow-up": []
  };
  for (const r of records) {
    const wf = r.workflow || {};
    const fDate = wf.follow_up_date !== undefined ? wf.follow_up_date : r.follow_up_date;
    const b = classifyFollowUpBucket(fDate, referenceDate);
    buckets[b].push(r);
  }
  return buckets;
}

/**
 * Dynamically ranks opportunities for the Today Command Center combining score,
 * deadline urgency, eligibility confidence, workflow state, and follow-up due date.
 * Excludes gated/inactive records and Archived/Rejected items.
 * @param {Array<Object>} records
 * @param {string} referenceDate
 */
export function buildTodayPriorityQueue(records, referenceDate = getLocalIsoDate()) {
  const active = records.filter((r) => {
    const status = (r.workflow && r.workflow.status) || r.user_status || "New";
    if (status === "Archived" || status === "Rejected" || status === "Won") return false;
    if (r.is_active === false) return false;
    return true;
  });

  const refTime = new Date(`${referenceDate}T00:00:00Z`).getTime();

  const scored = active.map((r) => {
    const wf = r.workflow || {};
    const status = wf.status || r.user_status || "New";
    const priority = wf.priority || r.priority || "P1";
    const followUp = wf.follow_up_date !== undefined ? wf.follow_up_date : r.follow_up_date;
    const bucket = classifyFollowUpBucket(followUp, referenceDate);
    const score = Number(r.score_total || 0);

    let urgencyBoost = 0;
    let actionBadge = "Review Role";
    let actionReason = `${score} fit · Candidate match`;

    // Calculate deadline proximity if deadline exists
    let daysUntilDeadline = null;
    if (r.deadline) {
      const dTime = new Date(`${String(r.deadline).slice(0, 10)}T00:00:00Z`).getTime();
      if (!Number.isNaN(dTime)) {
        daysUntilDeadline = Math.round((dTime - refTime) / 86400000);
      }
    }

    // Derive action strictly from CRM status, follow-up due date, category and deadline
    if (status === "Contacted" || status === "Applied" || status === "Interviewing" || status === "Follow-Up") {
      if (bucket === "Overdue") {
        urgencyBoost += 22;
        actionBadge = "Follow Up";
        const fTime = new Date(`${String(followUp).slice(0, 10)}T00:00:00Z`).getTime();
        const overdueDays = !Number.isNaN(fTime) ? Math.max(1, Math.round((refTime - fTime) / 86400000)) : 1;
        actionReason = overdueDays === 1 ? "Follow-up overdue by 1 day" : `Follow-up overdue by ${overdueDays} days`;
      } else if (bucket === "Due today") {
        urgencyBoost += 18;
        actionBadge = "Follow Up";
        actionReason = "Follow-up scheduled for today";
      } else if (bucket === "Tomorrow") {
        urgencyBoost += 10;
        actionBadge = "Prep Follow-Up";
        actionReason = "Follow-up due tomorrow";
      } else {
        actionBadge = "Track Status";
        actionReason = `Awaiting response · ${status}`;
      }
    } else if (status === "Preparing") {
      urgencyBoost += 14;
      actionBadge = "Complete Application";
      actionReason = daysUntilDeadline !== null && daysUntilDeadline <= 7
        ? `Deadline in ${daysUntilDeadline}d · Complete submission`
        : "Application in progress · Pack ready";
    } else if (daysUntilDeadline !== null && daysUntilDeadline >= 0 && daysUntilDeadline <= 7) {
      // Approaching deadline takes precedence for new/saved records
      urgencyBoost += 16;
      actionBadge = daysUntilDeadline <= 2 ? "Prepare Submission" : "Review Deadline";
      actionReason = daysUntilDeadline === 0
        ? "Deadline expires today"
        : daysUntilDeadline === 1
        ? "Deadline tomorrow"
        : `Deadline in ${daysUntilDeadline} days (${r.deadline})`;
    } else if (r.category === "freelance_leads") {
      if (status === "Saved") {
        urgencyBoost += 8;
        actionBadge = "Contact Lead";
        actionReason = `${score} fit · Saved prospect ready for pitch`;
      } else {
        // New lead
        if (score >= 88) {
          urgencyBoost += 10;
          actionBadge = "Contact Lead";
          actionReason = `${score} fit · High-value prospect with DOM audit findings`;
        } else {
          urgencyBoost += 5;
          actionBadge = "Review Lead";
          actionReason = `${score} fit · Uncontacted commercial lead`;
        }
      }
    } else if (r.category === "masters_scholarships") {
      if (status === "Saved") {
        urgencyBoost += 8;
        actionBadge = "Prepare Submission";
        actionReason = `${score} fit · Saved scholarship target`;
      } else {
        urgencyBoost += 6;
        actionBadge = "Review Programme";
        actionReason = r.details?.tuition_and_coverage || `${score} fit · Check UCLan / Erasmus funding`;
      }
    } else {
      // visa_jobs or remote_jobs
      if (status === "Saved") {
        urgencyBoost += 8;
        actionBadge = "Apply";
        actionReason = `${score} fit · Saved role ready for CV submission`;
      } else {
        // New job
        if (score >= 85) {
          urgencyBoost += 9;
          actionBadge = "Review Role";
          actionReason = `${score} fit · High alignment target`;
        } else {
          urgencyBoost += 4;
          actionBadge = "Check Eligibility";
          actionReason = `${score} fit · Early-career matching role`;
        }
      }
    }

    if (priority === "High" || priority === "P0") urgencyBoost += 7;
    if (wf.favorite || r.favorite) urgencyBoost += 4;

    const queuePriorityScore = score + urgencyBoost;

    return {
      ...r,
      action_badge: actionBadge,
      action_reason: actionReason,
      follow_up_bucket: bucket,
      queue_priority_score: queuePriorityScore
    };
  });

  return scored.sort((a, b) => b.queue_priority_score - a.queue_priority_score);
}

/**
 * Applies a user CRM mutation to an opportunity record, automatically stamping
 * contacted_date or applied_date and appending a genuine timestamped activity event.
 * @param {Object} record
 * @param {Object} patch
 * @param {string} isoDate
 */
export function applyWorkflowTransition(record, patch, isoDate = getLocalIsoDate()) {
  const prevWf = record.workflow || {
    status: record.user_status || "New",
    priority: record.priority || "P1",
    favorite: Boolean(record.favorite),
    follow_up_date: record.follow_up_date || null,
    contacted_date: record.contacted_date || null,
    applied_date: record.applied_date || null,
    personal_notes: record.personal_notes || ""
  };

  const nextWf = { ...prevWf, ...patch };
  const events = Array.isArray(record.activity_history) ? [...record.activity_history] : [];

  const activityTimestamp = `${isoDate} ${getLocalTimeHHMM()}`;

  if (patch.status && patch.status !== prevWf.status) {
    if (patch.status === "Contacted" && !nextWf.contacted_date) {
      nextWf.contacted_date = isoDate;
    }
    if (patch.status === "Applied" && !nextWf.applied_date) {
      nextWf.applied_date = isoDate;
    }
    events.unshift({
      at: activityTimestamp,
      label: `Status updated from ${prevWf.status} to ${patch.status}`
    });
  }

  if (patch.priority && patch.priority !== prevWf.priority) {
    events.unshift({
      at: activityTimestamp,
      label: `Priority set to ${patch.priority}`
    });
  }

  if (patch.follow_up_date !== undefined && patch.follow_up_date !== prevWf.follow_up_date) {
    events.unshift({
      at: activityTimestamp,
      label: patch.follow_up_date ? `Follow-up scheduled for ${patch.follow_up_date}` : "Follow-up cleared"
    });
  }

  if (patch.personal_notes !== undefined && patch.personal_notes !== prevWf.personal_notes) {
    events.unshift({
      at: activityTimestamp,
      label: "Personal CRM note saved"
    });
  }

  return {
    ...record,
    user_status: nextWf.status,
    priority: nextWf.priority,
    favorite: nextWf.favorite,
    follow_up_date: nextWf.follow_up_date,
    contacted_date: nextWf.contacted_date,
    applied_date: nextWf.applied_date,
    personal_notes: nextWf.personal_notes,
    workflow: nextWf,
    activity_history: events
  };
}

/**
 * Idempotent synchronization between canonical database records and Google Sheets rows
 * keyed by persistent Record ID (Column A). Machine fields update; user-owned [USER]
 * CRM fields are strictly preserved.
 * @param {Array<Object>} existingSheetRows
 * @param {Array<Object>} incomingMachineRecords
 */
export function syncDatabaseToSheetRows(existingSheetRows, incomingMachineRecords) {
  const rowMap = new Map();
  const urlMap = new Map();
  const fpMap = new Map();
  const originalExistingIds = new Set();

  for (const row of existingSheetRows) {
    const id = row.record_id || row.id;
    if (id) {
      rowMap.set(id, { ...row, record_id: id });
      originalExistingIds.add(id);
    }
    const cUrl = canonicalizeUrl(row.canonical_source_url || row.source_url || "");
    if (cUrl && id) urlMap.set(cUrl, id);
    const fp = row.fingerprint || computeFingerprint(row);
    if (fp && id) fpMap.set(fp, id);
  }

  const insertedIds = new Set();
  const updatedIds = new Set();
  let preservedUserFields = 0;

  for (const machine of incomingMachineRecords) {
    const id = machine.id || machine.record_id;
    if (!id) continue;
    const cUrl = canonicalizeUrl(machine.canonical_source_url || machine.source_url || "");
    const fp = machine.fingerprint || computeFingerprint(machine);

    const matchedId =
      (rowMap.has(id) ? id : null) ||
      (cUrl ? urlMap.get(cUrl) : null) ||
      (fp ? fpMap.get(fp) : null);

    const existing = matchedId ? rowMap.get(matchedId) : null;

    if (!existing) {
      insertedIds.add(id);
      const wf = machine.workflow || {};
      const newRow = {
        ...machine,
        record_id: id,
        user_status: wf.status || machine.user_status || "New",
        priority: wf.priority || machine.priority || "P1",
        favorite: Boolean(wf.favorite ?? machine.favorite ?? false),
        follow_up_date: wf.follow_up_date ?? machine.follow_up_date ?? null,
        contacted_date: wf.contacted_date ?? machine.contacted_date ?? null,
        applied_date: wf.applied_date ?? machine.applied_date ?? null,
        personal_notes: wf.personal_notes ?? machine.personal_notes ?? ""
      };
      rowMap.set(id, newRow);
      if (cUrl) urlMap.set(cUrl, id);
      if (fp) fpMap.set(fp, id);
    } else {
      const targetId = matchedId || id;
      if (originalExistingIds.has(targetId)) {
        updatedIds.add(targetId);
      }
      const merged = {
        ...existing,
        ...machine,
        record_id: targetId,
        id: targetId
      };
      for (const field of USER_OWNED_FIELDS) {
        if (existing[field] !== undefined && existing[field] !== null && existing[field] !== "") {
          merged[field] = existing[field];
          preservedUserFields += 1;
        }
      }
      if (merged.workflow) {
        merged.workflow = {
          ...merged.workflow,
          status: merged.user_status || merged.workflow.status,
          priority: merged.priority || merged.workflow.priority,
          favorite: Boolean(merged.favorite ?? merged.workflow.favorite),
          follow_up_date: merged.follow_up_date ?? merged.workflow.follow_up_date,
          contacted_date: merged.contacted_date ?? merged.workflow.contacted_date,
          applied_date: merged.applied_date ?? merged.workflow.applied_date,
          personal_notes: merged.personal_notes ?? merged.workflow.personal_notes
        };
      }
      rowMap.set(targetId, merged);
    }
  }

  const rows = Array.from(rowMap.values());
  const inserted = insertedIds.size;
  const updated = updatedIds.size;
  const unchanged = Math.max(0, originalExistingIds.size - updated);

  return {
    rows,
    inserted,
    updated,
    unchanged,
    preservedUserFields
  };
}


export function normalizeScoreComponents(record) {
  const sc = record && record.score_components;
  if (!sc) return [];
  if (Array.isArray(sc)) return sc;
  const cat = record.category || "";
  const labelsByCat = {
    freelance_leads: {
      fit: ["Profile & Case-Study Fit", 30],
      evidence: ["Deterministic Audit Evidence", 25],
      value: ["Business Ticket Value", 20],
      contact: ["Public Contact Path", 15],
      urgency: ["Urgency", 10]
    },
    visa_jobs: {
      fit: ["Stack & Level Fit", 35],
      evidence: ["Source & ATS Evidence", 20],
      eligibility: ["Visa / Location Eligibility", 20],
      quality: ["Employer & Comp Quality", 15],
      urgency: ["Urgency", 10]
    },
    masters_scholarships: {
      fit: ["Academic & Portfolio Fit", 30],
      funding: ["Funding Coverage Strength", 25],
      eligibility: ["Eligibility Confidence", 25],
      evidence: ["Official Source Evidence", 10],
      urgency: ["Deadline Urgency", 10]
    },
    remote_jobs: {
      fit: ["Stack & Level Fit", 35],
      evidence: ["Official Source Evidence", 20],
      eligibility: ["Remote Region & TZ Eligibility", 20],
      quality: ["Compensation & Role Quality", 15],
      urgency: ["Urgency", 10]
    }
  };
  const map = labelsByCat[cat] || {};
  return Object.entries(sc).map(([k, pts]) => ({
    key: k,
    label: (map[k] && map[k][0]) || k,
    points: Number(pts || 0),
    max_points: (map[k] && map[k][1]) || 25
  }));
}
