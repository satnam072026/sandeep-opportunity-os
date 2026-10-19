/**
 * Sandeep Opportunity OS — Canonical Data Sources & Resource Registry (TypeScript Definitions)
 *
 * Central source of truth for all Google Drive, Google Sheets, local Muse,
 * and Supabase infrastructure resources.
 */

import {
  DATA_SOURCE_REGISTRY as registryJs,
  getDataSources as getDataSourcesJs,
  getDataSourceById as getDataSourceByIdJs,
  getDataSourcesByCategory as getDataSourcesByCategoryJs,
  getDataSourcesByAgent as getDataSourcesByAgentJs,
  getNextScheduledSync as getNextScheduledSyncJs
} from "./dataSources.mjs";

export type DataSourceType =
  | "Native Google Sheet"
  | "Drive XLSX"
  | "Drive Folder"
  | "Local File"
  | "Database";

export type DataSourceStatus =
  | "Connected"
  | "Permission required"
  | "Stale"
  | "Unused / available"
  | "Local only"
  | "Legacy / Disconnected"
  | "Connected (DB)";

export type SyncMode =
  | "AUTOMATIC_5H"
  | "AUTOMATIC_6H"
  | "MANUAL_ONLY"
  | "LOCAL_ONLY"
  | "DISABLED"
  | "DATABASE_STORAGE";

export type PipelineCategory =
  | "social_jobs"
  | "visa_jobs"
  | "masters_scholarships"
  | "freelance_leads"
  | "remote_jobs"
  | "operations"
  | "general";

export interface DataSourceResource {
  id: string;
  name: string;
  type: DataSourceType;
  owningAgentId?: string;
  url: string | null;
  driveId?: string;
  spreadsheetId?: string;
  folderId?: string;
  purpose: string;
  pipeline: PipelineCategory;
  syncEnabled: boolean;
  syncMode: SyncMode;
  status: DataSourceStatus;
  lastSuccessfulSync?: string | null;
  lastAttempt?: string | null;
  recordCount?: number | null;
  recordsFetched?: number;
  recordsParsed?: number;
  recordsAccepted?: number;
  recordsDuplicated?: number;
  recordsGated?: number;
  canonicalRecords?: number;
  notes: string;
  verifiedTabs?: string[];
  staleWarning?: string;
  isLegacy?: boolean;
}

export const DATA_SOURCE_REGISTRY: ReadonlyArray<DataSourceResource> =
  registryJs as unknown as ReadonlyArray<DataSourceResource>;

export const getDataSources: () => ReadonlyArray<DataSourceResource> =
  getDataSourcesJs as unknown as () => ReadonlyArray<DataSourceResource>;

export const getDataSourceById: (id: string) => DataSourceResource | undefined =
  getDataSourceByIdJs as unknown as (id: string) => DataSourceResource | undefined;

export const getDataSourcesByCategory: (
  category: "sheets" | "drive" | "local" | "supabase" | "legacy" | "database" | "d1" | "cloudflare" | "neon"
) => DataSourceResource[] = getDataSourcesByCategoryJs as unknown as (
  category: "sheets" | "drive" | "local" | "supabase" | "legacy" | "database" | "d1" | "cloudflare" | "neon"
) => DataSourceResource[];

export const getDataSourcesByAgent: (
  agentId: string
) => DataSourceResource[] = getDataSourcesByAgentJs as unknown as (
  agentId: string
) => DataSourceResource[];

export const getNextScheduledSync: (referenceTime?: Date) => {
  iso: string;
  formattedUtc: string;
  minutesRemaining: number;
} = getNextScheduledSyncJs;
