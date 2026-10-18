import React, { useState, useRef, useEffect } from "react";
import type { AppRoutePath } from "../../app/router/router";
import type { OpportunityRecord } from "../../types/opportunity";
import type { DataSourceMode } from "../../features/opportunities/api/opportunityRepository";
import { Sidebar } from "./Sidebar";
import { Icon } from "./Icon";
import {
  type ExplorerSelection,
  type ExplorerAgent,
  type WorkspaceConfig,
  type FolderConfig,
  type SheetConfig,
  WORKSPACE_AGENTS,
  getWorkspaceById,
  getFolderById,
  getSheetById
} from "../../features/explorer/explorerData";
import { DATA_SOURCE_REGISTRY } from "../../config/dataSources";

interface AppShellProps {
  currentPath: AppRoutePath;
  onNavigate: (path: AppRoutePath, params?: Record<string, string>) => void;
  opportunities: OpportunityRecord[];
  onSelectOpportunity: (opp: OpportunityRecord) => void;
  mode: DataSourceMode;
  lastSyncedAt: string;
  onSyncNow: () => void;
  isSyncing?: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onLogout?: () => void;
  children: React.ReactNode;
  selection: ExplorerSelection;
  onSelectAgent: (agent: ExplorerAgent) => void;
  onSelectWorkspace: (workspace: WorkspaceConfig) => void;
  onSelectFolder: (folder: FolderConfig, workspace: WorkspaceConfig) => void;
  onSelectSheet: (sheet: SheetConfig, folder?: FolderConfig, workspace?: WorkspaceConfig) => void;
  onSelectTab: (tabId: string, sheet: SheetConfig, folder?: FolderConfig, workspace?: WorkspaceConfig) => void;
}

const ROUTE_TITLES: Record<AppRoutePath, { title: string; context: string }> = {
  "/today": { title: "Today Command Center", context: "Ranked Priority Action Queue & Scheduled Follow-ups" },
  "/explorer": { title: "Drive Explorer & Spreadsheets", context: "Google Drive, Sheets, Workspaces & Agent Files" },
  "/opportunities": { title: "All Opportunities Directory", context: "Unified Multi-Agent Enterprise Research Directory" },
  "/agents": { title: "AI Research Agent Fleet", context: "5 Autonomous Intelligence Agents Operating for Sandeep" },
  "/sources": { title: "Data Sources & Ingestion Hub", context: "Google Sheets, Drive XLSX, Fallback Repositories & Ingestion Telemetry" },
  "/freelance": { title: "Freelance Client Leads", context: "Bago Muse · Cyprus & UK SME Targets with Actionable Commercial Hooks" },
  "/jobs": { title: "Visa & Cyprus Jobs", context: "Haya Satnam · Nicosia, Limassol & EU Visa-Sponsoring Strategic Roles" },
  "/masters": { title: "Master's & Scholarships", context: "Bago Muse · UCLan Cyprus 40% Alumni, MSc Computing & Erasmus Mundus" },
  "/remote": { title: "Remote & Internships", context: "Kattu AI · Distributed EU/EMEA Roles Excluding US/Africa Lockouts" },
  "/crm": { title: "Saved & CRM Follow-ups", context: "Sandeep's Protected CRM Workspace · Statuses, Notes & Follow-up Dates" },
  "/saved": { title: "Saved & CRM Follow-ups", context: "Sandeep's Protected CRM Workspace · Statuses, Notes & Follow-up Dates" },
  "/operations": { title: "System Operations & Evidence", context: "Unified 5-Hour Sync Engine, Neon PostgreSQL & Health Verification" },
  "/profile": { title: "Candidate Profile & Governance", context: "Sandeep Gautam · BSc First-Class Honors, 0–2 yr Target & Seniority Gates" }
};

export const AppShell: React.FC<AppShellProps> = ({
  currentPath,
  onNavigate,
  opportunities,
  onSelectOpportunity,
  lastSyncedAt,
  onSyncNow,
  isSyncing = false,
  theme,
  onToggleTheme,
  onLogout,
  children,
  selection,
  onSelectAgent,
  onSelectWorkspace,
  onSelectFolder,
  onSelectSheet,
  onSelectTab
}) => {
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return window.localStorage.getItem("sandeep_opp_os_sidebar_collapsed") === "true";
      } catch {
        return false;
      }
    }
    return false;
  });
  const [globalQuery, setGlobalQuery] = useState<string>("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleToggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setMobileOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          window.localStorage.setItem("sandeep_opp_os_sidebar_collapsed", String(next));
        } catch (e) {
          void e;
        }
        return next;
      });
    }
  };

  // Keyboard shortcuts: '/' to focus search, Ctrl+\ to toggle sidebar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "\\" || e.key === "b" || e.key === "B")) {
        e.preventDefault();
        handleToggleSidebar();
        return;
      }
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        document.activeElement?.tagName !== "SELECT"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const counts: Record<AppRoutePath, number | undefined> = {
    "/today": opportunities.filter((o) => o.is_active !== false).length,
    "/explorer": opportunities.length,
    "/opportunities": opportunities.length,
    "/agents": 4,
    "/sources": DATA_SOURCE_REGISTRY.length,
    "/freelance": opportunities.filter((o) => o.category === "freelance_leads" && o.is_active !== false).length,
    "/jobs": opportunities.filter((o) => o.category === "visa_jobs" && o.is_active !== false).length,
    "/masters": opportunities.filter((o) => o.category === "masters_scholarships" && o.is_active !== false).length,
    "/remote": opportunities.filter((o) => o.category === "remote_jobs" && o.is_active !== false).length,
    "/crm": opportunities.filter(
      (o) =>
        o.workflow?.favorite ||
        o.favorite ||
        ["Saved", "Preparing", "Contacted", "Applied", "Interviewing", "Follow-Up"].includes(
          o.workflow?.status || o.user_status
        ) ||
        Boolean(o.workflow?.follow_up_date || o.follow_up_date)
    ).length,
    "/saved": opportunities.filter(
      (o) =>
        o.workflow?.favorite ||
        o.favorite ||
        ["Saved", "Preparing", "Contacted", "Applied", "Interviewing", "Follow-Up"].includes(
          o.workflow?.status || o.user_status
        ) ||
        Boolean(o.workflow?.follow_up_date || o.follow_up_date)
    ).length,
    "/operations": 8,
    "/profile": undefined
  };

  const quickHits = globalQuery.trim()
    ? opportunities
        .filter((o) => {
          const q = globalQuery.toLowerCase();
          return (
            o.title.toLowerCase().includes(q) ||
            o.organization.toLowerCase().includes(q) ||
            o.id.toLowerCase().includes(q) ||
            o.location.toLowerCase().includes(q)
          );
        })
        .slice(0, 8)
    : [];

  const meta = ROUTE_TITLES[currentPath] || ROUTE_TITLES["/today"];

  // Format relative last synced time
  const formatLastSync = (iso: string): string => {
    if (!iso) return "recently";
    const deltaMs = Date.now() - new Date(iso).getTime();
    if (isNaN(deltaMs) || deltaMs < 0) return "just now";
    const mins = Math.floor(deltaMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  // Derive breadcrumbs for Explorer view or Standard Route views
  const isExplorer = currentPath === "/explorer";
  const ws = isExplorer ? getWorkspaceById(selection.workspaceId) : undefined;
  const activeAgent = isExplorer && selection.agentId ? WORKSPACE_AGENTS.find((a) => a.id === selection.agentId) : undefined;
  const f = isExplorer && selection.folderId ? getFolderById(selection.folderId)?.folder : undefined;
  const s = isExplorer && selection.sheetId ? getSheetById(selection.sheetId)?.sheet : undefined;
  const activeTab = s?.tabs.find((t) => t.id === selection.tabId)?.label || selection.tabId;

  return (
    <div className={`os-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} data-theme={theme}>
      {/* Mobile Drawer Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="os-sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        counts={counts}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onSyncNow={onSyncNow}
        isSyncing={isSyncing}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        selection={selection}
        onSelectAgent={onSelectAgent}
        onSelectWorkspace={onSelectWorkspace}
        onSelectFolder={onSelectFolder}
        onSelectSheet={onSelectSheet}
        onSelectTab={onSelectTab}
      />

      <div className="os-main-column">
        {/* Global Top Bar */}
        <header className="os-topbar" aria-label="Global Application Header">
          <div className="os-topbar-left">
            <button
              type="button"
              className={`os-sidebar-toggle-btn os-mobile-menu-btn ${sidebarCollapsed ? "is-collapsed" : ""}`}
              aria-label="Toggle navigation drawer"
              title={sidebarCollapsed ? "Expand sidebar navigation (Ctrl+\\)" : "Collapse sidebar navigation (Ctrl+\\)"}
              onClick={handleToggleSidebar}
            >
              <Icon name="menu" size={16} />
            </button>

            <nav className="os-breadcrumbs" aria-label="Current Path Breadcrumbs">
              <span className="os-breadcrumb-root">Opportunity OS</span>
              <span className="os-breadcrumb-sep">/</span>

              {isExplorer ? (
                <>
                  {activeAgent && (
                    <>
                      <button
                        type="button"
                        className="os-breadcrumb-btn"
                        onClick={() =>
                          onNavigate("/explorer", {
                            agent: activeAgent.id,
                            ws: activeAgent.defaultWorkspaceId
                          })
                        }
                      >
                        {activeAgent.name}
                      </button>
                      <span className="os-breadcrumb-sep">/</span>
                    </>
                  )}

                  {f && (
                    <>
                      <button
                        type="button"
                        className="os-breadcrumb-btn"
                        onClick={() =>
                          onNavigate("/explorer", {
                            ...(activeAgent ? { agent: activeAgent.id } : {}),
                            ws: ws?.id || "ws_bagomuse",
                            folder: f.id
                          })
                        }
                      >
                        {f.name}
                      </button>
                      <span className="os-breadcrumb-sep">/</span>
                    </>
                  )}

                  {s && (
                    <>
                      <button
                        type="button"
                        className="os-breadcrumb-btn"
                        onClick={() =>
                          onNavigate("/explorer", {
                            ...(activeAgent ? { agent: activeAgent.id } : {}),
                            ws: ws?.id || "ws_bagomuse",
                            ...(f ? { folder: f.id } : {}),
                            sheet: s.id
                          })
                        }
                      >
                        {s.name}
                      </button>
                      {activeTab && (
                        <>
                          <span className="os-breadcrumb-sep">/</span>
                          <span className="os-breadcrumb-current" aria-current="page">
                            {activeTab}
                          </span>
                        </>
                      )}
                    </>
                  )}

                  {!s && !f && activeAgent && (
                    <span className="os-breadcrumb-current" aria-current="page">
                      Workspace
                    </span>
                  )}

                  {!s && f && (
                    <span className="os-breadcrumb-current" aria-current="page">
                      {f.name}
                    </span>
                  )}
                </>
              ) : (
                <span className="os-breadcrumb-current" aria-current="page">
                  {meta.title}
                </span>
              )}
            </nav>
          </div>

          <div className="os-topbar-right">
            {/* Global Search Input */}
            <div className="os-global-search-wrap">
              <span className="os-search-icon" aria-hidden="true">
                <Icon name="search" size={13} />
              </span>
              <input
                ref={searchInputRef}
                type="search"
                id="os-appshell-search"
                name="search"
                className="os-global-search-input"
                placeholder="Jump to record or org..."
                aria-label="Global opportunity search (Press / to focus)"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
              />
              <kbd className="os-search-kbd">/</kbd>

              {quickHits.length > 0 && (
                <div className="os-search-dropdown" role="listbox" aria-label="Search results">
                  {quickHits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      className="os-search-hit"
                      onClick={() => {
                        onSelectOpportunity(hit);
                        setGlobalQuery("");
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "12.5px" }}>{hit.title}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                          {hit.id} · {hit.organization} · {hit.location}
                        </div>
                      </div>
                      <span className="mono" style={{ fontWeight: 700 }}>
                        {hit.score_total}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status indicator: last sync, configured agents, and opportunity count */}
            <div className="os-status-indicator" title="System Status & Ingestion Health">
              <span className="os-status-pulse" aria-hidden="true" />
              <span className="os-status-text">
                Synced {formatLastSync(lastSyncedAt)} <span className="os-status-sep">|</span> 3 agents active{" "}
                <span className="os-status-sep">|</span> {opportunities.length.toLocaleString()} opps
              </span>
            </div>

            {/* The Single Primary Sync Data Action (no duplicate sync buttons elsewhere) */}
            <div className="os-sync-control">
              <button
                type="button"
                className="btn-primary"
                onClick={onSyncNow}
                disabled={isSyncing}
                aria-label={isSyncing ? "Syncing Drive and Sheets data..." : "Sync Data from Google Sheets and Drive"}
                title="Execute canonical sync from Google Sheets, Drive XLSX, and update Neon PostgreSQL"
                style={{
                  padding: "6px 14px",
                  fontSize: "12.5px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  fontWeight: 600
                }}
              >
                <span
                  className={isSyncing ? "os-sync-spin" : ""}
                  style={{ display: "inline-block", fontSize: "13px" }}
                  aria-hidden="true"
                >
                  🔄
                </span>
                <span>{isSyncing ? "Syncing..." : "Sync Data"}</span>
              </button>
            </div>


            {/* Sign Out Button (Neon Auth) */}
            {onLogout && (
              <button
                type="button"
                className="btn-secondary"
                onClick={onLogout}
                aria-label="Sign out of Opportunity OS"
                title="Sign out of Opportunity OS (Neon Auth)"
                style={{
                  padding: "6px 10px",
                  fontSize: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px"
                }}
              >
                <span aria-hidden="true">🔒</span>
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Content Body */}
        <main className="os-workspace-body">{children}</main>
      </div>
    </div>
  );
};
