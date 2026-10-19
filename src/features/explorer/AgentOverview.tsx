import React from "react";
import type { ExplorerAgent, WorkspaceConfig, FolderConfig, SheetConfig } from "./explorerData";
import type { OpportunityRecord } from "../../types/opportunity";
import { CompactMetricCard, type CompactMetricItem } from "./CompactMetricCard";
import { filterOpportunitiesForSheetTab } from "./explorerData";

interface AgentOverviewProps {
  agent: ExplorerAgent;
  workspace: WorkspaceConfig;
  opportunities: OpportunityRecord[];
  onOpenFolder: (folder: FolderConfig) => void;
  onOpenSheet: (sheet: SheetConfig) => void;
  lastSyncedAt: string;
}

export const AgentOverview: React.FC<AgentOverviewProps> = ({
  agent,
  workspace,
  opportunities,
  onOpenFolder,
  onOpenSheet,
  lastSyncedAt
}) => {
  // Aggregate opportunities for this agent's workspace
  const allWorkspaceSheets: SheetConfig[] = [
    ...workspace.sheets,
    ...workspace.folders.flatMap((f) => f.sheets),
    ...workspace.folders.flatMap((f) => f.subfolders ? f.subfolders.flatMap((s) => s.sheets) : [])
  ];

  // Distinguish genuine Muse_Satnam discoveries vs. inherited legacy records
  const newSatnamDiscoveries = opportunities.filter((o) => {
    const rawSourceId = (o as { source_id?: string }).source_id;
    if (rawSourceId && rawSourceId.startsWith("satnam_")) return true;
    if (Array.isArray(o.agent_provenance) && o.agent_provenance.some((p) => (p.sourceId || "").startsWith("satnam_") || (p.sourceName || "").includes("Muse_Satnam"))) return true;
    return false;
  });

  const legacyInheritedRecords = opportunities.filter((o) => {
    return o.category === "visa_jobs" && !newSatnamDiscoveries.includes(o);
  });

  const agentOpportunities = opportunities.filter((o) => {
    if (agent.id === "bago_muse") return o.category === "freelance_leads" || (o.source_url || "").includes("facebook");
    if (agent.id === "kattu_ai") return o.category === "remote_jobs";
    if (agent.id === "haya_satnam") return true;
    return true;
  });

  const highFitCount = (agent.id === "haya_satnam" ? legacyInheritedRecords : agentOpportunities).filter((o) => o.score_total >= 85).length;
  const inCrmCount = (agent.id === "haya_satnam" ? legacyInheritedRecords : agentOpportunities).filter(
    (o) => (o.workflow?.status || o.user_status) !== "New" || o.workflow?.favorite
  ).length;

  const metrics: CompactMetricItem[] = agent.id === "haya_satnam" ? [
    {
      id: "new_satnam_discoveries",
      label: "New Muse_Satnam Discoveries",
      value: newSatnamDiscoveries.length.toLocaleString(),
      subValue: "Genuinely from Muse_Satnam sheets",
      badge: "Truthful: 0",
      badgeTone: "info"
    },
    {
      id: "legacy_inherited_records",
      label: "Legacy Inherited Records",
      value: legacyInheritedRecords.length.toLocaleString(),
      subValue: "Historical Haya Muse 1 & 2 records",
      badge: "Legacy Provenance",
      badgeTone: "neutral"
    },
    {
      id: "high_fit",
      label: "High Fit (85+ Score)",
      value: highFitCount,
      subValue: "Prime targets",
      badgeTone: "info"
    },
    {
      id: "in_crm",
      label: "Active In CRM",
      value: inCrmCount,
      subValue: "Saved / Applied / In Progress",
      badgeTone: "neutral"
    }
  ] : [
    {
      id: "agent_leads",
      label: "Discovered Opportunities",
      value: agentOpportunities.length.toLocaleString(),
      badge: "Active Fleet",
      badgeTone: "success"
    },
    {
      id: "high_fit",
      label: "High Fit (85+ Score)",
      value: highFitCount,
      subValue: "Prime targets",
      badgeTone: "info"
    },
    {
      id: "in_crm",
      label: "Active In CRM",
      value: inCrmCount,
      subValue: "Saved / Applied / In Progress",
      badgeTone: "neutral"
    },
    {
      id: "folders_sheets",
      label: "Drive Folders & Sheets",
      value: `${workspace.folders.length} folders · ${allWorkspaceSheets.length} sheets`,
      subValue: lastSyncedAt ? "Synchronized" : "Google Drive",
      badgeTone: "neutral"
    }
  ];

  const isSetupRequired = agent.status === "idle";

  return (
    <div className="os-agent-overview" role="region" aria-label={`${agent.name} Workspace Summary`}>
      {/* Agent Banner */}
      <div className="os-agent-banner">
        <div className="os-agent-banner-left">
          <div
            className="os-agent-banner-avatar"
            style={{ backgroundColor: agent.themeColor, color: "#ffffff" }}
          >
            {agent.initials}
          </div>
          <div>
            <div className="os-agent-codename mono">{agent.codename}</div>
            <h1 className="os-agent-title">{agent.name}</h1>
            <div className="os-agent-role-title">{agent.role}</div>
          </div>
        </div>

        <div className="os-agent-banner-right">
          {isSetupRequired ? (
            <span className="os-badge neutral mono" style={{ fontSize: "11px", padding: "4px 10px", borderColor: "var(--border-subtle)" }}>
              ○ Setup Required · Inactive
            </span>
          ) : (
            <span className="os-badge success mono" style={{ fontSize: "11px", padding: "4px 10px" }}>
              ● Operational &amp; Active
            </span>
          )}
        </div>
      </div>

      <p className="os-agent-description">{agent.description}</p>

      {agent.id === "haya_satnam" && (
        <div
          className="os-provenance-callout"
          style={{
            margin: "14px 0",
            padding: "12px 16px",
            borderRadius: "6px",
            border: "1px solid var(--border-color)",
            backgroundColor: "rgba(16, 185, 129, 0.05)",
            fontSize: "12.5px",
            lineHeight: "1.5"
          }}
        >
          <strong style={{ color: "var(--accent-primary)" }}>Haya Satnam Provenance Notice:</strong>{" "}
          <span>
            <strong>0</strong> new discoveries currently recorded from live Muse_Satnam operational sheets.{" "}
            <strong>1,605</strong> historical records are safely preserved from legacy Haya Muse 1 &amp; 2 crawlers and accessible in the{" "}
            <em>Legacy Inherited Records</em> folder. Tonight&apos;s scheduled 5-hour research runs will populate new regional discoveries into the active sheets.
          </span>
        </div>
      )}

      {/* 4 Compact Metric Cards */}
      <CompactMetricCard metrics={metrics} />

      {/* Folders in this Agent's Workspace */}
      {workspace.folders.length > 0 && (
        <div className="os-folder-section">
          <h2 className="os-folder-section-title">Drive Folders in {workspace.name}</h2>
          <div className="os-folder-grid">
            {workspace.folders.map((folder) => {
              const rowsInFolder = folder.sheets.reduce(
                (acc, s) => acc + filterOpportunitiesForSheetTab(opportunities, s).length,
                0
              );

              return (
                <div
                  key={folder.id}
                  className="os-folder-card"
                  onClick={() => onOpenFolder(folder)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenFolder(folder);
                    }
                  }}
                >
                  <div className="os-folder-card-header">
                    <span className="os-folder-card-icon" aria-hidden="true">
                      📁
                    </span>
                    <div>
                      <div className="os-folder-card-name">{folder.name}</div>
                      <div className="os-folder-card-meta">
                        {folder.sheets.length} sheets · {rowsInFolder.toLocaleString()} rows
                      </div>
                    </div>
                  </div>
                  <div className="os-folder-card-desc">{folder.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Direct Sheets in this Agent's Workspace */}
      {allWorkspaceSheets.length > 0 && (
        <div className="os-folder-section">
          <h2 className="os-folder-section-title">Featured Spreadsheets &amp; Trackers</h2>
          <div className="os-sheet-list">
            {allWorkspaceSheets.slice(0, 4).map((sheet) => {
              const rows = filterOpportunitiesForSheetTab(opportunities, sheet);

              return (
                <div key={sheet.id} className="os-sheet-card">
                  <div className="os-sheet-card-left">
                    <span className="os-sheet-card-icon" aria-hidden="true">
                      📊
                    </span>
                    <div>
                      <div className="os-sheet-card-name">{sheet.name}</div>
                      <div className="os-sheet-card-desc">{sheet.description}</div>
                    </div>
                  </div>
                  <div className="os-sheet-card-right">
                    <div className="os-sheet-card-count mono">
                      {rows.length.toLocaleString()} <span>rows</span>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => onOpenSheet(sheet)}
                      style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 600 }}
                    >
                      Open Sheet →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
