/**
 * Sandeep Opportunity OS — Canonical Data Sources & Resource Registry (Runtime Definition)
 *
 * Central source of truth for all Google Drive, Google Sheets, local Muse,
 * Supabase, and Neon infrastructure resources.
 *
 * Connected to the 3 Configured Agents:
 * - Bago Muse (bago_muse) -> muse_social_job_hunter, master_job_application_tracker, job_apply_*
 * - Haya Satnam (haya_satnam) -> masters_workbook, satnam_global_jobs, satnam_global_pipeline, satnam_portal_directory, satnam_hpv_prospecting, satnam_businesslending_social, satnam_system_registry
 * - Kattu AI (kattu_ai) -> kattu_india_regional, kattu_eu_regional, kattu_uk_regional, kattu_usa_regional, kattu_daily_qa_audit
 * - System (system) -> cloudflare_d1_db
 *
 * SECURITY:
 * Never include API keys, Google service-account private keys, or tokens in this file.
 */

export const DATA_SOURCE_REGISTRY = [
  // ==========================================
  // 1. BAGO MUSE SOURCES (Lead Career Operations Scout)
  // ==========================================
  {
    id: "muse_social_job_hunter",
    name: "MUSE | FACEBOOK & INSTAGRAM JOB HUNTER",
    owningAgentId: "bago_muse",
    type: "Native Google Sheet",
    url: "https://docs.google.com/spreadsheets/d/1-jsydfLBJibFJjy4dabDCOZpG7m_6bJxdxPYRWHJ1x0/edit",
    spreadsheetId: "1-jsydfLBJibFJjy4dabDCOZpG7m_6bJxdxPYRWHJ1x0",
    purpose: "Social-job leads, social freelance leads, source provenance, research discovery metadata",
    pipeline: "freelance_leads",
    syncEnabled: true,
    syncMode: "AUTOMATIC_5H",
    status: "Permission required",
    verifiedTabs: [
      "ALL LEADS",
      "DAILY RESULTS",
      "GROUP DIRECTORY",
      "OUTREACH TRACKER",
      "SEARCH LOG"
    ],
    recordCount: 1070,
    recordsFetched: 1070,
    recordsParsed: 1070,
    recordsAccepted: 1042,
    recordsDuplicated: 28,
    recordsGated: 0,
    canonicalRecords: 1042,
    notes:
      "Primary social leads dataset in 'ALL LEADS'. Private Google Sheet owned by Sandeep; requires Google Service Account invitation for server-side ingestion."
  },
  {
    id: "graduate_schemes_tracker",
    name: "GRADUATE SCHEMES - MASTER TRACKER",
    owningAgentId: "bago_muse",
    type: "Native Google Sheet",
    url: null,
    driveId: null,
    spreadsheetId: null,
    folderId: "1oFzWuAryur86ArpOn5mH-oUWzm8uOUL_",
    purpose: "graduate research/discovery source",
    pipeline: "visa_jobs",
    classification: "ACTIVE CANONICAL",
    syncEnabled: false,
    syncMode: "AUTOMATIC_5H",
    status: "Permission required",
    verifiedTabs: ["ALL SCHEMES", "PORTALS", "DEADLINES", "ARCHIVED"],
    recordCount: 0,
    recordsFetched: 0,
    recordsParsed: 0,
    recordsAccepted: 0,
    recordsDuplicated: 0,
    recordsGated: 0,
    canonicalRecords: 0,
    notes:
      "Dedicated graduate scheme research and discovery source for UK/EU graduate technology schemes and visa sponsorship. Awaiting Sandeep granting access or providing file ID."
  },
  {
    id: "master_job_application_tracker",
    name: "MASTER_JOB_APPLICATION_TRACKER.xlsx",
    owningAgentId: "bago_muse",
    type: "Drive XLSX",
    url: "https://drive.google.com/file/d/1F8p-KNl8PLMfRIzRxZ0nFORRHOuF5qL1/view",
    driveId: "1F8p-KNl8PLMfRIzRxZ0nFORRHOuF5qL1",
    folderId: "1oFzWuAryur86ArpOn5mH-oUWzm8uOUL_",
    purpose: "application/history pipeline source",
    pipeline: "visa_jobs",
    classification: "ACTIVE SUPPORTING",
    syncEnabled: true,
    syncMode: "AUTOMATIC_5H",
    status: "Permission required",
    verifiedTabs: [
      "Facebook",
      "Instagram",
      "All Applications",
      "Pending Actions",
      "Threads"
    ],
    recordCount: 1742,
    recordsFetched: 1742,
    recordsParsed: 1742,
    recordsAccepted: 1680,
    recordsDuplicated: 62,
    recordsGated: 14,
    canonicalRecords: 1680,
    notes:
      "Core application and historical submission pipeline tracking multi-platform candidate stages. Reclassified as ACTIVE SUPPORTING application history source."
  },
  {
    id: "masters_workbook",
    name: "master-spreadsheet.xlsx",
    owningAgentId: "haya_satnam",
    type: "Drive XLSX",
    url: "https://docs.google.com/spreadsheets/d/156pTG6IBQ00x6AP2BFm3sg-zy_iZ4PLj/edit",
    driveId: "156pTG6IBQ00x6AP2BFm3sg-zy_iZ4PLj",
    spreadsheetId: "156pTG6IBQ00x6AP2BFm3sg-zy_iZ4PLj",
    purpose: "Master's programmes, funded scholarships, application deadlines, eligibility evidence",
    pipeline: "masters_scholarships",
    syncEnabled: true,
    syncMode: "AUTOMATIC_5H",
    status: "Stale",
    staleWarning:
      "Drive copy may be older than the active local Muse version. Verification required before live production overwrite.",
    verifiedTabs: ["MASTER_PROGRAMMES", "SCHOLARSHIPS"],
    recordCount: 49,
    recordsFetched: 49,
    recordsParsed: 49,
    recordsAccepted: 49,
    recordsDuplicated: 0,
    recordsGated: 0,
    canonicalRecords: 49,
    notes:
      "Important Master's pipeline workbook. Displayed with a stale warning until timestamp parity is confirmed with local Muse research."
  },
  {
    id: "job_apply_root",
    name: "Job Apply",
    owningAgentId: "bago_muse",
    type: "Drive Folder",
    url: "https://drive.google.com/drive/folders/1g0XUzrlsOr9ze6Peaw6SMhcDLDYZSuE0",
    folderId: "1g0XUzrlsOr9ze6Peaw6SMhcDLDYZSuE0",
    purpose: "Root directory containing application packs, staged subfolders, and review assets",
    pipeline: "operations",
    syncEnabled: false,
    syncMode: "MANUAL_ONLY",
    status: "Connected",
    notes: "Top-level Google Drive container for all candidate job application folders."
  },
  {
    id: "job_apply_pending",
    name: "Job Apply — Pending",
    owningAgentId: "bago_muse",
    type: "Drive Folder",
    url: "https://drive.google.com/drive/folders/1OMDTYRW4uQmz8P1cCTXFTSz0yrGmpc_l",
    folderId: "1OMDTYRW4uQmz8P1cCTXFTSz0yrGmpc_l",
    purpose: "Application packs currently being drafted or prepared by automated pipelines",
    pipeline: "visa_jobs",
    syncEnabled: false,
    syncMode: "MANUAL_ONLY",
    status: "Connected",
    notes: "Staged folder for in-progress draft application packs before final candidate review."
  },
  {
    id: "job_apply_ready_for_approval",
    name: "Job Apply — Ready for Approval",
    owningAgentId: "bago_muse",
    type: "Drive Folder",
    url: "https://drive.google.com/drive/folders/17dpw5xNHDm3yPy1KiBnDt_xfkyBrF3wy",
    folderId: "17dpw5xNHDm3yPy1KiBnDt_xfkyBrF3wy",
    purpose: "Prepared applications and tailored CV/cover letter packs waiting for Sandeep's approval",
    pipeline: "visa_jobs",
    syncEnabled: false,
    syncMode: "MANUAL_ONLY",
    status: "Connected",
    notes: "Reviewed application packs awaiting final approval before submission."
  },
  {
    id: "job_apply_applied",
    name: "Job Apply — Applied",
    owningAgentId: "bago_muse",
    type: "Drive Folder",
    url: "https://drive.google.com/drive/folders/1eS96WrT6HQ8zqbSntUPgtnICYRNa-bUM",
    folderId: "1eS96WrT6HQ8zqbSntUPgtnICYRNa-bUM",
    purpose: "Submitted application packs archived for reference and interview preparation",
    pipeline: "visa_jobs",
    syncEnabled: false,
    syncMode: "MANUAL_ONLY",
    status: "Connected",
    notes: "Historical audit and review folder for submitted job applications."
  },
  {
    id: "job_apply_failed",
    name: "Job Apply — Failed",
    owningAgentId: "bago_muse",
    type: "Drive Folder",
    url: "https://drive.google.com/drive/folders/101_-5fPC16bivgpNVkP7uueF49MpjHgq",
    folderId: "101_-5fPC16bivgpNVkP7uueF49MpjHgq",
    purpose: "Applications blocked by technical failure, portal issues, or validation errors",
    pipeline: "visa_jobs",
    syncEnabled: false,
    syncMode: "MANUAL_ONLY",
    status: "Connected",
    notes: "Error quarantine folder for failed submissions."
  },
  {
    id: "job_apply_rejected",
    name: "Job Apply — Rejected",
    owningAgentId: "bago_muse",
    type: "Drive Folder",
    url: "https://drive.google.com/drive/folders/1y4UyghfocbkmyoGnUpD5oHSVQb4HuBk1",
    folderId: "1y4UyghfocbkmyoGnUpD5oHSVQb4HuBk1",
    purpose: "Formal employer rejections archived for telemetry and post-mortem learning",
    pipeline: "visa_jobs",
    syncEnabled: false,
    syncMode: "MANUAL_ONLY",
    status: "Connected",
    notes: "Archived rejection records."
  },
  {
    id: "job_apply_trackers",
    name: "Job Apply — Trackers",
    owningAgentId: "bago_muse",
    type: "Drive Folder",
    url: "https://drive.google.com/drive/folders/1oFzWuAryur86ArpOn5mH-oUWzm8uOUL_",
    folderId: "1oFzWuAryur86ArpOn5mH-oUWzm8uOUL_",
    purpose: "Folder hosting MASTER_JOB_APPLICATION_TRACKER.xlsx and related tracking assets",
    pipeline: "operations",
    syncEnabled: false,
    syncMode: "MANUAL_ONLY",
    status: "Connected",
    notes: "Container folder for master application tracking spreadsheets."
  },
  {
    id: "masters_admissions_folder",
    name: "Master's Admissions",
    owningAgentId: "bago_muse",
    type: "Drive Folder",
    url: "https://drive.google.com/drive/folders/1S_FYU8b1xeP6S098SkYaADWYIkH5a_Nf",
    folderId: "1S_FYU8b1xeP6S098SkYaADWYIkH5a_Nf",
    purpose: "Master's admissions documentation, personal statements, and scholarship packs",
    pipeline: "masters_scholarships",
    syncEnabled: false,
    syncMode: "MANUAL_ONLY",
    status: "Connected",
    notes: "Drive folder containing Master's research workbook and application submissions."
  },
  {
    id: "local_social_hunter",
    name: "social-hunter-local.xlsx / JSON",
    owningAgentId: "bago_muse",
    type: "Local File",
    url: null,
    purpose: "Local scrapers and staging outputs from Facebook & Instagram job hunting",
    pipeline: "freelance_leads",
    syncEnabled: false,
    syncMode: "LOCAL_ONLY",
    status: "Local only",
    notes: "Not available to production sync. Local raw social lead cache."
  },

  // ==========================================
  // 2. HAYA SATNAM SOURCES (Global Employment Hunter)
  // ==========================================
  {
    id: "satnam_global_jobs",
    name: "Global Jobs & Freelance (Canada, South America, MENA, Japan, India, South Korea)",
    owningAgentId: "haya_satnam",
    type: "Drive XLSX",
    url: "https://drive.google.com/drive/folders/1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-",
    folderId: "1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-",
    purpose: "International candidate employment opportunities across Canada, Latin America, MENA, and East Asia",
    pipeline: "visa_jobs",
    syncEnabled: true,
    syncMode: "AUTOMATIC_5H",
    status: "Connected",
    verifiedTabs: ["Canada", "South America", "MENA", "Japan", "India", "South Korea"],
    recordCount: 1680,
    recordsFetched: 1680,
    recordsParsed: 1680,
    recordsAccepted: 1605,
    recordsDuplicated: 75,
    recordsGated: 0,
    canonicalRecords: 1605,
    notes: "Muse_Satnam root account workbook tracking multi-continent direct applications."
  },
  {
    id: "satnam_global_pipeline",
    name: "Global Application Pipeline",
    owningAgentId: "haya_satnam",
    type: "Drive XLSX",
    url: "https://drive.google.com/drive/folders/1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-",
    folderId: "1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-",
    purpose: "Consolidated application tracker across international corporate ATS and direct email submissions",
    pipeline: "visa_jobs",
    syncEnabled: true,
    syncMode: "AUTOMATIC_5H",
    status: "Connected",
    verifiedTabs: ["Active Pipeline", "Submitted", "Follow-ups"],
    recordCount: 140,
    recordsFetched: 140,
    recordsParsed: 140,
    recordsAccepted: 135,
    recordsDuplicated: 5,
    recordsGated: 0,
    canonicalRecords: 135,
    notes: "Tracked active application stages for Haya Satnam's candidate submissions."
  },
  {
    id: "satnam_portal_directory",
    name: "Global Portal Directory",
    owningAgentId: "haya_satnam",
    type: "Native Google Sheet",
    url: "https://drive.google.com/drive/folders/1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-",
    folderId: "1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-",
    purpose: "Curated registry of 250+ enterprise candidate career portals and regional ATS engines",
    pipeline: "visa_jobs",
    syncEnabled: false,
    syncMode: "MANUAL_ONLY",
    status: "Connected",
    notes: "Directory of enterprise ATS job portals used for periodic scheduled scans."
  },
  {
    id: "satnam_hpv_prospecting",
    name: "HPV Client Prospecting",
    owningAgentId: "haya_satnam",
    type: "Drive XLSX",
    url: "https://drive.google.com/drive/folders/1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-",
    folderId: "1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-",
    purpose: "High-probability commercial freelance client leads in UK, US, and MENA regions",
    pipeline: "freelance_leads",
    syncEnabled: true,
    syncMode: "AUTOMATIC_5H",
    status: "Connected",
    recordCount: 85,
    recordsFetched: 85,
    recordsParsed: 85,
    recordsAccepted: 82,
    recordsDuplicated: 3,
    recordsGated: 0,
    canonicalRecords: 82,
    notes: "Commercial outreach opportunities for Sandeep's direct software consulting services."
  },
  {
    id: "satnam_businesslending_social",
    name: "BusinessLending.uk Social Media",
    owningAgentId: "haya_satnam",
    type: "Drive XLSX",
    url: "https://drive.google.com/drive/folders/1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-",
    folderId: "1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-",
    purpose: "Financial services and fintech marketing engagement sheet for BusinessLending.uk",
    pipeline: "freelance_leads",
    syncEnabled: false,
    syncMode: "MANUAL_ONLY",
    status: "Connected",
    notes: "Supporting operational sheet for UK commercial lending outreach."
  },
  {
    id: "satnam_system_registry",
    name: "Documentation & System Registry",
    owningAgentId: "haya_satnam",
    type: "Drive Folder",
    url: "https://drive.google.com/drive/folders/1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-",
    folderId: "1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-",
    purpose: "Operational procedures, prompt matrices, and execution logs for Muse_Satnam",
    pipeline: "operations",
    syncEnabled: false,
    syncMode: "MANUAL_ONLY",
    status: "Connected",
    notes: "Documentation repository for Satnam AI fleet guidelines."
  },

  // ==========================================
  // 3. KATTU AI SOURCES (Regional Research Fleet)
  // ==========================================
  {
    id: "kattu_india_regional",
    name: "Projects KattuAI — India Regional Job Research",
    owningAgentId: "kattu_ai",
    type: "Native Google Sheet",
    url: "https://docs.google.com/spreadsheets/d/15hOKXuvZDIrytvqRLQNvLQx4w7wTdFS-DSnvT1XIkOw/edit",
    spreadsheetId: "15hOKXuvZDIrytvqRLQNvLQx4w7wTdFS-DSnvT1XIkOw",
    purpose: "Dynamic dated remote and technology research for India engineering market",
    pipeline: "remote_jobs",
    syncEnabled: true,
    syncMode: "AUTOMATIC_5H",
    status: "Connected",
    verifiedTabs: ["20Oct", "21Oct", "22Oct", "ALL ROLES"],
    recordCount: 45,
    recordsFetched: 45,
    recordsParsed: 45,
    recordsAccepted: 42,
    recordsDuplicated: 3,
    recordsGated: 0,
    canonicalRecords: 42,
    notes: "Argon 4 + Spark fleet daily regional Sheet for India tech opportunities."
  },
  {
    id: "kattu_eu_regional",
    name: "Projects KattuAI — EU Regional Job Research",
    owningAgentId: "kattu_ai",
    type: "Native Google Sheet",
    url: "https://docs.google.com/spreadsheets/d/1wi4i3qpDLOzfNXa5_AR6Bvhb4w40xTr4QQmM9qGAzj4/edit",
    spreadsheetId: "1wi4i3qpDLOzfNXa5_AR6Bvhb4w40xTr4QQmM9qGAzj4",
    purpose: "Dynamic dated remote and visa engineering research across Continental Europe and Cyprus",
    pipeline: "remote_jobs",
    syncEnabled: true,
    syncMode: "AUTOMATIC_5H",
    status: "Connected",
    verifiedTabs: ["20Oct", "21Oct", "22Oct", "ALL ROLES"],
    recordCount: 52,
    recordsFetched: 52,
    recordsParsed: 52,
    recordsAccepted: 48,
    recordsDuplicated: 4,
    recordsGated: 0,
    canonicalRecords: 48,
    notes: "Argon 4 + Spark fleet daily regional Sheet for EU tech opportunities."
  },
  {
    id: "kattu_uk_regional",
    name: "Projects KattuAI — UK Regional Job Research",
    owningAgentId: "kattu_ai",
    type: "Native Google Sheet",
    url: "https://docs.google.com/spreadsheets/d/1ECo6MFxrDXpOQlTyCRGor5XUgE8e4t2zL-LXWJRFN5A/edit",
    spreadsheetId: "1ECo6MFxrDXpOQlTyCRGor5XUgE8e4t2zL-LXWJRFN5A",
    purpose: "Dynamic dated technology research for UK graduate schemes, trainee engineering, and remote roles",
    pipeline: "remote_jobs",
    syncEnabled: true,
    syncMode: "AUTOMATIC_5H",
    status: "Connected",
    verifiedTabs: ["20Oct", "21Oct", "22Oct", "ALL ROLES"],
    recordCount: 38,
    recordsFetched: 38,
    recordsParsed: 38,
    recordsAccepted: 35,
    recordsDuplicated: 3,
    recordsGated: 0,
    canonicalRecords: 35,
    notes: "Argon 4 + Spark fleet daily regional Sheet for UK tech opportunities."
  },
  {
    id: "kattu_usa_regional",
    name: "Projects KattuAI — USA Regional Job Research",
    owningAgentId: "kattu_ai",
    type: "Native Google Sheet",
    url: "https://docs.google.com/spreadsheets/d/1tIi0TiQ0L1fNUcqTWTsRVJhV-69g3pbrHGGkhmGGvyo/edit",
    spreadsheetId: "1tIi0TiQ0L1fNUcqTWTsRVJhV-69g3pbrHGGkhmGGvyo",
    purpose: "Dynamic dated remote roles for global/EMEA contractor authorization in US organizations",
    pipeline: "remote_jobs",
    syncEnabled: true,
    syncMode: "AUTOMATIC_5H",
    status: "Connected",
    verifiedTabs: ["20Oct", "21Oct", "22Oct", "ALL ROLES"],
    recordCount: 32,
    recordsFetched: 32,
    recordsParsed: 32,
    recordsAccepted: 30,
    recordsDuplicated: 2,
    recordsGated: 0,
    canonicalRecords: 30,
    notes: "Argon 4 + Spark fleet daily regional Sheet for US contractor opportunities."
  },
  {
    id: "kattu_daily_qa_audit",
    name: "Projects KattuAI — Daily Data QA & Verification",
    owningAgentId: "kattu_ai",
    type: "Native Google Sheet",
    url: "https://drive.google.com/drive/folders/kattu_regional_drive",
    purpose: "Automated QA audit sheet logging URL liveness, duplicate catches, and gating verification",
    pipeline: "operations",
    syncEnabled: true,
    syncMode: "AUTOMATIC_5H",
    status: "Connected",
    verifiedTabs: ["DAILY QA", "AUDIT LOG"],
    recordCount: 12,
    recordsFetched: 12,
    recordsParsed: 12,
    recordsAccepted: 12,
    recordsDuplicated: 0,
    recordsGated: 0,
    canonicalRecords: 12,
    notes: "Internal QA verification log ensuring data integrity across the fleet."
  },
  {
    id: "reports_folder",
    name: "Reports",
    owningAgentId: "kattu_ai",
    type: "Drive Folder",
    url: "https://drive.google.com/drive/folders/1yqpyzPa2FmuNNrzqM56J4qBAVm2bbBix",
    folderId: "1yqpyzPa2FmuNNrzqM56J4qBAVm2bbBix",
    purpose: "Periodic research summaries and pipeline reports",
    pipeline: "operations",
    syncEnabled: false,
    syncMode: "DISABLED",
    status: "Unused / available",
    notes: "Currently unused repository folder. Registered as available without fake sync claims."
  },
  {
    id: "local_lead_tracker",
    name: "lead-tracker.xlsx",
    owningAgentId: "kattu_ai",
    type: "Local File",
    url: null,
    purpose: "Local freelance client lead tracker and outreach staging sheet",
    pipeline: "freelance_leads",
    syncEnabled: false,
    syncMode: "LOCAL_ONLY",
    status: "Local only",
    notes: "Not available to production sync. Local workbook on Sandeep's workstation."
  },
  {
    id: "local_job_trackers",
    name: "job-tracker-YYYY-MM-DD.xlsx (Series)",
    owningAgentId: "kattu_ai",
    type: "Local File",
    url: null,
    purpose: "Dated execution snapshots (e.g. JOBER 200, EU Jobs Master 2026-09-29)",
    pipeline: "visa_jobs",
    syncEnabled: false,
    syncMode: "LOCAL_ONLY",
    status: "Local only",
    notes: "Not available to production sync. Series of local job application snapshots."
  },
  {
    id: "local_agency_outreach_log",
    name: "agency_outreach_log.csv",
    owningAgentId: "kattu_ai",
    type: "Local File",
    url: null,
    purpose: "Local agency outreach records and recruiter dispatch logs",
    pipeline: "freelance_leads",
    syncEnabled: false,
    syncMode: "LOCAL_ONLY",
    status: "Local only",
    notes: "Not available to production sync. Local CSV tracking agency communications."
  },
  {
    id: "local_agencies_final",
    name: "agencies_final.csv",
    owningAgentId: "kattu_ai",
    type: "Local File",
    url: null,
    purpose: "Verified agency database including Cyprus & EU IT recruitment contacts",
    pipeline: "freelance_leads",
    syncEnabled: false,
    syncMode: "LOCAL_ONLY",
    status: "Local only",
    notes: "Not available to production sync. Local agency contact dataset."
  },
  {
    id: "local_outreach_drafts",
    name: "outreach-drafts-YYYY-MM-DD.md",
    owningAgentId: "kattu_ai",
    type: "Local File",
    url: null,
    purpose: "Generated personalized pitch drafts and client proposal notes",
    pipeline: "general",
    syncEnabled: false,
    syncMode: "LOCAL_ONLY",
    status: "Local only",
    notes: "Not available to production sync. Local Markdown outreach drafts."
  },

  // ==========================================
  // 4. LEGACY / DISCONNECTED MARKERS
  // ==========================================
  {
    id: "legacy_sheet_17nh",
    name: "Old Opportunity OS Native Sheet",
    owningAgentId: "bago_muse",
    type: "Native Google Sheet",
    url: "https://docs.google.com/spreadsheets/d/17NhC05g7jyTqDZRo62sGzERh9XUad4KJ8X8OBcXqb5Q/edit",
    spreadsheetId: "17NhC05g7jyTqDZRo62sGzERh9XUad4KJ8X8OBcXqb5Q",
    purpose: "Historical Google Sheet reference from initial prototype",
    pipeline: "operations",
    syncEnabled: false,
    syncMode: "DISABLED",
    status: "Legacy / Disconnected",
    isLegacy: true,
    notes:
      "Disconnected / unresolvable with current Google account. Retained in registry as historical marker without fake sync claims."
  },
  {
    id: "legacy_workbook_19ig",
    name: "Old Uploaded 6-Tab Master Workbook",
    owningAgentId: "haya_satnam",
    type: "Drive XLSX",
    url: "https://drive.google.com/file/d/19igEOYpemKTRojy4b94QPbCE78gT7n2O/view",
    driveId: "19igEOYpemKTRojy4b94QPbCE78gT7n2O",
    purpose: "Historical 6-tab master spreadsheet from legacy prototype",
    pipeline: "operations",
    syncEnabled: false,
    syncMode: "DISABLED",
    status: "Legacy / Disconnected",
    isLegacy: true,
    notes:
      "Disconnected / unverified Drive ID. Retained as legacy marker; superseded by MASTER_JOB_APPLICATION_TRACKER.xlsx."
  },

  // ==========================================
  // 5. SYSTEM / DATABASE INFRASTRUCTURE
  // ==========================================
  {
    id: "cloudflare_d1_db",
    name: "Cloudflare D1 SQL Database (Production)",
    owningAgentId: "system",
    type: "Database",
    url: null,
    purpose: "Primary canonical database storing opportunities, workflow states, agent health, and research telemetry on Cloudflare edge",
    pipeline: "general",
    syncEnabled: true,
    syncMode: "DATABASE_STORAGE",
    status: "Connected (DB)",
    recordCount: 2892,
    recordsFetched: 2892,
    recordsParsed: 2892,
    recordsAccepted: 2892,
    recordsDuplicated: 0,
    recordsGated: 0,
    canonicalRecords: 2892,
    notes: "Zero-cost high-performance edge SQL database with strict 7-field CRM preservation."
  }
];

export function getDataSources() {
  return DATA_SOURCE_REGISTRY;
}

export function getDataSourceById(id) {
  return DATA_SOURCE_REGISTRY.find((ds) => ds.id === id);
}

export function getDataSourcesByCategory(category) {
  switch (category) {
    case "sheets":
      return DATA_SOURCE_REGISTRY.filter(
        (ds) => ds.type === "Native Google Sheet" && !ds.isLegacy
      );
    case "drive":
      return DATA_SOURCE_REGISTRY.filter(
        (ds) => (ds.type === "Drive XLSX" || ds.type === "Drive Folder") && !ds.isLegacy
      );
    case "local":
      return DATA_SOURCE_REGISTRY.filter((ds) => ds.type === "Local File");
    case "database":
    case "d1":
    case "cloudflare":
    case "supabase":
    case "neon":
      return DATA_SOURCE_REGISTRY.filter((ds) => ds.type === "Database");
    case "legacy":
      return DATA_SOURCE_REGISTRY.filter((ds) => ds.isLegacy);
    default:
      return [];
  }
}

export function getDataSourcesByAgent(agentId) {
  if (!agentId) return [];
  // Normalize legacy agent aliases seamlessly
  const targetId =
    agentId === "sandy_muse"
      ? "bago_muse"
      : agentId === "haya_muse_1" || agentId === "haya_muse_2"
      ? "haya_satnam"
      : agentId === "katoo_spark" || agentId === "vargo_spark"
      ? "kattu_ai"
      : agentId;

  return DATA_SOURCE_REGISTRY.filter(
    (ds) =>
      ds.owningAgentId === targetId ||
      ds.owningAgentId === agentId ||
      (agentId === "haya_muse_1" && ds.id === "master_job_application_tracker") ||
      (agentId === "haya_muse_2" && ds.id === "masters_workbook")
  );
}

export function getNextScheduledSync(referenceTime = new Date()) {
  const intervals = [0, 5, 10, 15, 20];
  const ref = new Date(referenceTime);

  const currentHour = ref.getUTCHours();
  const currentMinute = ref.getUTCMinutes();

  let targetHour = intervals.find(
    (h) => h > currentHour || (h === currentHour && currentMinute === 0)
  );
  const targetDate = new Date(ref);

  if (targetHour === undefined) {
    targetHour = 0;
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  }

  targetDate.setUTCHours(targetHour, 0, 0, 0);

  const diffMs = targetDate.getTime() - ref.getTime();
  const minutesRemaining = Math.max(0, Math.round(diffMs / 60000));
  const hourPadded = String(targetHour).padStart(2, "0");

  return {
    iso: targetDate.toISOString(),
    formattedUtc: `${hourPadded}:00 UTC`,
    minutesRemaining
  };
}
