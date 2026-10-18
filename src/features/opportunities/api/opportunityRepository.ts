import { supabaseClient, isSupabaseConfigured } from "../../../lib/supabase/client";
import verifiedSeed from "../../../data/verified_seed_24.json";
import { applyWorkflowTransition, syncDatabaseToSheetRows } from "../../../engine/core";
import { executeSyncPipeline, loadLatestSyncTelemetry, type SyncTelemetry, type SourceSyncDiagnostic } from "../../../pipeline/syncService";
import { getNextScheduledSync } from "../../../config/dataSources";
import { saveCachedOpportunities, getCachedOpportunities } from "../../../lib/cache/opportunityCache";
import type {
  OpportunityRecord,
  CandidateProfile,
  WorkflowState,
  WorkflowStatus,
  PriorityLevel,
  ActivityEvent
} from "../../../types/opportunity";

const CRM_STORAGE_KEY = "sandeep_opp_os_crm_v2_state";
const PROFILE_STORAGE_KEY = "sandeep_opp_os_profile_v2_state";

export const NATIVE_SHEET_ID = "1-jsydfLBJibFJjy4dabDCOZpG7m_6bJxdxPYRWHJ1x0";
export const UPLOADED_XLSX_ID = "1F8p-KNl8PLMfRIzRxZ0nFORRHOuF5qL1";

function getLatestVerificationTimestamp(records: OpportunityRecord[]): string {
  const timestamps = records
    .map((record) => record.last_verified_at)
    .filter((value): value is string => Boolean(value))
    .sort();
  return timestamps[timestamps.length - 1] || "UNKNOWN";
}

export function isProductionOpportunity(opp: OpportunityRecord): boolean {
  if (!opp || !opp.id) return false;
  const id = opp.id.toLowerCase();
  return !id.startsWith("opp_test") && !id.startsWith("test-") && !id.includes("opp-test");
}

export type DataSourceMode = "CLOUDFLARE_D1_LIVE" | "NEON_LIVE" | "SUPABASE_LIVE" | "SEED_IMPORT_ADAPTER";

export interface RepositoryState {
  mode: DataSourceMode;
  opportunities: OpportunityRecord[];
  profile: CandidateProfile;
  nativeSheetId: string;
  uploadedXlsxId: string;
  lastSyncedAt: string;
  syncTelemetry?: SyncTelemetry | null;
}

async function cloudflareRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  if (!response.ok) throw new Error(`Cloudflare API request failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function authenticateCloudflareWrite(): Promise<boolean> {
  const password = window.prompt("Enter the CRM administrator password to save this change:");
  if (!password) return false;
  try {
    await cloudflareRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password })
    });
    return true;
  } catch {
    window.alert("The administrator password was not accepted.");
    return false;
  }
}

function loadPersistedCrmMap(): Record<string, Partial<OpportunityRecord>> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(CRM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Partial<OpportunityRecord>>) : {};
  } catch {
    return {};
  }
}

function loadPersistedProfile(seedProfile: CandidateProfile): CandidateProfile {
  if (typeof window === "undefined" || !window.localStorage) return seedProfile;
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return seedProfile;
  try {
    return { ...seedProfile, ...(JSON.parse(raw) as Partial<CandidateProfile>) };
  } catch {
    return seedProfile;
  }
}

function savePersistedCrmMap(map: Record<string, Partial<OpportunityRecord>>): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage quota or private mode
  }
}

async function fetchAllOpportunitiesFromSupabase(
  client: NonNullable<typeof supabaseClient>
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  const allRows: Record<string, unknown>[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from("opportunities")
      .select("*, workflow_states(*)")
      .order("score_total", { ascending: false })
      .range(from, to);

    if (error) {
      if (allRows.length > 0) return allRows;
      throw error;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

function mapSupabaseRowsToOpportunities(
  data: Record<string, unknown>[],
  persistedMap: Record<string, Partial<OpportunityRecord>>
): OpportunityRecord[] {
  return data.map((d: Record<string, unknown>) => {
    const id = d.id as string;
    const localSaved = persistedMap[id];
    const rawWf = d.workflow_states;
    const wf =
      Array.isArray(rawWf) && rawWf[0]
        ? (rawWf[0] as Record<string, unknown>)
        : ((rawWf as Record<string, unknown>) || {});

    const userStatus =
      localSaved?.user_status ||
      localSaved?.workflow?.status ||
      (wf.status as WorkflowStatus) ||
      (d.status as WorkflowStatus) ||
      (d.user_status as WorkflowStatus) ||
      "New";
    const userPriority =
      localSaved?.priority ||
      localSaved?.workflow?.priority ||
      (wf.priority as PriorityLevel) ||
      (d.priority as PriorityLevel) ||
      "P2";
    const userFav =
      typeof localSaved?.favorite === "boolean"
        ? localSaved.favorite
        : typeof localSaved?.workflow?.favorite === "boolean"
          ? localSaved.workflow.favorite
          : typeof wf.favorite === "boolean"
            ? (wf.favorite as boolean)
            : ((d.favorite as boolean) ?? false);
    const userFollowUp =
      localSaved?.follow_up_date !== undefined
        ? localSaved.follow_up_date
        : localSaved?.workflow?.follow_up_date !== undefined
          ? localSaved.workflow.follow_up_date
          : wf.follow_up_date !== undefined
            ? (wf.follow_up_date as string | null)
            : ((d.follow_up_date as string | null) ?? null);
    const userNotes =
      localSaved?.personal_notes ??
      localSaved?.workflow?.personal_notes ??
      (wf.personal_notes !== undefined ? (wf.personal_notes as string) : ((d.personal_notes as string) ?? ""));
    const userContacted =
      localSaved?.contacted_date !== undefined
        ? localSaved.contacted_date
        : localSaved?.workflow?.contacted_date !== undefined
          ? localSaved.workflow.contacted_date
          : wf.contacted_date !== undefined
            ? (wf.contacted_date as string | null)
            : ((d.contacted_date as string | null) ?? null);
    const userApplied =
      localSaved?.applied_date !== undefined
        ? localSaved.applied_date
        : localSaved?.workflow?.applied_date !== undefined
          ? localSaved.workflow.applied_date
          : wf.applied_date !== undefined
            ? (wf.applied_date as string | null)
            : ((d.applied_date as string | null) ?? null);

    return {
      ...(d as unknown as OpportunityRecord),
      workflow: {
        status: userStatus,
        priority: userPriority,
        favorite: userFav,
        follow_up_date: userFollowUp,
        personal_notes: userNotes,
        contacted_date: userContacted,
        applied_date: userApplied
      },
      user_status: userStatus,
      status: userStatus,
      priority: userPriority,
      favorite: userFav,
      follow_up_date: userFollowUp,
      personal_notes: userNotes,
      contacted_date: userContacted,
      applied_date: userApplied,
      activity_history:
        localSaved?.activity_history ||
        (Array.isArray(d.activity_history)
          ? (d.activity_history as unknown as ActivityEvent[])
          : [
              {
                at: (d.last_verified_at as string) || new Date().toISOString(),
                label: "Verified record from Supabase database"
              }
            ])
    };
  });
}

export async function getFastCachedState(): Promise<RepositoryState | null> {
  const cached = await getCachedOpportunities();
  const seedOpportunities = (verifiedSeed.opportunities as unknown as OpportunityRecord[]).map(
    (item) => ({ ...item })
  );
  const oppsToUse = cached && cached.length > 0 ? cached : seedOpportunities;

  const persistedMap = loadPersistedCrmMap();
  const seedProfile = verifiedSeed.candidate_profile as unknown as CandidateProfile;
  const profile = loadPersistedProfile(seedProfile);

  const merged = oppsToUse.map((opp) => {
    const saved = persistedMap[opp.id];
    if (!saved) return opp;
    return {
      ...opp,
      ...saved,
      workflow: {
        ...opp.workflow,
        ...(saved.workflow || {})
      },
      activity_history: saved.activity_history || opp.activity_history
    };
  });

  const seenCachedIds = new Set<string>();
  const deduplicatedCached: OpportunityRecord[] = [];
  for (const opp of merged) {
    if (opp.id && !seenCachedIds.has(opp.id)) {
      seenCachedIds.add(opp.id);
      deduplicatedCached.push(opp);
    } else if (!opp.id) {
      deduplicatedCached.push(opp);
    }
  }

  return {
    mode: isSupabaseConfigured && supabaseClient ? "SUPABASE_LIVE" : "SEED_IMPORT_ADAPTER",
    opportunities: deduplicatedCached,
    profile,
    nativeSheetId: NATIVE_SHEET_ID,
    uploadedXlsxId: UPLOADED_XLSX_ID,
    lastSyncedAt: getLatestVerificationTimestamp(deduplicatedCached),
    syncTelemetry: loadLatestSyncTelemetry()
  };
}

export async function fetchOpportunityState(): Promise<RepositoryState> {
  const seedOpportunities = (verifiedSeed.opportunities as unknown as OpportunityRecord[]).map(
    (item) => ({ ...item })
  );
  const seedProfile = verifiedSeed.candidate_profile as unknown as CandidateProfile;
  const profile = loadPersistedProfile(seedProfile);

  // Primary production source: same-origin Cloudflare Worker backed by D1.
  try {
    const live = await cloudflareRequest<{ opportunities: OpportunityRecord[]; profile?: CandidateProfile }>("/api/state");
    if (Array.isArray(live.opportunities) && live.opportunities.length > 0) {
      const opportunities = live.opportunities.filter(isProductionOpportunity);
      void saveCachedOpportunities(opportunities);
      return {
        mode: "CLOUDFLARE_D1_LIVE",
        opportunities,
        profile: live.profile ? { ...profile, ...live.profile } : profile,
        nativeSheetId: NATIVE_SHEET_ID,
        uploadedXlsxId: UPLOADED_XLSX_ID,
        lastSyncedAt: getLatestVerificationTimestamp(opportunities),
        syncTelemetry: loadLatestSyncTelemetry()
      };
    }
  } catch {
    // Local preview and legacy deployments continue through the existing fallbacks.
  }

  // Legacy fallback: fetch from Neon PostgreSQL via backend API.
  try {
    const res = await fetch("/api/opportunities");
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
      if (Array.isArray(data.opportunities) && data.opportunities.length > 0) {
        const persistedMap = loadPersistedCrmMap();
        const mergedOpps = (data.opportunities as OpportunityRecord[]).map((opp) => {
          const saved = persistedMap[opp.id];
          if (!saved) return opp;
          return {
            ...opp,
            ...saved,
            workflow: {
              ...opp.workflow,
              ...(saved.workflow || {})
            },
            activity_history: saved.activity_history || opp.activity_history
          };
        });

        const seenNeonIds = new Set<string>();
        const uniqueNeonOpps: OpportunityRecord[] = [];
        for (const opp of mergedOpps) {
          if (opp.id && !seenNeonIds.has(opp.id)) {
            seenNeonIds.add(opp.id);
            uniqueNeonOpps.push(opp);
          } else if (!opp.id) {
            uniqueNeonOpps.push(opp);
          }
        }
        const finalOpps = uniqueNeonOpps.filter(isProductionOpportunity);
        if (finalOpps.length === 0) {
          throw new Error("Neon returned no production opportunities");
        }
        void saveCachedOpportunities(finalOpps);

        let telemetry = data.telemetry as SyncTelemetry | null;
        if (telemetry && !telemetry.nextScheduledSyncUtc) {
          const nextSync = getNextScheduledSync(new Date(telemetry.startedAt || Date.now()));
          telemetry = {
            ...telemetry,
            nextScheduledSyncIso: nextSync.iso,
            nextScheduledSyncUtc: nextSync.formattedUtc
          };
        }

        return {
          mode: "NEON_LIVE",
          opportunities: finalOpps,
          profile,
          nativeSheetId: NATIVE_SHEET_ID,
          uploadedXlsxId: UPLOADED_XLSX_ID,
          lastSyncedAt: getLatestVerificationTimestamp(finalOpps),
          syncTelemetry: telemetry || loadLatestSyncTelemetry()
        };
      }
    }
  }
} catch (err) {
    console.warn("Neon API fetch failed or offline, falling back to Supabase/Cache:", err);
  }

  // 2. Secondary: Fall back to Supabase if configured
  if (isSupabaseConfigured && supabaseClient) {
    try {
      const data = await fetchAllOpportunitiesFromSupabase(supabaseClient);

      if (Array.isArray(data) && data.length > 0) {
        // Hydrate multi-device operations telemetry from canonical research_runs table
        let dbTelemetry: SyncTelemetry | null = null;
        try {
          const { data: runs } = await supabaseClient
            .from("research_runs")
            .select("*")
            .order("run_timestamp", { ascending: false })
            .limit(1);

          if (runs && runs.length > 0) {
            const r = runs[0];
            const nextSync = getNextScheduledSync(new Date(r.run_timestamp));
            dbTelemetry = {
              runId: r.run_id,
              startedAt: r.run_timestamp,
              completedAt: r.run_timestamp,
              durationMs: Math.round(Number(r.duration_sec || 0) * 1000),
              status: (r.sheets_sync_status as "SUCCESS" | "PARTIAL" | "FAILED") || "SUCCESS",
              sourcesAttempted: r.sources_checked || 3,
              sourcesSucceeded: r.sheets_sync_status === "SUCCESS" ? r.sources_checked : 0,
              sourcesFailed: r.sheets_sync_status === "SUCCESS" ? 0 : 1,
              recordsAdded: r.discovered_count || 0,
              recordsUpdated: r.accepted_count || 0,
              recordsUnchanged: 0,
              recordsGated: r.filtered_count || 0,
              userFieldsPreserved: r.accepted_count || 0,
              totalRecords: r.accepted_count || data.length,
              sourceDiagnostics: Array.isArray((r as Record<string, unknown>).source_diagnostics)
                ? ((r as Record<string, unknown>).source_diagnostics as SourceSyncDiagnostic[])
                : [],
              nextScheduledSyncIso: nextSync.iso,
              nextScheduledSyncUtc: nextSync.formattedUtc
            };
          }
        } catch {
          // Fall back to local storage telemetry if research_runs query fails
        }

        const persistedMap = loadPersistedCrmMap();
        const mappedOpportunities = mapSupabaseRowsToOpportunities(data, persistedMap);
        const seenSbIds = new Set<string>();
        const uniqueSbOpps: OpportunityRecord[] = [];
        for (const opp of mappedOpportunities) {
          if (opp.id && !seenSbIds.has(opp.id)) {
            seenSbIds.add(opp.id);
            uniqueSbOpps.push(opp);
          } else if (!opp.id) {
            uniqueSbOpps.push(opp);
          }
        }
        const finalOpps = uniqueSbOpps.filter(isProductionOpportunity);

        // Cache opportunities persistently for zero-latency retrieval and offline durability
        void saveCachedOpportunities(finalOpps);

        return {
          mode: "SUPABASE_LIVE",
          opportunities: finalOpps,
          profile,
          nativeSheetId: NATIVE_SHEET_ID,
          uploadedXlsxId: UPLOADED_XLSX_ID,
          lastSyncedAt: getLatestVerificationTimestamp(finalOpps),
          syncTelemetry: dbTelemetry || loadLatestSyncTelemetry()
        };
      }
    } catch (err) {
      console.warn("Supabase fetch failed or network offline, falling back to cache", err);
    }
  }

  // Check persistent cache before falling back to seed items
  const cached = await getCachedOpportunities();
  if (cached && cached.length > 0) {
    const persistedMap = loadPersistedCrmMap();
    const merged = cached.map((opp) => {
      const saved = persistedMap[opp.id];
      if (!saved) return opp;
      return {
        ...opp,
        ...saved,
        workflow: {
          ...opp.workflow,
          ...(saved.workflow || {})
        },
        activity_history: saved.activity_history || opp.activity_history
      };
    });
    const finalOpps = merged.filter(isProductionOpportunity);

    return {
      mode: isSupabaseConfigured && supabaseClient ? "SUPABASE_LIVE" : "SEED_IMPORT_ADAPTER",
      opportunities: finalOpps,
      profile,
      nativeSheetId: NATIVE_SHEET_ID,
      uploadedXlsxId: UPLOADED_XLSX_ID,
      lastSyncedAt: getLatestVerificationTimestamp(finalOpps),
      syncTelemetry: loadLatestSyncTelemetry()
    };
  }

  // Clearly marked SEED_IMPORT_ADAPTER using the 24 real verified opportunities + persisted CRM state
  const persistedMap = loadPersistedCrmMap();
  const merged = seedOpportunities.map((opp) => {
    const saved = persistedMap[opp.id];
    if (!saved) return opp;
    return {
      ...opp,
      ...saved,
      workflow: {
        ...opp.workflow,
        ...(saved.workflow || {})
      },
      activity_history: saved.activity_history || opp.activity_history
    };
  });
  const finalOpps = merged.filter(isProductionOpportunity);

  return {
    mode: "SEED_IMPORT_ADAPTER",
    opportunities: finalOpps,
    profile,
    nativeSheetId: NATIVE_SHEET_ID,
    uploadedXlsxId: UPLOADED_XLSX_ID,
    lastSyncedAt: getLatestVerificationTimestamp(finalOpps),
    syncTelemetry: loadLatestSyncTelemetry()
  };
}

export async function performOpportunitySync(
  currentRecords: OpportunityRecord[],
  candidateProfile?: CandidateProfile
): Promise<{
  state: RepositoryState;
  telemetry: SyncTelemetry;
}> {
  let telemetry: SyncTelemetry | null = null;
  let activeRecords = currentRecords;
  let isNeon = false;

  // 1. Primary: Server-side unified sync endpoint (runs Google ingestion -> Neon PostgreSQL)
  try {
    const res = await fetch("/api/sync", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      telemetry = data as SyncTelemetry;

      // Re-fetch fresh state from Neon
      const oppsRes = await fetch("/api/opportunities");
      if (oppsRes.ok) {
        const oppsData = await oppsRes.json();
        if (Array.isArray(oppsData.opportunities) && oppsData.opportunities.length > 0) {
          activeRecords = oppsData.opportunities as OpportunityRecord[];
          isNeon = true;
        }
      }
    }
  } catch (err) {
    console.warn("Server-side sync endpoint failed, falling back to client pipeline:", err);
  }

  // 2. Fallback: Edge function or client-side sync pipeline
  if (!telemetry) {
    const fallbackResult = await executeSyncPipeline(currentRecords, candidateProfile);
    activeRecords = fallbackResult.records;
    telemetry = fallbackResult.telemetry;

    if (isSupabaseConfigured && supabaseClient) {
      try {
        const freshRows = await fetchAllOpportunitiesFromSupabase(supabaseClient);
        if (freshRows.length > 0) {
          const map = loadPersistedCrmMap();
          activeRecords = mapSupabaseRowsToOpportunities(freshRows, map);
        }
      } catch {
        // Continue with returned records
      }
    }
  }

  const cleanRecords = activeRecords.filter(isProductionOpportunity);
  const map = loadPersistedCrmMap();
  for (const r of cleanRecords) {
    if (r.workflow || r.user_status) {
      map[r.id] = {
        user_status: r.user_status,
        priority: r.priority,
        workflow: r.workflow,
        activity_history: r.activity_history
      };
    }
  }
  savePersistedCrmMap(map);
  void saveCachedOpportunities(cleanRecords);

  const state: RepositoryState = {
    mode: isNeon
      ? "NEON_LIVE"
      : isSupabaseConfigured && supabaseClient
        ? "SUPABASE_LIVE"
        : "SEED_IMPORT_ADAPTER",
    opportunities: cleanRecords,
    profile:
      candidateProfile ||
      loadPersistedProfile(verifiedSeed.candidate_profile as unknown as CandidateProfile),
    nativeSheetId: NATIVE_SHEET_ID,
    uploadedXlsxId: UPLOADED_XLSX_ID,
    lastSyncedAt: telemetry.completedAt,
    syncTelemetry: telemetry
  };

  return { state, telemetry };
}

export async function persistCandidateProfile(profile: CandidateProfile): Promise<CandidateProfile> {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Storage quota or private mode. Keep the in-memory profile unchanged.
    }
  }
  const saveRemote = () => cloudflareRequest<{ ok: boolean }>("/api/profile", {
    method: "PUT",
    body: JSON.stringify(profile)
  });
  try {
    await saveRemote();
  } catch (error) {
    if (error instanceof Error && error.message.includes("401") && await authenticateCloudflareWrite()) {
      await saveRemote();
    }
  }
  return profile;
}

export async function persistWorkflowMutation(
  record: OpportunityRecord,
  patch: Partial<WorkflowState>
): Promise<OpportunityRecord> {
  const updated = applyWorkflowTransition(record, patch);

  const saveCloudflare = () => cloudflareRequest(`/api/workflows/${encodeURIComponent(updated.id)}`, {
    method: "PUT",
    body: JSON.stringify(updated.workflow)
  });
  let savedToCloudflare = false;
  try {
    await saveCloudflare();
    savedToCloudflare = true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("401") && await authenticateCloudflareWrite()) {
      await saveCloudflare();
      savedToCloudflare = true;
    }
  }

  // 1. Immediately persist synchronously to local storage map for instant zero-latency UI durability
  const map = loadPersistedCrmMap();
  map[updated.id] = {
    user_status: updated.user_status,
    priority: updated.priority,
    favorite: updated.favorite,
    follow_up_date: updated.follow_up_date,
    contacted_date: updated.contacted_date,
    applied_date: updated.applied_date,
    personal_notes: updated.personal_notes,
    workflow: updated.workflow,
    activity_history: updated.activity_history
  };
  savePersistedCrmMap(map);

  // Legacy fallback for deployments that have not moved to the Cloudflare Worker.
  if (!savedToCloudflare) {
    try {
      await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: updated.id, patch })
      });
    } catch (err) {
      console.warn("Legacy workflow persistence error:", err);
    }
  }

  // 3. Persist to canonical Supabase database for dual-write compatibility
  if (isSupabaseConfigured && supabaseClient) {
    try {
      await supabaseClient.from("workflow_states").upsert(
        {
          opportunity_id: updated.id,
          status: updated.workflow.status,
          priority: updated.workflow.priority,
          favorite: updated.workflow.favorite,
          follow_up_date: updated.workflow.follow_up_date,
          contacted_date: updated.workflow.contacted_date,
          applied_date: updated.workflow.applied_date,
          personal_notes: updated.workflow.personal_notes,
          updated_at: new Date().toISOString()
        },
        { onConflict: "opportunity_id" }
      );
    } catch {
      // Local storage and Neon copies are preserved
    }
  }

  return updated;
}

export function simulateIdempotentResearchRefresh(
  currentRecords: OpportunityRecord[]
): { records: OpportunityRecord[]; preservedCount: number } {
  const seedRecords = verifiedSeed.opportunities as unknown as Record<string, unknown>[];
  const existingRows = currentRecords.map((r) => ({
    ...r,
    record_id: r.id,
    user_status: r.workflow.status,
    priority: r.workflow.priority,
    favorite: r.workflow.favorite,
    follow_up_date: r.workflow.follow_up_date,
    contacted_date: r.workflow.contacted_date,
    applied_date: r.workflow.applied_date,
    personal_notes: r.workflow.personal_notes
  }));

  const synced = syncDatabaseToSheetRows(existingRows, seedRecords);
  return {
    records: synced.rows as unknown as OpportunityRecord[],
    preservedCount: synced.preservedUserFields
  };
}
