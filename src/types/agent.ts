/**
 * Sandeep Opportunity OS — AI Research Agent Types & Contracts
 *
 * Defines the 5-Agent Research Fleet:
 * 1. Sandy Muse — Lead AI Scout & Social Hunter (MUSE Sheet: ALL LEADS)
 * 2. Haya Muse 1 — Enterprise Application & Visa Employment Hunter (MASTER Tracker XLSX)
 * 3. Haya Muse 2 — Academic & Funded Scholarship Scout (Master's Workbook)
 * 4. Vargo Spark — Direct Outreach & IT Agency Pipeline Specialist (Agencies & Outreach Logs)
 * 5. Katoo Spark — Remote EMEA & Distributed Developer Scout (Remote Indexers & Trackers)
 */

import type { PipelineCategory } from "./opportunity";

export type AgentId =
  | "bago_muse"
  | "haya_satnam"
  | "kattu_ai"
  | "system"
  | "sandy_muse"
  | "haya_muse_1"
  | "haya_muse_2"
  | "vargo_spark"
  | "katoo_spark";

export type AgentHealthStatus =
  | "Healthy"
  | "Running"
  | "Waiting"
  | "Stale"
  | "Permission Required"
  | "Setup Required"
  | "Failed";

export interface AgentConfig {
  id: AgentId;
  name: string;
  slug?: string;
  codename: string;
  role: string;
  sourceType: string;
  avatarIcon: string;
  themeColor: string;
  accentBg: string;
  status?: "active" | "inactive" | "paused" | "error" | "setup_required";
  workspaceType?: string;
  driveRootId?: string | null;
  driveRootName?: string | null;
  ownerAccountLabel?: string;
  assignedPipelines: PipelineCategory[];
  connectedSources: string[]; // DataSourceResource IDs
  updateSchedule: string; // e.g. "Every 6–8 hours"
  lastAgentUpdate: string; // ISO string when agent updated its Sheet
  lastCmsIngestion: string; // ISO string when Opportunity OS ingested it
  health: AgentHealthStatus;
  recordsDiscovered: number;
  recordsAccepted: number;
  duplicateCount: number;
  gatedCount: number;
  errorMessage?: string | null;
  description: string;
  capabilities: string[];
}

export interface AgentProvenance {
  agentId: AgentId;
  agentName: string;
  sourceId: string;
  sourceName: string;
  sourceTab?: string;
  sourceRowRef?: string;
  sourceUrl: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastVerifiedAt: string;
  ingestionRunId?: string;
}
