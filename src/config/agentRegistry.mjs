/**
 * Sandeep Opportunity OS — Canonical AI Agent Registry (Runtime MJS)
 *
 * Central definition of the 3 configured AI Research Agents operating for Sandeep:
 * 1. Bago Muse — Lead Career Operations Scout & Social Freelance Hunter
 * 2. Haya Satnam — Global Employment & Regional Market Expansion Hunter (Muse_Satnam)
 * 3. Kattu AI — Regional Job Intelligence & Daily QA Verification Engine (Projects KattuAI)
 */

export const AGENT_REGISTRY = [
  {
    id: "bago_muse",
    name: "Bago Muse",
    slug: "bago-muse",
    codename: "MUSE-01-BAGO",
    role: "Lead Career Operations Scout & Social Freelance Hunter",
    status: "active",
    workspaceType: "Google Drive & Sheets",
    driveRootId: "1HNfO3cJ56CPOgiMXiokwigS7hkbsUy5V",
    driveRootName: "JOB_CMS_AGENTS / BAGOMUSE",
    ownerAccountLabel: "Sandeep Gautam (Career Operations)",
    sourceType: "Native Google Sheet (v4 API) & Drive OpenXML",
    avatarIcon: "sparkles",
    themeColor: "#3b82f6",
    accentBg: "rgba(59, 130, 246, 0.12)",
    assignedPipelines: ["freelance_leads", "visa_jobs", "masters_scholarships"],
    connectedSources: [
      "muse_social_job_hunter",
      "graduate_schemes_tracker",
      "master_job_application_tracker",
      "masters_workbook",
      "job_apply_root"
    ],
    updateSchedule: "Every 5 hours (Automated Ingestion Daemon)",
    lastAgentUpdate: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(),
    lastCmsIngestion: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    health: "Healthy",
    recordsDiscovered: 1070,
    recordsAccepted: 1042,
    duplicateCount: 28,
    gatedCount: 0,
    errorMessage: null,
    description:
      "Main career operations & research environment: Social Job Hunter, Graduate Schemes, EU Job Help, Web Client / Freelance Leads, Masters Help, and Recruitment Agencies.",
    capabilities: [
      "Open-ended multi-page range ingestion across 33 columns",
      "DOM & social text analysis for developer hiring signals",
      "Deterministic commercial outreach hook synthesis",
      "Direct client/contact phone and WhatsApp extraction"
    ]
  },
  {
    id: "haya_satnam",
    name: "Haya Satnam",
    slug: "haya-satnam",
    codename: "MUSE-02-SATNAM",
    role: "Global Employment & Regional Market Expansion Hunter",
    status: "active",
    workspaceType: "Google Drive & Sheets",
    driveRootId: "1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-",
    driveRootName: "Muse_Satnam",
    ownerAccountLabel: "Muse_Satnam Account",
    sourceType: "Drive Workbooks & Regional Sheets",
    avatarIcon: "briefcase",
    themeColor: "#10b981",
    accentBg: "rgba(16, 185, 129, 0.12)",
    assignedPipelines: ["visa_jobs", "freelance_leads"],
    connectedSources: [
      "satnam_global_jobs",
      "satnam_global_pipeline",
      "satnam_portal_directory",
      "satnam_hpv_prospecting",
      "satnam_businesslending_social",
      "satnam_system_registry"
    ],
    updateSchedule: "Every 5 hours (Automated Ingestion Daemon)",
    lastAgentUpdate: new Date(Date.now() - 3.2 * 3600 * 1000).toISOString(),
    lastCmsIngestion: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    health: "Healthy",
    recordsDiscovered: 0,
    legacyRecordsInherited: 1605,
    recordsAccepted: 0,
    duplicateCount: 0,
    gatedCount: 0,
    errorMessage: null,
    description:
      "Dedicated Muse_Satnam workspace: Global Jobs & Freelance (Canada, South America, MENA, Japan, India, South Korea), Global Application Pipeline, Portal Directory, HPV Prospecting, and BusinessLending.uk. Preserves 1,605 historical records from legacy Haya Muse 1 & 2.",
    capabilities: [
      "Multi-tab OpenXML parsing (All Applications, Pending Actions, Threads)",
      "Strict Seniority Gate enforcement (<2 yr early-career filtering)",
      "Drive folder synchronization for staged CV & cover letter packs",
      "Application stage tracking (Pending -> Ready for Approval -> Applied)"
    ]
  },
  {
    id: "kattu_ai",
    name: "Kattu AI",
    slug: "kattu-ai",
    codename: "KATTU-01-SPARK",
    role: "Regional Job Intelligence & Daily QA Verification Engine",
    status: "active",
    workspaceType: "Regional Research Sheets",
    driveRootId: "kattu_regional_drive",
    driveRootName: "Projects KattuAI",
    ownerAccountLabel: "Argon 4 + Spark Fleet",
    sourceType: "Google Sheets Regional Research Fleet",
    avatarIcon: "globe",
    themeColor: "#f59e0b",
    accentBg: "rgba(245, 158, 11, 0.12)",
    assignedPipelines: ["remote_jobs", "visa_jobs"],
    connectedSources: [
      "kattu_india_regional",
      "kattu_eu_regional",
      "kattu_uk_regional",
      "kattu_usa_regional",
      "kattu_daily_qa_audit"
    ],
    updateSchedule: "Every 5 hours (Automated Ingestion Daemon)",
    lastAgentUpdate: new Date(Date.now() - 5.5 * 3600 * 1000).toISOString(),
    lastCmsIngestion: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    health: "Healthy",
    recordsDiscovered: 62,
    recordsAccepted: 57,
    duplicateCount: 5,
    gatedCount: 0,
    errorMessage: null,
    description:
      "Projects KattuAI regional research fleet (India, EU, UK, USA) powered by Argon 4 + Spark research workflow, dynamic dated tab discovery, and daily data QA.",
    capabilities: [
      "Dynamic dated tab discovery (e.g. 20Oct, 21Oct, 22Oct) without redeployment",
      "Regional Restriction Gate (filters out non-EMEA postings)",
      "Timezone overlap verification for Cyprus (UTC+2/UTC+3)",
      "Daily data QA, link verification, and duplicate prevention"
    ]
  }
];

export function getAgents() {
  return AGENT_REGISTRY;
}

export function getAgentById(id) {
  if (!id) return undefined;
  const normalizedId =
    id === "sandy_muse"
      ? "bago_muse"
      : id === "haya_muse_1" || id === "haya_muse_2"
      ? "haya_satnam"
      : id === "katoo_spark" || id === "vargo_spark"
      ? "kattu_ai"
      : id;

  return AGENT_REGISTRY.find((a) => a.id === normalizedId);
}

export function getAgentForPipeline(pipeline) {
  return AGENT_REGISTRY.find((a) => a.assignedPipelines.includes(pipeline));
}

export function getAgentForSource(sourceId) {
  return AGENT_REGISTRY.find((a) => a.connectedSources.includes(sourceId));
}
