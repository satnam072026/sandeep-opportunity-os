# Sandeep Opportunity OS — Master Architecture & Engineering Blueprint

## 1. Phase 0 Discovery & Reality Check

Before designing or writing application code, we inspected Sandeep Gautam's live portfolio ([sandeep-gautam.com](https://www.sandeep-gautam.com/), [About page](https://www.sandeep-gautam.com/about), [Work & Case Studies](https://www.sandeep-gautam.com/work), and [Developer & MCP Specifications](https://www.sandeep-gautam.com/developers)), his Google Drive workspace, existing job trackers, and his Hostinger + GitHub ([SandeepProjects](https://github.com/SandeepProjects)) deployment setup:

* **Verified Candidate Profile**:
  * **Education**: BSc (Hons) in Web Design & Development (First-Class Honours, graduated June 2026) from [UCLan Cyprus](https://www.uclancyprus.ac.cy/study/admissions/fees-scholarships/) (double degree awarded by UCLan Cyprus and University of Lancashire UK).
  * **Experience & Stack**: 2+ years of commercial freelance and digital agency frontend/UI engineering in Nicosia, Cyprus (`Ideaseven Digital Agency`, `Extramus Italy` Erasmus placement, and 15+ commercial client builds) using **React 19, TypeScript, Vite, TanStack Start/Router, Angular, Next.js, Tailwind CSS v4, WordPress/PHP, MySQL, and Supabase**.
  * **Flagship Proof Points**: [Orama Design & Build](https://www.sandeep-gautam.com/work/orama-design-build) (100-Lighthouse SSR renovation of a legacy GoDaddy contractor site in Hertfordshire/North London), [Nikolas Leontides Legal Booking](https://www.sandeep-gautam.com/work/nikolas-lawyer-booking) (interactive legal consultation scheduling portal in Nicosia), [Clipboard Sync](https://www.sandeep-gautam.com/work/clipboard-sync) (Supabase Realtime PWA on Hostinger), plus `BusinessLending.uk`, `House Pour Vodka`, and `Spirits Export Boost`.
  * **Non-Inferred Legal & Eligibility Rule**: Citizenship, EU/EEA statutory fee status, and Cyprus full-time work authorization category are initialized to `UNKNOWN` in the database and Profile Configurator so the scoring engine never fabricates legal status from Cyprus study history.
* **Hosting & Deployment Architecture**:
  * **GitHub (`SandeepProjects`) + Cloudflare Workers**: GitHub stores application code while live opportunity data resides in Cloudflare D1 and synchronizes by persistent `Record ID` to the 6-tab **Google Sheet** ([Sandeep Opportunity OS — Master Sync Sheet.xlsx](https://drive.google.com/file/d/19igEOYpemKTRojy4b94QPbCE78gT7n2O/view?usp=drivesdk)), so daily research updates appear without a Git commit or redeployment.

## 2. System Data Flow & Architecture

| Architectural Layer | Technology Choice | Role & Rationale |
| :--- | :--- | :--- |
| **Frontend Application** | React 19 + TypeScript (Strict) + Vite + Tailwind CSS | Matches Sandeep's core stack on [sandeep-gautam.com](https://www.sandeep-gautam.com/) and deploys cleanly to Hostinger via GitHub. |
| **Canonical Database** | Cloudflare D1 | Stores profiles, opportunities, workflow state, research runs, and leased agent jobs behind the same-origin Worker API. |
| **Synchronized Control Layer** | Google Sheets API v4 (6-Tab Master Workbook) | Provides a human-friendly 6-tab review layer synced by persistent `Record ID` (`OPP-FL-001` .. `OPP-RM-006`) without overwriting user CRM columns. |
| **Daily Automation** | Cloud Scheduled Runner + GitHub Actions Cron | Runs daily at 09:00 Cyprus time independently of Sandeep's laptop, executing discovery, verification, deduplication, scoring, and Sheet synchronization. |

## 3. Relational Data Model & Field Ownership Contract

| Field Category | Database / Sheet Columns | Ownership | Synchronization Behavior |
| :--- | :--- | :--- | :--- |
| **Persistent Identity** | `id` (`Record ID`), `category`, `organization_id` | System Immutable | Primary key used to match canonical database records to Google Sheet rows (`OPP-FL-*`, `OPP-VJ-*`, `OPP-MS-*`, `OPP-RM-*`). |
| **Machine Research Fields** | `title`, `source_url`, `secondary_sources`, `last_verified_at`, `confidence`, `score_total`, `score_components`, `details` | Machine-Owned | Updated in place during daily verification and scoring runs. |
| **Personal CRM Workflow** | `status`, `priority`, `favorite`, `follow_up_date`, `personal_notes`, `history` | **User-Owned (`[USER]`)** | **Strictly protected**: automated research refreshes and Sheet syncs never overwrite Sandeep's personal notes or statuses. |

## 4. Explainable 5-Component Scoring & Hard Eligibility Gates

| Pipeline Category | Component 1 | Component 2 | Component 3 | Component 4 | Component 5 | Hard Gate / Disqualification Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Freelance Client Leads** | Profile & Case-Study Fit (`30`) | Deterministic DOM Evidence (`25`) | Business Ticket Value (`20`) | Public Contact Path (`15`) | Urgency (`10`) | Requires verifiable, non-insulting technical improvement opportunities from live DOM inspection. |
| **2. Visa / Relocation Jobs** | Stack & Level Fit (`35`) | Official ATS Evidence (`20`) | Visa / Location Eligibility (`20`) | Employer & Comp Quality (`15`) | Urgency (`10`) | **Seniority Gate**: Roles requiring `5+ years` (Senior/Lead/Principal) receive `0` Eligibility & Quality and are excluded from Today Queue. |
| **3. Master's & Scholarships** | Academic & Portfolio Fit (`30`) | Funding Coverage Strength (`25`) | Eligibility Confidence (`25`) | Official Source Evidence (`10`) | Deadline Urgency (`10`) | Models **Programme Admission** and **Scholarship Funding** separately; never marks `CONFIRMED` unless official rules match profile. |
| **4. Remote Jobs & Internships** | Stack & Level Fit (`35`) | Official ATS Evidence (`20`) | Remote Region & TZ Eligibility (`20`) | Compensation & Role Quality (`15`) | Urgency (`10`) | **Regional Gate**: Remote roles legally excluding Cyprus/Europe (e.g. Africa-only or US-only) receive `0/20` Eligibility + `-20 pt` penalty. |

## 5. Security, Testing & Hostinger Deployment Runbook

1. **Zero Secret Exposure**: The browser receives no database credential. `DATABASE_URL`, `APP_SESSION_SECRET`, `APP_ADMIN_PASSWORD`, `AGENT_API_TOKEN`, `GOOGLE_PRIVATE_KEY`, and model API keys remain server-only deployment secrets.
2. **HTTP Security Headers (`public/_headers`)**: Enforces 2-year HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a locked-down `Content-Security-Policy`.
3. **Automated Verification Suite**: Run `node tests/opportunity_os.test.mjs` to execute all 8 unit and integration checks (URL canonicalization, fingerprint deduplication, multi-source provenance merging, Regional Restriction Gate, Seniority Gate, `UNKNOWN` profile preservation, idempotent Google Sheets sync, and full 9-stage pipeline execution).
