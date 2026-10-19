-- Sandeep Opportunity OS — Migration 010: Canonical 4-Agent Fleet Architecture & Source Registry
-- 1. Upgrades public.agents table with slug, workspace_type, drive_root_id, owner_account_label, and health_status
-- 2. Registers the canonical 4 agents: bago_muse, haya_satnam, kattu_ai, and haya_arsh (placeholder)
-- 3. Migrates historical foreign key references in opportunities, opportunity_sources, opportunity_agent_attribution, and data_sources
-- 4. Registers all active canonical sources for Bago Muse, Haya Satnam (Muse_Satnam), and Kattu AI (Regional Sheets)

-- 1. Schema Upgrades for public.agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS workspace_type TEXT DEFAULT 'Google Drive & Sheets';
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS drive_root_id TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS drive_root_name TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS owner_account_label TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'Healthy';

-- 2. Upsert Canonical 4 Agents + System
INSERT INTO public.agents (
    id, display_name, slug, role, status, health_status, is_active,
    description, workspace_type, drive_root_id, drive_root_name, owner_account_label,
    source_type, assigned_pipelines, connected_sources, schedule_description,
    records_discovered, records_accepted, created_at, updated_at
) VALUES 
(
    'bago_muse',
    'Bago Muse',
    'bago-muse',
    'Lead Career Operations Scout & Social Freelance Hunter',
    'active',
    'Healthy',
    true,
    'Main career operations & research environment: Social Job Hunter, Graduate Schemes, EU Job Help, Web Client / Freelance Leads, Masters Help, and Recruitment Agencies.',
    'Google Drive & Sheets',
    '1HNfO3cJ56CPOgiMXiokwigS7hkbsUy5V',
    'JOB_CMS_AGENTS / BAGOMUSE',
    'Sandeep Gautam (Career Operations)',
    'Native Google Sheet & Drive XLSX',
    '["freelance_leads", "visa_jobs", "masters_scholarships"]'::jsonb,
    '["muse_social_job_hunter", "master_job_application_tracker", "masters_workbook", "job_apply_root"]'::jsonb,
    'Every 5 hours (Automated Ingestion Daemon)',
    1070,
    1042,
    NOW(),
    NOW()
),
(
    'haya_satnam',
    'Haya Satnam',
    'haya-satnam',
    'Global Employment & Regional Market Expansion Hunter',
    'active',
    'Healthy',
    true,
    'Dedicated Muse_Satnam workspace: Global Jobs & Freelance (Canada, South America, MENA, Japan, India, South Korea), Global Application Pipeline, Portal Directory, HPV Prospecting, and BusinessLending.uk.',
    'Google Drive & Sheets',
    '1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    'Muse_Satnam',
    'Muse_Satnam Account',
    'Drive Workbooks & Regional Sheets',
    '["visa_jobs", "freelance_leads"]'::jsonb,
    '["satnam_global_jobs", "satnam_global_pipeline", "satnam_portal_directory", "satnam_hpv_prospecting", "satnam_businesslending_social", "satnam_system_registry"]'::jsonb,
    'Every 5 hours (Automated Ingestion Daemon)',
    1742,
    1680,
    NOW(),
    NOW()
),
(
    'kattu_ai',
    'Kattu AI',
    'kattu-ai',
    'Regional Job Intelligence & Daily QA Verification Engine',
    'active',
    'Healthy',
    true,
    'Projects KattuAI regional research fleet (India, EU, UK, USA) powered by Argon 4 + Spark research workflow, dynamic dated tab discovery, and daily data QA.',
    'Regional Research Sheets',
    'kattu_regional_drive',
    'Projects KattuAI',
    'Argon 4 + Spark Fleet',
    'Google Sheets Regional Research Fleet',
    '["remote_jobs", "visa_jobs"]'::jsonb,
    '["kattu_india_regional", "kattu_eu_regional", "kattu_uk_regional", "kattu_usa_regional", "kattu_daily_qa_audit"]'::jsonb,
    'Every 5 hours (Automated Ingestion Daemon)',
    62,
    57,
    NOW(),
    NOW()
),
(
    -- HISTORICAL MIGRATION NOTE: haya_arsh was a historical placeholder and is DECOMMISSIONED in Migration 011.
    -- Never executed or registered in active production fleet configuration (strictly 3 agents: Bago Muse, Haya Satnam, Kattu AI).
    'haya_arsh',
    'Haya Arsh',
    'haya-arsh',
    'Academic & Funded Scholarship Intelligence Scout',
    'setup_required',
    'Setup Required',
    false,
    'Dedicated research agent workspace awaiting configuration. No active sources connected.',
    'Workspace Placeholder',
    null,
    null,
    'Unconfigured',
    'Pending Setup',
    '[]'::jsonb,
    '[]'::jsonb,
    'Pending Setup',
    0,
    0,
    NOW(),
    NOW()
),
(
    'system',
    'Opportunity OS Core',
    'system',
    'Platform Engine & Database Coordinator',
    'active',
    'Healthy',
    true,
    'Platform storage, sync orchestration, and canonical database infrastructure.',
    'Platform Infrastructure',
    null,
    'Opportunity OS Neon Lakebase',
    'System Administrator',
    'Relational Database',
    '["operations"]'::jsonb,
    '["neon_canonical_db"]'::jsonb,
    'Continuous / 5-Hour Daemon',
    2892,
    2892,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    slug = EXCLUDED.slug,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    health_status = EXCLUDED.health_status,
    is_active = EXCLUDED.is_active,
    description = EXCLUDED.description,
    workspace_type = EXCLUDED.workspace_type,
    drive_root_id = EXCLUDED.drive_root_id,
    drive_root_name = EXCLUDED.drive_root_name,
    owner_account_label = EXCLUDED.owner_account_label,
    source_type = EXCLUDED.source_type,
    assigned_pipelines = EXCLUDED.assigned_pipelines,
    connected_sources = EXCLUDED.connected_sources,
    schedule_description = EXCLUDED.schedule_description,
    updated_at = NOW();

-- 3. Historical Foreign Key Migration (Migrate raw agent IDs -> Canonical Agent IDs)
-- Opportunities
UPDATE public.opportunities SET discovered_by_agent = 'bago_muse' WHERE discovered_by_agent = 'sandy_muse';
UPDATE public.opportunities SET discovered_by_agent = 'haya_satnam' WHERE discovered_by_agent IN ('haya_muse_1', 'haya_muse_2');
UPDATE public.opportunities SET discovered_by_agent = 'kattu_ai' WHERE discovered_by_agent IN ('katoo_spark', 'vargo_spark');

-- Opportunity Sources (Provenance)
UPDATE public.opportunity_sources SET discovering_agent_id = 'bago_muse' WHERE discovering_agent_id = 'sandy_muse';
UPDATE public.opportunity_sources SET discovering_agent_id = 'haya_satnam' WHERE discovering_agent_id IN ('haya_muse_1', 'haya_muse_2');
UPDATE public.opportunity_sources SET discovering_agent_id = 'kattu_ai' WHERE discovering_agent_id IN ('katoo_spark', 'vargo_spark');

-- Opportunity Agent Attribution
-- First delete any duplicates that would collide when remapping
DELETE FROM public.opportunity_agent_attribution 
WHERE agent_id IN ('haya_muse_2') 
  AND opportunity_id IN (SELECT opportunity_id FROM public.opportunity_agent_attribution WHERE agent_id = 'haya_muse_1');

DELETE FROM public.opportunity_agent_attribution 
WHERE agent_id IN ('vargo_spark') 
  AND opportunity_id IN (SELECT opportunity_id FROM public.opportunity_agent_attribution WHERE agent_id = 'katoo_spark');

UPDATE public.opportunity_agent_attribution SET agent_id = 'bago_muse' WHERE agent_id = 'sandy_muse';
UPDATE public.opportunity_agent_attribution SET agent_id = 'haya_satnam' WHERE agent_id IN ('haya_muse_1', 'haya_muse_2');
UPDATE public.opportunity_agent_attribution SET agent_id = 'kattu_ai' WHERE agent_id IN ('katoo_spark', 'vargo_spark');

-- Data Sources
UPDATE public.data_sources SET owning_agent_id = 'bago_muse' WHERE owning_agent_id = 'sandy_muse';
UPDATE public.data_sources SET owning_agent_id = 'haya_satnam' WHERE owning_agent_id IN ('haya_muse_1', 'haya_muse_2');
UPDATE public.data_sources SET owning_agent_id = 'kattu_ai' WHERE owning_agent_id IN ('katoo_spark', 'vargo_spark');

-- Source Sync Results
UPDATE public.source_sync_results SET owning_agent_id = 'bago_muse' WHERE owning_agent_id = 'sandy_muse';
UPDATE public.source_sync_results SET owning_agent_id = 'haya_satnam' WHERE owning_agent_id IN ('haya_muse_1', 'haya_muse_2');
UPDATE public.source_sync_results SET owning_agent_id = 'kattu_ai' WHERE owning_agent_id IN ('katoo_spark', 'vargo_spark');

-- Remove obsolete legacy agent rows (now safe since all foreign keys point to canonical 4 agents)
DELETE FROM public.agents WHERE id IN ('sandy_muse', 'haya_muse_1', 'haya_muse_2', 'katoo_spark', 'vargo_spark');

-- 4. Register Haya Satnam & Kattu AI Data Sources into public.data_sources
-- Haya Satnam Sources (Muse_Satnam root 1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-)
INSERT INTO public.data_sources (
    id, name, type, owning_agent_id, pipeline, classification,
    url, drive_id, folder_id, purpose, sync_enabled, sync_mode, connection_status,
    notes, created_at, updated_at
) VALUES
(
    'satnam_global_jobs',
    'Global Jobs & Freelance (Canada, South America, MENA, Japan, India, South Korea)',
    'Drive Workbooks & Regional Sheets',
    'haya_satnam',
    'visa_jobs',
    'ACTIVE CANONICAL',
    'https://drive.google.com/drive/folders/1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    null,
    '1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    'Global job search across Canada, South America, MENA, Japan, India, and South Korea with relocation sponsorship',
    true,
    'AUTOMATIC_5H',
    'Connected',
    'Muse_Satnam independent workspace repository',
    NOW(),
    NOW()
),
(
    'satnam_global_pipeline',
    'Global Application Pipeline',
    'Drive Workbooks & Regional Sheets',
    'haya_satnam',
    'visa_jobs',
    'ACTIVE CANONICAL',
    'https://drive.google.com/drive/folders/1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    null,
    '1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    'Global multi-country staged applications, interviews, and follow-up pipeline',
    true,
    'AUTOMATIC_5H',
    'Connected',
    'Central submission pipeline for Muse_Satnam',
    NOW(),
    NOW()
),
(
    'satnam_portal_directory',
    'Global Portal Directory',
    'Drive Workbooks & Regional Sheets',
    'haya_satnam',
    'visa_jobs',
    'ACTIVE SUPPORTING',
    'https://drive.google.com/drive/folders/1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    null,
    '1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    'Verified international company career portals and corporate ATS entry points',
    false,
    'MANUAL_ONLY',
    'Connected',
    'Directory of direct employer career sites',
    NOW(),
    NOW()
),
(
    'satnam_hpv_prospecting',
    'HPV Client Prospecting',
    'Drive Workbooks & Regional Sheets',
    'haya_satnam',
    'freelance_leads',
    'ACTIVE CANONICAL',
    'https://drive.google.com/drive/folders/1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    null,
    '1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    'High Potential Visa and private commercial client prospecting stream',
    true,
    'AUTOMATIC_5H',
    'Connected',
    'B2B commercial client research in Muse_Satnam',
    NOW(),
    NOW()
),
(
    'satnam_businesslending_social',
    'BusinessLending.uk Social Media',
    'Drive Workbooks & Regional Sheets',
    'haya_satnam',
    'freelance_leads',
    'ACTIVE CANONICAL',
    'https://drive.google.com/drive/folders/1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    null,
    '1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    'UK SME social media command center and high-value loan brokerage marketing leads',
    true,
    'AUTOMATIC_5H',
    'Connected',
    'Commercial financial services outreach',
    NOW(),
    NOW()
),
(
    'satnam_system_registry',
    'Documentation & System Registry',
    'Drive Workbooks & Regional Sheets',
    'haya_satnam',
    'operations',
    'ACTIVE SUPPORTING',
    'https://drive.google.com/drive/folders/1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    null,
    '1sLbCzLwWZzRcihxM5LlyrZokxtmw_Dj-',
    'Muse_Satnam operational guidelines, agent prompts, and account documentation',
    false,
    'MANUAL_ONLY',
    'Connected',
    'Internal workspace architecture documentation',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    owning_agent_id = EXCLUDED.owning_agent_id,
    pipeline = EXCLUDED.pipeline,
    purpose = EXCLUDED.purpose,
    folder_id = EXCLUDED.folder_id,
    updated_at = NOW();

-- Kattu AI Regional Research Sheets
INSERT INTO public.data_sources (
    id, name, type, owning_agent_id, pipeline, classification,
    url, spreadsheet_id, purpose, sync_enabled, sync_mode, connection_status,
    notes, created_at, updated_at
) VALUES
(
    'kattu_india_regional',
    'Projects KattuAI — India Regional Job Research',
    'Native Google Sheet',
    'kattu_ai',
    'remote_jobs',
    'ACTIVE CANONICAL',
    'https://docs.google.com/spreadsheets/d/15hOKXuvZDIrytvqRLQNvLQx4w7wTdFS-DSnvT1XIkOw/edit',
    '15hOKXuvZDIrytvqRLQNvLQx4w7wTdFS-DSnvT1XIkOw',
    'India regional software developer positions, tech hub hiring, and remote contracts (Argon 4 + Spark)',
    true,
    'AUTOMATIC_5H',
    'Connected',
    'Dynamic dated tabs (e.g. 20Oct, 21Oct, 22Oct) discovered automatically',
    NOW(),
    NOW()
),
(
    'kattu_eu_regional',
    'Projects KattuAI — EU Regional Job Research',
    'Native Google Sheet',
    'kattu_ai',
    'visa_jobs',
    'ACTIVE CANONICAL',
    'https://docs.google.com/spreadsheets/d/1wi4i3qpDLOzfNXa5_AR6Bvhb4w40xTr4QQmM9qGAzj4/edit',
    '1wi4i3qpDLOzfNXa5_AR6Bvhb4w40xTr4QQmM9qGAzj4',
    'European Union on-site & distributed developer roles with relocation / work authorization',
    true,
    'AUTOMATIC_5H',
    'Connected',
    'Dynamic dated tabs discovered automatically',
    NOW(),
    NOW()
),
(
    'kattu_uk_regional',
    'Projects KattuAI — UK Regional Job Research',
    'Native Google Sheet',
    'kattu_ai',
    'visa_jobs',
    'ACTIVE CANONICAL',
    'https://docs.google.com/spreadsheets/d/1ECo6MFxrDXpOQlTyCRGor5XUgE8e4t2zL-LXWJRFN5A/edit',
    '1ECo6MFxrDXpOQlTyCRGor5XUgE8e4t2zL-LXWJRFN5A',
    'United Kingdom developer roles, graduate technology programmes, and visa sponsor verification',
    true,
    'AUTOMATIC_5H',
    'Connected',
    'Dynamic dated tabs discovered automatically',
    NOW(),
    NOW()
),
(
    'kattu_usa_regional',
    'Projects KattuAI — USA Regional Job Research',
    'Native Google Sheet',
    'kattu_ai',
    'remote_jobs',
    'ACTIVE CANONICAL',
    'https://docs.google.com/spreadsheets/d/1tIi0TiQ0L1fNUcqTWTsRVJhV-69g3pbrHGGkhmGGvyo/edit',
    '1tIi0TiQ0L1fNUcqTWTsRVJhV-69g3pbrHGGkhmGGvyo',
    'US global remote contracts open to worldwide / EU contractors (Argon 4 + Spark)',
    true,
    'AUTOMATIC_5H',
    'Connected',
    'Dynamic dated tabs discovered automatically',
    NOW(),
    NOW()
),
(
    'kattu_daily_qa_audit',
    'Projects KattuAI — Daily Data QA & Verification',
    'Native Google Sheet',
    'kattu_ai',
    'operations',
    'ACTIVE CANONICAL',
    null,
    null,
    'Daily data quality audit, website verification, link integrity, and duplicate prevention',
    true,
    'AUTOMATIC_5H',
    'Connected',
    'Automated daily verification service for Kattu AI',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    owning_agent_id = EXCLUDED.owning_agent_id,
    pipeline = EXCLUDED.pipeline,
    purpose = EXCLUDED.purpose,
    spreadsheet_id = EXCLUDED.spreadsheet_id,
    updated_at = NOW();
