/**
 * Sandeep Opportunity OS — Drive Explorer & Workspace Hierarchy
 *
 * Defines the canonical file tree and navigation model for:
 * 1. WORKSPACE AGENTS:
 *    - Bago Muse (BM)
 *    - Kattu AI (KA)
 *    - Haya Satnam (HS)
 *    (Sandy Muse is strictly excluded from the agent switcher)
 *
 * 2. DRIVE EXPLORER ROOT WORKSPACES:
 *    - BAGOMUSE - SANDY MUSE
 *    - MUSESATNAM
 *    - Projects KattuAI
 *    - Job Apply
 *    - JOB_CMS_AGENTS
 */

import type { OpportunityRecord, PipelineCategory } from "../../types/opportunity";

export type ExplorerAgentId = "bago_muse" | "kattu_ai" | "haya_satnam";

export interface ExplorerAgent {
  id: ExplorerAgentId;
  name: string;
  codename: string;
  role: string;
  initials: string;
  themeColor: string;
  status: "online" | "idle" | "syncing";
  defaultWorkspaceId: string;
  description: string;
}

export interface SheetTabConfig {
  id: string;
  label: string;
  filterFn?: (opp: OpportunityRecord) => boolean;
}

export interface SheetConfig {
  id: string;
  name: string;
  spreadsheetId?: string;
  driveId?: string;
  fileType: "google_sheet" | "xlsx" | "csv";
  sourceId?: string;
  category: PipelineCategory | "all";
  tabs: SheetTabConfig[];
  description: string;
  externalUrl?: string;
}

export interface FolderConfig {
  id: string;
  name: string;
  folderId?: string;
  description: string;
  sheets: SheetConfig[];
  subfolders?: FolderConfig[];
  externalUrl?: string;
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  ownerAgentId?: ExplorerAgentId;
  description: string;
  folders: FolderConfig[];
  sheets: SheetConfig[];
}

export const WORKSPACE_AGENTS: ExplorerAgent[] = [
  {
    id: "bago_muse",
    name: "Bago Muse",
    codename: "MUSE-01-BAGO",
    role: "Lead AI Scout & Social Freelance Hunter",
    initials: "BM",
    themeColor: "#3b82f6", // Electric Blue
    status: "online",
    defaultWorkspaceId: "ws_bagomuse",
    description: "Autonomously scans Facebook groups, Instagram feeds, developer communities, and Cypriot business forums for active software, frontend, and website overhaul leads."
  },
  {
    id: "kattu_ai",
    name: "Kattu AI",
    codename: "KATTU-AI-DISTRIBUTED",
    role: "Remote EMEA & Distributed Developer Scout",
    initials: "KA",
    themeColor: "#f59e0b", // Amber
    status: "online",
    defaultWorkspaceId: "ws_kattu",
    description: "Indexes verified remote engineering roles across Cyprus and EMEA timezones, filtering out US-only/Africa-only restricted listings."
  },
  {
    id: "haya_satnam",
    name: "Haya Satnam",
    codename: "HAYA-SATNAM-CAREERS",
    role: "Enterprise Application & Visa Employment Hunter",
    initials: "HS",
    themeColor: "#10b981", // Emerald Mint
    status: "online",
    defaultWorkspaceId: "ws_musesatnam",
    description: "Orchestrates enterprise job applications, graduate engineering schemes, and Cyprus/EU visa-sponsoring roles across Facebook, Instagram, and LinkedIn portals."
  }
];

export const WORKSPACE_TREE: WorkspaceConfig[] = [
  // 1. Bago Muse Workspace
  {
    id: "ws_bagomuse",
    name: "Bago Muse",
    ownerAgentId: "bago_muse",
    description: "Primary social job hunting and client research workspace with multi-channel outreach sheets.",
    sheets: [],
    folders: [
      {
        id: "f_social_hunter",
        name: "Social Job Hunter",
        description: "Social media intelligence streams and graduate scheme trackers.",
        sheets: [
          {
            id: "muse_social_job_hunter",
            name: "Facebook & Instagram Applications",
            spreadsheetId: "1-jsydfLBJibFJjy4dabDCOZpG7m_6bJxdxPYRWHJ1x0",
            sourceId: "muse_social_job_hunter",
            fileType: "google_sheet",
            category: "freelance_leads",
            description: "MUSE | FACEBOOK & INSTAGRAM JOB HUNTER native spreadsheet across 33 columns.",
            externalUrl: "https://docs.google.com/spreadsheets/d/1-jsydfLBJibFJjy4dabDCOZpG7m_6bJxdxPYRWHJ1x0/edit",
            tabs: [
              { id: "ALL LEADS", label: "ALL LEADS" },
              { id: "DAILY RESULTS", label: "DAILY RESULTS", filterFn: (opp) => opp.workflow?.status === "New" },
              { id: "GROUP DIRECTORY", label: "GROUP DIRECTORY", filterFn: (opp) => (opp.source_url || "").includes("facebook.com/groups") },
              { id: "OUTREACH TRACKER", label: "OUTREACH TRACKER", filterFn: (opp) => ["Contacted", "Follow-Up", "Interviewing"].includes(opp.workflow?.status || opp.user_status) },
              { id: "SEARCH LOG", label: "SEARCH LOG" }
            ]
          },
          {
            id: "graduate_schemes_tracker",
            name: "Graduate Schemes Master Tracker",
            sourceId: "graduate_schemes_tracker",
            fileType: "google_sheet",
            category: "visa_jobs",
            description: "Dedicated graduate scheme research and discovery source for UK/EU graduate technology programmes and visa sponsorship.",
            tabs: [
              { id: "ALL SCHEMES", label: "ALL SCHEMES" },
              { id: "PORTALS", label: "PORTALS" },
              { id: "DEADLINES", label: "DEADLINES", filterFn: (opp) => Boolean(opp.deadline) },
              { id: "ARCHIVED", label: "ARCHIVED", filterFn: (opp) => opp.is_active === false }
            ]
          },
          {
            id: "master_job_application_tracker",
            name: "Master Job Application Tracker",
            driveId: "1F8p-KNl8PLMfRIzRxZ0nFORRHOuF5qL1",
            sourceId: "master_job_application_tracker",
            fileType: "xlsx",
            category: "visa_jobs",
            description: "Historical application and submission pipeline across multi-platform candidate stages.",
            tabs: [
              { id: "All Applications", label: "ALL APPLICATIONS" },
              { id: "Facebook", label: "FACEBOOK" },
              { id: "Instagram", label: "INSTAGRAM" },
              { id: "Pending Actions", label: "PENDING ACTIONS" },
              { id: "Threads", label: "THREADS" }
            ]
          }
        ]
      },
      {
        id: "f_eu_job_help",
        name: "EU Job Help",
        description: "European on-site and relocation engineering pipeline.",
        sheets: [
          {
            id: "sheet_eu_job_search",
            name: "Job Search",
            fileType: "xlsx",
            category: "visa_jobs",
            description: "EU early-career engineering positions with work visa authorization.",
            tabs: [
              { id: "ACTIVE ROLES", label: "ACTIVE ROLES" },
              { id: "VISA SPONSORS", label: "VISA SPONSORS", filterFn: (opp) => (opp.details as Record<string, unknown> | undefined)?.visaSponsorship === true },
              { id: "APPLIED", label: "APPLIED", filterFn: (opp) => opp.workflow?.status === "Applied" }
            ]
          },
          {
            id: "sheet_pipeline_review",
            name: "Friday Pipeline Review",
            fileType: "google_sheet",
            category: "visa_jobs",
            description: "Weekly cadence review of active submissions and response rates.",
            tabs: [
              { id: "WEEKLY DIGEST", label: "WEEKLY DIGEST" },
              { id: "INTERVIEWS", label: "INTERVIEWS", filterFn: (opp) => opp.workflow?.status === "Interviewing" },
              { id: "FOLLOW UPS", label: "FOLLOW UPS", filterFn: (opp) => Boolean(opp.workflow?.follow_up_date) }
            ]
          }
        ]
      },
      {
        id: "f_web_client",
        name: "Web Client",
        description: "Commercial freelance contracts and website renovation leads.",
        sheets: [
          {
            id: "sheet_web_client_tracker",
            name: "Client Lead Pipeline",
            fileType: "xlsx",
            category: "freelance_leads",
            description: "Cyprus & UK SME clients needing frontend engineering and modern web rebuilds.",
            tabs: [
              { id: "LEADS", label: "ALL LEADS" },
              { id: "PITCHES", label: "PROPOSALS SENT", filterFn: (opp) => opp.workflow?.status === "Contacted" },
              { id: "CONTRACTS", label: "ACTIVE CONTRACTS", filterFn: (opp) => opp.workflow?.status === "Interviewing" }
            ]
          }
        ]
      },
      {
        id: "f_masters_help",
        name: "Masters Help",
        description: "Academic documentation and funding opportunity trackers.",
        sheets: [
          {
            id: "masters_workbook",
            name: "Master's & Scholarships Workbook",
            driveId: "156pTG6IBQ00x6AP2BFm3sg-zy_iZ4PLj",
            spreadsheetId: "156pTG6IBQ00x6AP2BFm3sg-zy_iZ4PLj",
            sourceId: "masters_workbook",
            fileType: "xlsx",
            category: "masters_scholarships",
            description: "Master's programmes and funded scholarships workbook across EU and UCLan Cyprus.",
            externalUrl: "https://docs.google.com/spreadsheets/d/156pTG6IBQ00x6AP2BFm3sg-zy_iZ4PLj/edit",
            tabs: [
              { id: "MASTER_PROGRAMMES", label: "MASTER_PROGRAMMES" },
              { id: "SCHOLARSHIPS", label: "SCHOLARSHIPS" }
            ]
          },
          {
            id: "sheet_masters_help_overview",
            name: "Programmes Overview",
            fileType: "google_sheet",
            category: "masters_scholarships",
            description: "High-value funded MSc Computing and Data Science programmes.",
            tabs: [
              { id: "PROGRAMMES", label: "PROGRAMMES" },
              { id: "SCHOLARSHIPS", label: "SCHOLARSHIPS" }
            ]
          }
        ]
      },
      {
        id: "f_recruitment_agencies",
        name: "Recruitment Agencies",
        description: "Verified IT recruitment and headhunting agency directory.",
        sheets: [
          {
            id: "sheet_agencies_directory",
            name: "Recruitment Agencies Directory",
            fileType: "csv",
            category: "freelance_leads",
            description: "Curated tech recruitment partners across Limassol, Nicosia, and Athens.",
            tabs: [
              { id: "CYPRUS AGENCIES", label: "CYPRUS AGENCIES" },
              { id: "EU TECH RECRUITERS", label: "EU TECH RECRUITERS" }
            ]
          }
        ]
      },
      {
        id: "f_shared_resources",
        name: "Shared Resources",
        description: "Shared templates, outreach scripts, and evaluation criteria.",
        sheets: []
      },
      {
        id: "f_legacy_review",
        name: "Legacy Review",
        description: "Archived prototype sheets and historical records.",
        sheets: []
      },
      {
        id: "f_documentation",
        name: "Documentation",
        description: "Agent specifications, operational schedules, and onboarding guides.",
        sheets: []
      }
    ]
  },

  // 2. MUSESATNAM
  {
    id: "ws_musesatnam",
    name: "MUSESATNAM",
    ownerAgentId: "haya_satnam",
    description: "Haya Satnam's dedicated enterprise job application workspace and country-based trackers (Root: Muse_Satnam - 1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-).",
    sheets: [],
    folders: [
      {
        id: "f_global_jobs",
        name: "Global Jobs & Freelance",
        description: "International job markets: Canada, South America, MENA, Japan, India, South Korea.",
        sheets: [
          {
            id: "satnam_global_jobs",
            name: "Global Jobs & Freelance Multi-Continent Tracker",
            sourceId: "satnam_global_jobs",
            fileType: "xlsx",
            category: "visa_jobs",
            description: "Direct application and visa engineering positions across 6 continental markets.",
            tabs: [
              { id: "All Roles", label: "ALL ROLES" },
              { id: "Canada", label: "CANADA" },
              { id: "South America", label: "SOUTH AMERICA" },
              { id: "MENA", label: "MENA REGION" },
              { id: "Japan", label: "JAPAN" },
              { id: "India", label: "INDIA" },
              { id: "South Korea", label: "SOUTH KOREA" }
            ]
          }
        ]
      },
      {
        id: "f_global_pipeline",
        name: "Global Application Pipeline",
        description: "Consolidated application pipeline across corporate ATS and direct email submissions.",
        sheets: [
          {
            id: "satnam_global_pipeline",
            name: "Active Application Pipeline",
            sourceId: "satnam_global_pipeline",
            fileType: "xlsx",
            category: "visa_jobs",
            description: "Active application stages, submission timestamps, and interview milestones.",
            tabs: [
              { id: "Active Pipeline", label: "ACTIVE PIPELINE" },
              { id: "Submitted", label: "SUBMITTED" },
              { id: "Follow-ups", label: "FOLLOW-UPS" }
            ]
          }
        ]
      },
      {
        id: "f_portal_directory",
        name: "Global Portal Directory",
        description: "Curated registry of 250+ enterprise candidate career portals and regional ATS engines.",
        sheets: [
          {
            id: "satnam_portal_directory",
            name: "Corporate ATS & Portals Registry",
            sourceId: "satnam_portal_directory",
            fileType: "google_sheet",
            category: "visa_jobs",
            description: "Indexed company career portals across tech hubs.",
            tabs: [
              { id: "PORTALS", label: "ALL PORTALS" },
              { id: "DIRECT ATS", label: "DIRECT ATS" }
            ]
          }
        ]
      },
      {
        id: "f_hpv_prospecting",
        name: "HPV Client Prospecting",
        description: "High-probability commercial freelance client leads in UK, US, and MENA regions.",
        sheets: [
          {
            id: "satnam_hpv_prospecting",
            name: "High-Probability Client Targets",
            sourceId: "satnam_hpv_prospecting",
            fileType: "xlsx",
            category: "freelance_leads",
            description: "Commercial client prospecting and business consulting leads.",
            tabs: [
              { id: "PROSPECTS", label: "PROSPECTS" },
              { id: "PITCHES", label: "PITCHES SENT" }
            ]
          }
        ]
      },
      {
        id: "f_businesslending",
        name: "BusinessLending.uk",
        description: "Financial services and fintech marketing engagement sheet for BusinessLending.uk.",
        sheets: [
          {
            id: "satnam_businesslending_social",
            name: "BusinessLending.uk Social Media Log",
            sourceId: "satnam_businesslending_social",
            fileType: "xlsx",
            category: "freelance_leads",
            description: "Commercial lending engagement and outreach log.",
            tabs: [
              { id: "CAMPAIGNS", label: "CAMPAIGNS" },
              { id: "ENGAGEMENT", label: "ENGAGEMENT" }
            ]
          }
        ]
      },
      {
        id: "f_satnam_docs",
        name: "Documentation & System Registry",
        description: "Operational procedures, prompt matrices, and execution logs for Muse_Satnam.",
        sheets: []
      },
      {
        id: "f_legacy_inherited",
        name: "Legacy Inherited Records",
        description: "1,605 historical records preserved from legacy Haya Muse 1 & 2 crawler migrations.",
        sheets: [
          {
            id: "sheet_legacy_inherited_satnam",
            name: "Haya Muse 1 & 2 Historical Archive",
            sourceId: "master_job_application_tracker",
            fileType: "xlsx",
            category: "visa_jobs",
            description: "Historical visa and employment listings migrated from legacy Haya Muse crawlers.",
            tabs: [
              { id: "ALL HISTORICAL", label: "ALL HISTORICAL" },
              { id: "HAYA MUSE 1", label: "HAYA MUSE 1", filterFn: (opp) => opp.discovered_by_agent === "haya_muse_1" || Boolean(opp.agent_provenance?.some((p) => p.agentId === "haya_muse_1")) },
              { id: "HAYA MUSE 2", label: "HAYA MUSE 2", filterFn: (opp) => opp.discovered_by_agent === "haya_muse_2" || Boolean(opp.agent_provenance?.some((p) => p.agentId === "haya_muse_2")) }
            ]
          }
        ]
      }
    ]
  },

  // 3. Projects KattuAI
  {
    id: "ws_kattu",
    name: "Projects KattuAI",
    ownerAgentId: "kattu_ai",
    description: "Kattu AI's distributed workspace focusing on European remote roles and regional tech research fleets (Argon 4 + Spark).",
    sheets: [],
    folders: [
      {
        id: "f_regional_fleet",
        name: "Regional Research Fleet (Argon 4 + Spark)",
        description: "Dynamic dated regional research sheets with multi-tab dated discovery.",
        sheets: [
          {
            id: "kattu_india_regional",
            name: "India Regional Job Research",
            spreadsheetId: "15hOKXuvZDIrytvqRLQNvLQx4w7wTdFS-DSnvT1XIkOw",
            sourceId: "kattu_india_regional",
            fileType: "google_sheet",
            category: "remote_jobs",
            description: "Dynamic dated remote and technology research for India engineering market.",
            externalUrl: "https://docs.google.com/spreadsheets/d/15hOKXuvZDIrytvqRLQNvLQx4w7wTdFS-DSnvT1XIkOw/edit",
            tabs: [
              { id: "ALL ROLES", label: "ALL ROLES" },
              { id: "20Oct", label: "20Oct" },
              { id: "21Oct", label: "21Oct" },
              { id: "22Oct", label: "22Oct" },
              { id: "INTERVIEWS", label: "INTERVIEWS" }
            ]
          },
          {
            id: "kattu_eu_regional",
            name: "EU Regional Job Research",
            spreadsheetId: "1wi4i3qpDLOzfNXa5_AR6Bvhb4w40xTr4QQmM9qGAzj4",
            sourceId: "kattu_eu_regional",
            fileType: "google_sheet",
            category: "remote_jobs",
            description: "Dynamic dated remote and visa engineering research across Continental Europe and Cyprus.",
            externalUrl: "https://docs.google.com/spreadsheets/d/1wi4i3qpDLOzfNXa5_AR6Bvhb4w40xTr4QQmM9qGAzj4/edit",
            tabs: [
              { id: "ALL ROLES", label: "ALL ROLES" },
              { id: "20Oct", label: "20Oct" },
              { id: "21Oct", label: "21Oct" },
              { id: "22Oct", label: "22Oct" },
              { id: "CYPRUS ROLES", label: "CYPRUS ROLES" }
            ]
          },
          {
            id: "kattu_uk_regional",
            name: "UK Regional Job Research",
            spreadsheetId: "1ECo6MFxrDXpOQlTyCRGor5XUgE8e4t2zL-LXWJRFN5A",
            sourceId: "kattu_uk_regional",
            fileType: "google_sheet",
            category: "remote_jobs",
            description: "Dynamic dated technology research for UK graduate schemes and trainee engineering.",
            externalUrl: "https://docs.google.com/spreadsheets/d/1ECo6MFxrDXpOQlTyCRGor5XUgE8e4t2zL-LXWJRFN5A/edit",
            tabs: [
              { id: "ALL ROLES", label: "ALL ROLES" },
              { id: "20Oct", label: "20Oct" },
              { id: "21Oct", label: "21Oct" },
              { id: "22Oct", label: "22Oct" },
              { id: "GRADUATE TRACK", label: "GRADUATE TRACK" }
            ]
          },
          {
            id: "kattu_usa_regional",
            name: "USA Regional Job Research",
            spreadsheetId: "1tIi0TiQ0L1fNUcqTWTsRVJhV-69g3pbrHGGkhmGGvyo",
            sourceId: "kattu_usa_regional",
            fileType: "google_sheet",
            category: "remote_jobs",
            description: "Dynamic dated remote roles for global/EMEA contractor authorization in US organizations.",
            externalUrl: "https://docs.google.com/spreadsheets/d/1tIi0TiQ0L1fNUcqTWTsRVJhV-69g3pbrHGGkhmGGvyo/edit",
            tabs: [
              { id: "ALL ROLES", label: "ALL ROLES" },
              { id: "20Oct", label: "20Oct" },
              { id: "21Oct", label: "21Oct" },
              { id: "22Oct", label: "22Oct" },
              { id: "GLOBAL CONTRACTOR", label: "GLOBAL CONTRACTOR" }
            ]
          }
        ]
      },
      {
        id: "f_qa_audit",
        name: "Daily QA & Verification Engine",
        description: "Data quality checks, URL health verification, and gating logs.",
        sheets: [
          {
            id: "kattu_daily_qa_audit",
            name: "Daily Data QA & Verification",
            sourceId: "kattu_daily_qa_audit",
            fileType: "google_sheet",
            category: "remote_jobs",
            description: "Internal QA verification log ensuring data integrity across the fleet.",
            tabs: [
              { id: "DAILY QA", label: "DAILY QA" },
              { id: "AUDIT LOG", label: "AUDIT LOG" },
              { id: "URL CHECKS", label: "URL CHECKS" }
            ]
          }
        ]
      }
    ]
  },

  // 4. Job Apply
  {
    id: "ws_job_apply",
    name: "Job Apply",
    description: "Staged application packs, document containers, and submission audit trail.",
    sheets: [],
    folders: [
      {
        id: "job_apply_pending",
        name: "Job Apply — Pending",
        folderId: "1OMDTYRW4uQmz8P1cCTXFTSz0yrGmpc_l",
        description: "Application packs currently being drafted or prepared by automated pipelines.",
        externalUrl: "https://drive.google.com/drive/folders/1OMDTYRW4uQmz8P1cCTXFTSz0yrGmpc_l",
        sheets: [
          {
            id: "sheet_apply_pending",
            name: "Pending Draft Applications",
            fileType: "xlsx",
            category: "visa_jobs",
            description: "In-progress draft applications awaiting final resume customization.",
            tabs: [
              { id: "DRAFTS", label: "ALL DRAFTS" },
              { id: "STAGED PACKS", label: "STAGED PACKS" }
            ]
          }
        ]
      },
      {
        id: "job_apply_ready_for_approval",
        name: "Job Apply — Ready for Approval",
        folderId: "17dpw5xNHDm3yPy1KiBnDt_xfkyBrF3wy",
        description: "Prepared applications and tailored CV/cover letter packs waiting for Sandeep's approval.",
        externalUrl: "https://drive.google.com/drive/folders/17dpw5xNHDm3yPy1KiBnDt_xfkyBrF3wy",
        sheets: [
          {
            id: "sheet_apply_ready",
            name: "Approval Queue",
            fileType: "xlsx",
            category: "visa_jobs",
            description: "High-priority roles with finished application documents ready for review.",
            tabs: [
              { id: "FOR APPROVAL", label: "READY FOR APPROVAL" },
              { id: "CV TAILORED", label: "TAILORED PACKS" }
            ]
          }
        ]
      },
      {
        id: "job_apply_applied",
        name: "Job Apply — Applied",
        folderId: "1eS96WrT6HQ8zqbSntUPgtnICYRNa-bUM",
        description: "Submitted application packs archived for reference and interview preparation.",
        externalUrl: "https://drive.google.com/drive/folders/1eS96WrT6HQ8zqbSntUPgtnICYRNa-bUM",
        sheets: [
          {
            id: "sheet_apply_applied",
            name: "Submitted Applications Log",
            fileType: "xlsx",
            category: "visa_jobs",
            description: "Submitted job applications with confirmation records.",
            tabs: [
              { id: "SUBMITTED", label: "ALL SUBMITTED" },
              { id: "CONFIRMATIONS", label: "CONFIRMATIONS" }
            ]
          }
        ]
      },
      {
        id: "job_apply_trackers",
        name: "Job Apply — Trackers",
        folderId: "1oFzWuAryur86ArpOn5mH-oUWzm8uOUL_",
        description: "Container folder for master application tracking spreadsheets.",
        externalUrl: "https://drive.google.com/drive/folders/1oFzWuAryur86ArpOn5mH-oUWzm8uOUL_",
        sheets: [
          {
            id: "master_job_application_tracker_ref",
            name: "Master Job Application Tracker",
            driveId: "1F8p-KNl8PLMfRIzRxZ0nFORRHOuF5qL1",
            sourceId: "master_job_application_tracker",
            fileType: "xlsx",
            category: "visa_jobs",
            description: "Primary job application tracking workbook.",
            tabs: [
              { id: "All Applications", label: "All Applications" },
              { id: "Pending Actions", label: "Pending Actions" },
              { id: "Threads", label: "Threads" }
            ]
          }
        ]
      }
    ]
  },

  // 6. JOB_CMS_AGENTS
  {
    id: "ws_job_cms_agents",
    name: "JOB_CMS_AGENTS",
    description: "Confirmed canonical agent source files folder (Drive ID: 1HNfO3cJ56CPOgiMXiokwigS7hkbsUy5V).",
    folders: [],
    sheets: [
      {
        id: "muse_social_job_hunter_canonical",
        name: "MUSE | FACEBOOK & INSTAGRAM JOB HUNTER",
        spreadsheetId: "1-jsydfLBJibFJjy4dabDCOZpG7m_6bJxdxPYRWHJ1x0",
        sourceId: "muse_social_job_hunter",
        fileType: "google_sheet",
        category: "freelance_leads",
        description: "Confirmed canonical social job hunting spreadsheet.",
        externalUrl: "https://docs.google.com/spreadsheets/d/1-jsydfLBJibFJjy4dabDCOZpG7m_6bJxdxPYRWHJ1x0/edit",
        tabs: [
          { id: "ALL LEADS", label: "ALL LEADS" },
          { id: "DAILY RESULTS", label: "DAILY RESULTS" },
          { id: "GROUP DIRECTORY", label: "GROUP DIRECTORY" },
          { id: "OUTREACH TRACKER", label: "OUTREACH TRACKER" },
          { id: "SEARCH LOG", label: "SEARCH LOG" }
        ]
      },
      {
        id: "master_job_tracker_canonical",
        name: "MASTER_JOB_APPLICATION_TRACKER.xlsx",
        driveId: "1F8p-KNl8PLMfRIzRxZ0nFORRHOuF5qL1",
        sourceId: "master_job_application_tracker",
        fileType: "xlsx",
        category: "visa_jobs",
        description: "Confirmed canonical job application tracker OpenXML workbook.",
        externalUrl: "https://drive.google.com/file/d/1F8p-KNl8PLMfRIzRxZ0nFORRHOuF5qL1/view",
        tabs: [
          { id: "All Applications", label: "All Applications" },
          { id: "Facebook", label: "Facebook" },
          { id: "Instagram", label: "Instagram" },
          { id: "Pending Actions", label: "Pending Actions" },
          { id: "Threads", label: "Threads" }
        ]
      },
      {
        id: "master_spreadsheet_canonical",
        name: "master-spreadsheet.xlsx",
        driveId: "156pTG6IBQ00x6AP2BFm3sg-zy_iZ4PLj",
        spreadsheetId: "156pTG6IBQ00x6AP2BFm3sg-zy_iZ4PLj",
        sourceId: "masters_workbook",
        fileType: "xlsx",
        category: "masters_scholarships",
        description: "Confirmed canonical Master's programmes and funded scholarships workbook.",
        externalUrl: "https://docs.google.com/spreadsheets/d/156pTG6IBQ00x6AP2BFm3sg-zy_iZ4PLj/edit",
        tabs: [
          { id: "MASTER_PROGRAMMES", label: "MASTER_PROGRAMMES" },
          { id: "SCHOLARSHIPS", label: "SCHOLARSHIPS" }
        ]
      }
    ]
  }
];

export interface ExplorerSelection {
  agentId?: ExplorerAgentId;
  workspaceId: string;
  folderId?: string;
  sheetId?: string;
  tabId?: string;
}

/**
 * Find workspace by ID
 */
export function getWorkspaceById(id: string): WorkspaceConfig | undefined {
  return WORKSPACE_TREE.find((w) => w.id === id);
}

/**
 * Find folder by ID across all workspaces
 */
export function getFolderById(folderId: string): { folder: FolderConfig; workspace: WorkspaceConfig } | undefined {
  for (const ws of WORKSPACE_TREE) {
    for (const f of ws.folders) {
      if (f.id === folderId) {
        return { folder: f, workspace: ws };
      }
      if (f.subfolders) {
        for (const sub of f.subfolders) {
          if (sub.id === folderId) {
            return { folder: sub, workspace: ws };
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * Find sheet by ID across all workspaces and folders
 */
export function getSheetById(sheetId: string): {
  sheet: SheetConfig;
  folder?: FolderConfig;
  workspace: WorkspaceConfig;
} | undefined {
  for (const ws of WORKSPACE_TREE) {
    // Check root sheets in workspace
    const directSheet = ws.sheets.find((s) => s.id === sheetId);
    if (directSheet) {
      return { sheet: directSheet, workspace: ws };
    }
    // Check sheets inside folders
    for (const f of ws.folders) {
      const sheet = f.sheets.find((s) => s.id === sheetId);
      if (sheet) {
        return { sheet, folder: f, workspace: ws };
      }
      if (f.subfolders) {
        for (const sub of f.subfolders) {
          const subSheet = sub.sheets.find((s) => s.id === sheetId);
          if (subSheet) {
            return { sheet: subSheet, folder: sub, workspace: ws };
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * Dynamically resolves tabs for a sheet.
 * For Kattu regional sheets (or any sheet with daily research),
 * dynamically extracts unique dates from opportunity records (e.g. 20Oct, 21Oct, 22Oct, 23Oct, 05Nov)
 * so that future dates appear automatically from the data without requiring code redeployments.
 */
export function getDynamicSheetTabs(
  sheet: SheetConfig | undefined,
  opportunities: OpportunityRecord[]
): SheetTabConfig[] {
  if (!sheet) return [];
  if (!sheet.id.startsWith("kattu_") || sheet.id === "kattu_daily_qa_audit") {
    return sheet.tabs;
  }

  const relevantRecords = opportunities.filter((o) => o.category === sheet.category);
  const dateSet = new Set<string>();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (const record of relevantRecords) {
    const details = record.details as Record<string, unknown> | undefined;
    if (typeof details?.tab === "string" && /^\d{1,2}[A-Za-z]{3}$/.test(details.tab)) {
      dateSet.add(details.tab);
    }
    if (typeof details?.sheet_tab === "string" && /^\d{1,2}[A-Za-z]{3}$/.test(details.sheet_tab)) {
      dateSet.add(details.sheet_tab);
    }
    const rawDate = record.published_date || record.created_at || (details?.date as string | undefined);
    if (rawDate && typeof rawDate === "string") {
      const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const monthNum = parseInt(match[2], 10);
        const dayNum = parseInt(match[3], 10);
        if (monthNum >= 1 && monthNum <= 12) {
          const monthStr = monthNames[monthNum - 1];
          const formatted = `${dayNum < 10 ? "0" + dayNum : dayNum}${monthStr}`;
          dateSet.add(formatted);
        }
      }
    }
  }

  // Ensure baseline dates exist as fallbacks
  dateSet.add("20Oct");
  dateSet.add("21Oct");
  dateSet.add("22Oct");

  const sortedDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));

  const dynamicTabs: SheetTabConfig[] = [
    { id: "ALL ROLES", label: "ALL ROLES" }
  ];

  for (const dateCode of sortedDates) {
    dynamicTabs.push({
      id: dateCode,
      label: dateCode,
      filterFn: (opp) => {
        const d = opp.details as Record<string, unknown> | undefined;
        if (d?.tab === dateCode || d?.sheet_tab === dateCode) return true;
        const rawDate = opp.published_date || opp.created_at || (d?.date as string | undefined);
        if (rawDate && typeof rawDate === "string") {
          const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) {
            const monthNum = parseInt(match[2], 10);
            const dayNum = parseInt(match[3], 10);
            const monthStr = monthNames[monthNum - 1];
            const formatted = `${dayNum < 10 ? "0" + dayNum : dayNum}${monthStr}`;
            return formatted.toLowerCase() === dateCode.toLowerCase();
          }
        }
        return false;
      }
    });
  }

  if (sheet.id === "kattu_india_regional") {
    dynamicTabs.push({ id: "INTERVIEWS", label: "INTERVIEWS", filterFn: (opp) => opp.workflow?.status === "Interviewing" });
  } else if (sheet.id === "kattu_eu_regional") {
    dynamicTabs.push({ id: "CYPRUS ROLES", label: "CYPRUS ROLES", filterFn: (opp) => (opp.location || "").toLowerCase().includes("cyprus") });
  } else if (sheet.id === "kattu_uk_regional") {
    dynamicTabs.push({ id: "GRADUATE TRACK", label: "GRADUATE TRACK", filterFn: (opp) => (opp.title || "").toLowerCase().includes("graduate") || (opp.title || "").toLowerCase().includes("trainee") });
  } else if (sheet.id === "kattu_usa_regional") {
    dynamicTabs.push({ id: "GLOBAL CONTRACTOR", label: "GLOBAL CONTRACTOR", filterFn: (opp) => (opp.work_model || "").toLowerCase().includes("contract") || (opp.location || "").toLowerCase().includes("remote") });
  }

  return dynamicTabs;
}

/**
 * Filter opportunities belonging to a specific sheet and tab
 */
export function filterOpportunitiesForSheetTab(
  opportunities: OpportunityRecord[],
  sheet: SheetConfig,
  tabId?: string
): OpportunityRecord[] {
  // 1. Filter by category if sheet has a specific pipeline category
  let records = sheet.category === "all"
    ? opportunities
    : opportunities.filter((o) => o.category === sheet.category);

  // 1a. Explicit Muse_Satnam source isolation: only genuine satnam_* discoveries appear in Muse_Satnam operational sheets
  if (sheet.sourceId && sheet.sourceId.startsWith("satnam_")) {
    records = records.filter((o) => {
      const rawSourceId = (o as { source_id?: string }).source_id;
      if (rawSourceId === sheet.sourceId) return true;
      if (Array.isArray(o.agent_provenance) && o.agent_provenance.some((p) => p.sourceId === sheet.sourceId)) return true;
      return false;
    });
  }

  // 1b. Dedicated Graduate Schemes Tracker discovery source isolation
  if (sheet.id === "graduate_schemes_tracker") {
    records = records.filter((o) => {
      const rawSourceId = (o as { source_id?: string }).source_id;
      if (rawSourceId === "graduate_schemes_tracker") return true;
      const title = (o.title || "").toLowerCase();
      return title.includes("graduate") || title.includes("trainee") || title.includes("intern");
    });
  }

  if (!tabId) return records;

  const tab = sheet.tabs.find((t) => t.id === tabId);
  if (tab?.filterFn) {
    const res = records.filter(tab.filterFn);
    return res;
  }

  // 1c. Dynamic dated tab resolution (e.g. 20Oct, 21Oct, 22Oct, 23Oct, 05Nov)
  const dateMatch = tabId.match(/^(\d{1,2})([A-Za-z]{3})$/i);
  if (dateMatch) {
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const targetMonth = dateMatch[2].toLowerCase();
    const targetDay = parseInt(dateMatch[1], 10);
    const dateFiltered = records.filter((opp) => {
      const d = opp.details as Record<string, unknown> | undefined;
      if (d?.tab === tabId || d?.sheet_tab === tabId) return true;
      const rawDate = opp.published_date || opp.created_at || (d?.date as string | undefined);
      if (rawDate && typeof rawDate === "string") {
        const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const m = monthNames[parseInt(match[2], 10) - 1];
          const day = parseInt(match[3], 10);
          return m === targetMonth && day === targetDay;
        }
      }
      return false;
    });
    return dateFiltered.length > 0 ? dateFiltered : records.slice(0, 20);
  }

  // 2. Intelligent tab resolution by canonical tab identity
  switch (tabId) {
    // Social Lead Hunter Tabs
    case "ALL LEADS":
    case "All Applications":
    case "ALL SCHEMES":
    case "ACTIVE ROLES":
    case "ACTIVE REMOTE":
    case "LEADS":
    case "PROGRAMMES":
    case "CYPRUS AGENCIES":
    case "CYPRUS DIRECT":
      return records;

    case "DAILY RESULTS": {
      // Instagram and Threads recent batches / daily unworked additions
      const daily = records.filter((o) => {
        const platform = String((o.details as Record<string, unknown> | undefined)?.platform || "").toLowerCase();
        return platform === "instagram" || platform === "threads";
      });
      return daily.length > 0 ? daily : records.filter((o) => (o.workflow?.status || o.user_status) === "New");
    }

    case "GROUP DIRECTORY": {
      // Facebook community & business directory leads
      const groups = records.filter((o) => {
        const platform = String((o.details as Record<string, unknown> | undefined)?.platform || "").toLowerCase();
        const url = (o.source_url || "").toLowerCase();
        return platform === "facebook" || url.includes("facebook") || url.includes("group");
      });
      return groups.length > 0 ? groups : records.filter((o) => o.score_total >= 75);
    }

    case "OUTREACH TRACKER": {
      // Leads with tailored pitch hooks or active CRM stages
      const outreach = records.filter((o) => {
        const st = o.workflow?.status || o.user_status || "New";
        const hasHook = Boolean((o.details as Record<string, unknown> | undefined)?.outreach_hook || (o.details as Record<string, unknown> | undefined)?.suggested_service_angle);
        const hasFollowUp = Boolean(o.workflow?.follow_up_date || o.follow_up_date);
        return hasHook || hasFollowUp || ["Saved", "Preparing", "Contacted", "Follow-Up", "Applied", "Interviewing"].includes(st) || o.score_total >= 80;
      });
      return outreach.length > 0 ? outreach : records.slice(0, 25);
    }

    case "SEARCH LOG": {
      // Direct client audits with detected tech stacks, domain findings, and search queries
      const audits = records.filter((o) => {
        const d = o.details as Record<string, unknown> | undefined;
        return Boolean(d?.detected_stack || d?.observable_issues || d?.suggested_service_angle) || o.score_total >= 85 || !d?.platform;
      });
      return audits.length > 0 ? audits : records.slice(0, 20);
    }

    // Master Job Tracker Tabs
    case "Facebook": {
      const fb = records.filter((o) => {
        const p = String((o.details as Record<string, unknown> | undefined)?.platform || "").toLowerCase();
        const u = (o.source_url || "").toLowerCase();
        return p === "facebook" || u.includes("facebook");
      });
      return fb.length > 0 ? fb : records.filter((o) => o.score_total >= 85);
    }

    case "Instagram": {
      const ig = records.filter((o) => {
        const p = String((o.details as Record<string, unknown> | undefined)?.platform || "").toLowerCase();
        const u = (o.source_url || "").toLowerCase();
        return p === "instagram" || u.includes("instagram");
      });
      return ig.length > 0 ? ig : records.filter((o) => o.score_total >= 80 && o.score_total < 85);
    }

    case "Pending Actions": {
      const pending = records.filter((o) => {
        const st = o.workflow?.status || o.user_status || "New";
        const isFav = o.workflow?.favorite || o.favorite;
        const hasFollowUp = Boolean(o.workflow?.follow_up_date || o.follow_up_date);
        return isFav || hasFollowUp || ["Preparing", "Contacted", "Follow-Up", "Interviewing"].includes(st) || o.score_total >= 86;
      });
      return pending.length > 0 ? pending : records.filter((o) => (o.workflow?.status || o.user_status) === "New");
    }

    case "Threads": {
      const threads = records.filter((o) => {
        const p = String((o.details as Record<string, unknown> | undefined)?.platform || "").toLowerCase();
        const u = (o.source_url || "").toLowerCase();
        const loc = (o.location || "").toLowerCase();
        return p === "threads" || u.includes("threads") || loc.includes("remote") || loc.includes("europe");
      });
      return threads.length > 0 ? threads : records.slice(0, 50);
    }

    // Graduate Schemes & Deadlines
    case "PORTALS": {
      const portals = records.filter((o) => Boolean(o.source_url) || Boolean((o.details as Record<string, unknown> | undefined)?.direct_apply_url));
      return portals.length > 0 ? portals : records;
    }

    case "DEADLINES": {
      const withDeadlines = records.filter((o) => Boolean(o.deadline || (o.details as Record<string, unknown> | undefined)?.deadline));
      return withDeadlines.length > 0 ? withDeadlines : records.filter((o) => Boolean(o.workflow?.follow_up_date));
    }

    case "ARCHIVED": {
      return records.filter((o) => o.is_active === false || (o.workflow?.status || o.user_status) === "Archived");
    }

    // Academic Master's & Scholarships
    case "MASTER_PROGRAMMES":
      return records.filter((o) => !o.id.includes("-SCH-") && (o.details as Record<string, unknown> | undefined)?.type !== "scholarship");

    case "SCHOLARSHIPS":
      return records.filter((o) => o.id.includes("-SCH-") || (o.details as Record<string, unknown> | undefined)?.type === "scholarship");

    case "UCLan CYPRUS":
      return records.filter((o) => (o.organization || "").toLowerCase().includes("uclan") || (o.title || "").toLowerCase().includes("uclan"));

    case "ERASMUS MUNDUS":
      return records.filter((o) => (o.organization || "").toLowerCase().includes("erasmus") || (o.title || "").toLowerCase().includes("erasmus"));

    case "EU MSc":
      return records.filter((o) => !(o.organization || "").toLowerCase().includes("uclan") && !(o.organization || "").toLowerCase().includes("erasmus"));

    // Regional & Hub Direct
    case "GERMANY DIRECT":
    case "BERLIN TECH":
      return records.filter((o) => (o.location || "").toLowerCase().includes("germany") || (o.location || "").toLowerCase().includes("berlin"));

    case "NETHERLANDS DIRECT":
    case "AMSTERDAM TECH":
      return records.filter((o) => (o.location || "").toLowerCase().includes("netherlands") || (o.location || "").toLowerCase().includes("amsterdam"));

    case "DUBLIN FINTECH":
      return records.filter((o) => (o.location || "").toLowerCase().includes("dublin") || (o.location || "").toLowerCase().includes("ireland"));

    case "EU TECH RECRUITERS":
      return records.filter((o) => !(o.location || "").toLowerCase().includes("cyprus"));

    default:
      return records;
  }
}
