import React from "react";
import type { DataSourceMode } from "../../features/opportunities/api/opportunityRepository";

interface SyncStatusProps {
  mode: DataSourceMode;
  lastSyncedAt: string;
  onSyncNow: () => void;
  isSyncing?: boolean;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  mode,
  lastSyncedAt,
  onSyncNow,
  isSyncing = false
}) => (
  <div className="os-sync-control" role="region" aria-label="Global Data Synchronization">
    <span className="os-sync-pill" title={`Latest verified dataset: ${lastSyncedAt}`}>
      <span className="os-sync-dot" />
      <span className="mono" style={{ fontSize: "11px" }}>
        {mode === "CLOUDFLARE_D1_LIVE"
          ? "CLOUDFLARE D1 LIVE"
          : mode === "NEON_LIVE"
          ? "NEON POSTGRES LIVE"
          : mode === "SUPABASE_LIVE"
            ? "SUPABASE LIVE"
            : "VERIFIED SNAPSHOT (24)"}
      </span>
      <span className="sync-label-text" style={{ fontSize: "11px" }}>· Synced</span>
    </span>
    <button
      type="button"
      className="btn-primary"
      onClick={onSyncNow}
      disabled={isSyncing}
      aria-label="Refresh the configured opportunity data source"
      style={{
        padding: "5px 12px",
        fontSize: "12px",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px"
      }}
    >
      <span
        style={{
          display: "inline-block",
          animation: isSyncing ? "spin 1s linear infinite" : "none"
        }}
        aria-hidden="true"
      >
        🔄
      </span>
      <span>{isSyncing ? "Syncing..." : "Sync Data"}</span>
    </button>
  </div>
);
