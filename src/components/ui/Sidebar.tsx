import React, { useState } from "react";
import type { AppRoutePath } from "../../app/router/router";
import { Icon } from "./Icon";
import { AgentSwitcher } from "../../features/explorer/AgentSwitcher";
import { DriveExplorer } from "../../features/explorer/DriveExplorer";
import {
  type ExplorerSelection,
  type ExplorerAgent,
  type WorkspaceConfig,
  type FolderConfig,
  type SheetConfig
} from "../../features/explorer/explorerData";

interface SidebarProps {
  currentPath: AppRoutePath;
  onNavigate: (path: AppRoutePath) => void;
  counts: Partial<Record<AppRoutePath, number | undefined>>;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onSyncNow?: () => void;
  isSyncing?: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  selection: ExplorerSelection;
  onSelectAgent: (agent: ExplorerAgent) => void;
  onSelectWorkspace: (workspace: WorkspaceConfig) => void;
  onSelectFolder: (folder: FolderConfig, workspace: WorkspaceConfig) => void;
  onSelectSheet: (sheet: SheetConfig, folder?: FolderConfig, workspace?: WorkspaceConfig) => void;
  onSelectTab: (tabId: string, sheet: SheetConfig, folder?: FolderConfig, workspace?: WorkspaceConfig) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  counts,
  theme,
  onToggleTheme,
  mobileOpen,
  onCloseMobile,
  collapsed = false,
  onToggleCollapse,
  selection,
  onSelectAgent,
  onSelectWorkspace,
  onSelectFolder,
  onSelectSheet,
  onSelectTab
}) => {
  const [showCoreViews, setShowCoreViews] = useState<boolean>(true);

  return (
    <aside
      className={`os-sidebar ${mobileOpen ? "mobile-open open" : ""} ${collapsed ? "collapsed" : ""}`}
      aria-label="Opportunity OS Drive Explorer & Command Center"
    >
      {/* 1. Header Branding */}
      <div className="os-sidebar-brand">
        <div className="os-brand-identity">
          <span className="os-brand-badge" aria-hidden="true">
            OS
          </span>
          <div>
            <div className="os-brand-title">Opportunity OS</div>
            <div className="os-brand-sub">Drive-based CRM &amp; Command Center</div>
          </div>
        </div>
        <button
          type="button"
          className="os-sidebar-close-btn"
          aria-label={mobileOpen ? "Close navigation drawer" : "Collapse sidebar navigation (Ctrl+\\)"}
          title={mobileOpen ? "Close navigation drawer" : "Collapse sidebar to the left (Ctrl+\\)"}
          onClick={() => {
            if (mobileOpen) {
              onCloseMobile();
            } else if (onToggleCollapse) {
              onToggleCollapse();
            } else {
              onCloseMobile();
            }
          }}
        >
          {mobileOpen ? (
            <Icon name="close" size={14} />
          ) : (
            <span style={{ fontSize: "16px", fontWeight: "bold", lineHeight: 1 }} aria-hidden="true">‹</span>
          )}
        </button>
      </div>

      <div className="os-sidebar-scroll">
        {/* 2. WORKSPACE AGENTS: Bago Muse, Kattu AI, Haya Satnam */}
        <AgentSwitcher
          selectedAgentId={selection.agentId}
          onSelectAgent={(agent) => {
            onSelectAgent(agent);
            onCloseMobile();
          }}
        />

        {/* 3. DRIVE EXPLORER: VS Code style hierarchical file tree */}
        <DriveExplorer
          selection={selection}
          onSelectWorkspace={(ws) => {
            onSelectWorkspace(ws);
            onCloseMobile();
          }}
          onSelectFolder={(folder, ws) => {
            onSelectFolder(folder, ws);
            onCloseMobile();
          }}
          onSelectSheet={(sheet, folder, ws) => {
            onSelectSheet(sheet, folder, ws);
            onCloseMobile();
          }}
          onSelectTab={(tabId, sheet, folder, ws) => {
            onSelectTab(tabId, sheet, folder, ws);
            onCloseMobile();
          }}
        />

        {/* 4. Core System Views & Quick Links */}
        <div className="os-nav-group" style={{ marginTop: "12px", borderTop: "1px solid var(--border-subtle)", paddingTop: "8px" }}>
          <div
            className="os-nav-group-label"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              padding: "6px 12px",
              userSelect: "none"
            }}
            onClick={() => setShowCoreViews((prev) => !prev)}
          >
            <span>COMMAND &amp; CRM VIEWS</span>
            <span style={{ fontSize: "10px", opacity: 0.6 }}>{showCoreViews ? "▾" : "▸"}</span>
          </div>

          {showCoreViews && (
            <ul className="os-nav-list">
              <li>
                <button
                  type="button"
                  className={`os-nav-btn ${currentPath === "/today" ? "active" : ""}`}
                  onClick={() => {
                    onNavigate("/today");
                    onCloseMobile();
                  }}
                >
                  <span className="os-nav-btn-left">
                    <Icon name="today" size={14} />
                    <span>Today Command</span>
                  </span>
                  {counts["/today"] !== undefined && (
                    <span className="os-nav-count">{counts["/today"]}</span>
                  )}
                </button>
              </li>

              <li>
                <button
                  type="button"
                  className={`os-nav-btn ${currentPath === "/opportunities" ? "active" : ""}`}
                  onClick={() => {
                    onNavigate("/opportunities");
                    onCloseMobile();
                  }}
                >
                  <span className="os-nav-btn-left">
                    <Icon name="opportunities" size={14} />
                    <span>All Opportunities</span>
                  </span>
                  {counts["/opportunities"] !== undefined && (
                    <span className="os-nav-count">{counts["/opportunities"]}</span>
                  )}
                </button>
              </li>

              <li>
                <button
                  type="button"
                  className={`os-nav-btn ${currentPath === "/saved" || currentPath === "/crm" ? "active" : ""}`}
                  onClick={() => {
                    onNavigate("/saved");
                    onCloseMobile();
                  }}
                >
                  <span className="os-nav-btn-left">
                    <Icon name="saved" size={14} />
                    <span>Saved &amp; CRM</span>
                  </span>
                  {counts["/saved"] !== undefined && (
                    <span className="os-nav-count">{counts["/saved"]}</span>
                  )}
                </button>
              </li>

              <li>
                <button
                  type="button"
                  className={`os-nav-btn ${currentPath === "/sources" ? "active" : ""}`}
                  onClick={() => {
                    onNavigate("/sources");
                    onCloseMobile();
                  }}
                >
                  <span className="os-nav-btn-left">
                    <Icon name="sources" size={14} />
                    <span>Data Sources</span>
                  </span>
                  {counts["/sources"] !== undefined && (
                    <span className="os-nav-count">{counts["/sources"]}</span>
                  )}
                </button>
              </li>

              <li>
                <button
                  type="button"
                  className={`os-nav-btn ${currentPath === "/operations" ? "active" : ""}`}
                  onClick={() => {
                    onNavigate("/operations");
                    onCloseMobile();
                  }}
                >
                  <span className="os-nav-btn-left">
                    <Icon name="operations" size={14} />
                    <span>Operations &amp; Health</span>
                  </span>
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>

      {/* 5. Footer: Profile & Theme Switcher (NO DUPLICATE SYNC BUTTON) */}
      <div className="os-sidebar-footer">
        <div
          className="os-profile-mini"
          tabIndex={0}
          role="button"
          aria-label="Open Candidate Profile & Governance"
          onClick={() => {
            onNavigate("/profile");
            onCloseMobile();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onNavigate("/profile");
              onCloseMobile();
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <div>
            <div className="os-profile-mini-name">Sandeep Gautam</div>
            <div className="os-profile-mini-meta">BSc First-Class · 0–2 yr Target</div>
          </div>
          <span
            className="os-badge neutral mono"
            style={{ fontSize: "10px", padding: "2px 6px", opacity: 0.85 }}
            title="Candidate profile active in Neon PostgreSQL"
          >
            Verified Profile
          </span>
        </div>

        <div className="os-sidebar-controls">
          <button
            type="button"
            className="btn-secondary"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            style={{ width: "100%", justifyContent: "center" }}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
