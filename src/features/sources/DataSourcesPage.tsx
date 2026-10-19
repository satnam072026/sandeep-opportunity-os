import React, { useState } from "react";
import { DATA_SOURCE_REGISTRY, type DataSourceResource } from "../../config/dataSources";
import { getAgentById } from "../../config/agentRegistry";
import { Icon } from "../../components/ui/Icon";
import type { DataSourceMode } from "../opportunities/api/opportunityRepository";
import type { SourceSyncDiagnostic } from "../../pipeline/syncService";

interface DataSourcesPageProps {
  onSyncNow: () => void;
  isSyncing?: boolean;
  lastSyncedAt?: string;
  recordCount: number;
  mode?: DataSourceMode;
  sourceHealth?: SourceSyncDiagnostic[] | null;
}

export const DataSourcesPage: React.FC<DataSourcesPageProps> = ({
  onSyncNow,
  isSyncing = false,
  lastSyncedAt,
  recordCount,
  mode = "CLOUDFLARE_D1_LIVE",
  sourceHealth
}) => {
  const [filterType, setFilterType] = useState<string>("ALL");

  const autoIngestCount = DATA_SOURCE_REGISTRY.filter((s) => s.syncEnabled && s.type !== "Database").length;
  const driveFoldersCount = DATA_SOURCE_REGISTRY.filter((s) => s.type === "Drive Folder").length;

  const connectedCount = DATA_SOURCE_REGISTRY.filter((src) => {
    const diag = sourceHealth?.find((s) => s.id === src.id);
    const st = diag?.status || src.status;
    return st === "Connected" || st === "Connected (DB)";
  }).length;

  const blockedCount = DATA_SOURCE_REGISTRY.filter((src) => {
    const diag = sourceHealth?.find((s) => s.id === src.id);
    const st = diag?.status || src.status;
    return st === "Permission required";
  }).length;

  const filteredSources = DATA_SOURCE_REGISTRY.filter((s) => {
    if (filterType === "ALL") return true;
    if (filterType === "CONNECTED") {
      const diag = sourceHealth?.find((diag) => diag.id === s.id);
      const st = diag?.status || s.status;
      return st === "Connected" || st === "Connected (DB)";
    }
    if (filterType === "BLOCKED") {
      const diag = sourceHealth?.find((diag) => diag.id === s.id);
      const st = diag?.status || s.status;
      return st === "Permission required";
    }
    if (filterType === "AUTO") return s.syncEnabled && s.type !== "Database";
    if (filterType === "FOLDERS") return s.type === "Drive Folder";
    if (filterType === "GOOGLE") return s.type === "Native Google Sheet" || s.type === "Drive XLSX" || s.type === "Drive Folder";
    if (filterType === "LOCAL") return s.type === "Local File" || s.type === "Database";
    return true;
  });

  return (
    <div className="os-workspace-body">
      {/* Header */}
      <div className="os-page-header">
        <div>
          <div className="os-page-tagline">INGESTION & SOURCE ARCHITECTURE</div>
          <h1 className="os-page-title">Data Sources & Ingestion Hub</h1>
          <p className="os-page-subtitle">
            Autonomous multi-source ingestion layer. Google Sheets and Google Drive workbooks updated by Sandeep&apos;s 3 AI
            agents across 10 registered Drive folders are fetched server-side, deduplicated, and unified into the Cloudflare D1
            canonical database.
          </p>
        </div>
        <div className="os-page-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={onSyncNow}
            disabled={isSyncing}
          >
            <Icon name="sync" size={14} />
            <span>{isSyncing ? "Syncing All Sources..." : "Run Unified Ingestion"}</span>
          </button>
        </div>
      </div>

      {/* 5 Distinct Metrics Cards: 3 Agents, Drive Folders, Auto Ingestion, Connected, Permission Blocked */}
      <div className="os-metric-strip" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="os-metric-card">
          <div className="os-metric-label">CONFIGURED AGENTS</div>
          <div className="os-metric-val mono">3 Agents</div>
          <div className="os-metric-delta good">Bago Muse · Haya Satnam · Kattu AI</div>
        </div>
        <div className="os-metric-card">
          <div className="os-metric-label">REGISTERED DRIVE FOLDERS</div>
          <div className="os-metric-val mono">{driveFoldersCount} Folders</div>
          <div className="os-metric-delta info">Structured Workspaces & Trackers</div>
        </div>
        <div className="os-metric-card">
          <div className="os-metric-label">AUTOMATIC INGESTION</div>
          <div className="os-metric-val mono">{autoIngestCount} Sources</div>
          <div className="os-metric-delta info">Scheduled 5-Hour Pipeline</div>
        </div>
        <div className="os-metric-card">
          <div className="os-metric-label">CONNECTED SOURCES</div>
          <div className="os-metric-val mono">{connectedCount} Active</div>
          <div className="os-metric-delta good">
            {recordCount > 0 ? `${recordCount.toLocaleString()} records · ${mode}` : `Live Sync · ${mode}`}
            {lastSyncedAt ? ` · Last synced: ${lastSyncedAt}` : ""}
          </div>
        </div>
        <div className="os-metric-card">
          <div className="os-metric-label">PERMISSION-BLOCKED</div>
          <div className="os-metric-val mono">{blockedCount} Pending</div>
          <div className="os-metric-delta warning">Awaiting Service Account Reader</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="os-filter-bar" style={{ marginTop: 24, marginBottom: 16 }}>
        <div className="os-filter-group">
          <span className="os-filter-label">Filter Sources:</span>
          {[
            { id: "ALL", label: "All Sources" },
            { id: "CONNECTED", label: `Connected (${connectedCount})` },
            { id: "BLOCKED", label: `Permission Blocked (${blockedCount})` },
            { id: "AUTO", label: `Auto Ingestion (${autoIngestCount})` },
            { id: "FOLDERS", label: `Drive Folders (${driveFoldersCount})` }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`btn-ghost ${filterType === t.id ? "active" : ""}`}
              style={{
                padding: "4px 10px",
                borderRadius: 4,
                backgroundColor: filterType === t.id ? "var(--bg-elevated)" : "transparent",
                color: filterType === t.id ? "var(--accent-primary)" : "var(--text-secondary)"
              }}
              onClick={() => setFilterType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sources Table */}
      <div className="os-card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="os-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Source Name & Resource</th>
              <th>Owning Agent</th>
              <th>Live Status</th>
              <th>Type & Format</th>
              <th>Target Tabs / Scope</th>
              <th>Cadence</th>
              <th>Metrics (Fetched / Accepted)</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSources.map((src: DataSourceResource, idx: number) => {
              const agent = src.owningAgentId ? getAgentById(src.owningAgentId) : undefined;
              const gId = src.driveId || src.spreadsheetId || src.folderId;

              return (
                <tr key={src.id}>
                  <td className="mono" style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    {idx + 1}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {src.name}
                    </div>
                    {gId && (
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        ID: {gId.slice(0, 18)}...
                      </div>
                    )}
                  </td>
                  <td>
                    {agent ? (
                      <span
                        className="os-badge mono"
                        style={{
                          backgroundColor: agent.accentBg,
                          color: agent.themeColor,
                          border: `1px solid ${agent.themeColor}33`,
                          fontSize: 11
                        }}
                      >
                        {agent.name}
                      </span>
                    ) : (
                      <span className="os-badge neutral mono" style={{ fontSize: 11 }}>
                        System
                      </span>
                    )}
                  </td>
                  <td>
                    {(() => {
                      const diag = sourceHealth?.find((s) => s.id === src.id);
                      const status = diag?.status || src.status;
                      const isGood = status === "Connected" || status === "Connected (DB)";
                      const isWarning = status === "Permission required" || status === "Stale";
                      const tone = isGood ? "good" : isWarning ? "warning" : "danger";
                      return (
                        <span className={`os-badge ${tone} mono`} style={{ fontSize: 10.5 }} title={diag?.message || src.notes}>
                          {status}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <span className="os-badge neutral mono" style={{ fontSize: 11 }}>
                      {src.type}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {src.verifiedTabs?.join(", ") || src.purpose || "Full file"}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {src.syncMode === "AUTOMATIC_6H" ? "Every 5h (00, 05, 10, 15, 20 UTC)" : src.syncMode}
                    </div>
                  </td>
                  <td>
                    <div className="mono" style={{ fontSize: 12, color: "var(--text-primary)" }}>
                      {src.recordsFetched ?? 0} fetched · {src.recordsAccepted ?? 0} accepted
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                      {src.canonicalRecords ?? 0} active in DB
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {src.url ? (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost"
                        style={{ fontSize: 12, padding: "3px 8px", textDecoration: "none" }}
                      >
                        <span>Open Resource</span>
                        <Icon name="external" size={11} />
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Local File</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Ingestion Architecture Card */}
      <div
        className="os-card"
        style={{
          marginTop: 24,
          backgroundColor: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          padding: 20
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Icon name="sparkles" size={18} className="text-accent" />
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)" }}>
            Canonical Ingestion & Strict CRM Preservation Architecture
          </h3>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Opportunity OS features a single unified sync engine shared identically between the 5-hour scheduled GitHub Actions
          cron and the Supabase Edge Function manual sync trigger. When incoming sheets or XLSX files are fetched,
          all records are normalized, deduplicated by URL and fingerprint, and merged against existing database records.
          Sandeep's 7 user-owned CRM fields (<code>user_status</code>, <code>priority</code>, <code>favorite</code>,{" "}
          <code>follow_up_date</code>, <code>personal_notes</code>, <code>contacted_date</code>, and <code>applied_date</code>)
          are strictly preserved and can never be overwritten by automated agent updates.
        </p>
      </div>
    </div>
  );
};
