import React from "react";
import type { AppRoutePath } from "../../app/router/router";
import { Icon, type IconName } from "./Icon";
import { type ExplorerSelection, type ExplorerAgent, type WorkspaceConfig, type FolderConfig, type SheetConfig } from "../../features/explorer/explorerData";

interface SidebarProps {
  currentPath: AppRoutePath; onNavigate: (path: AppRoutePath) => void;
  counts: Partial<Record<AppRoutePath, number | undefined>>; theme: "dark" | "light"; onToggleTheme: () => void;
  onSyncNow?: () => void; isSyncing?: boolean; mobileOpen: boolean; onCloseMobile: () => void;
  collapsed?: boolean; onToggleCollapse?: () => void; selection: ExplorerSelection;
  onSelectAgent: (agent: ExplorerAgent) => void; onSelectWorkspace: (workspace: WorkspaceConfig) => void;
  onSelectFolder: (folder: FolderConfig, workspace: WorkspaceConfig) => void;
  onSelectSheet: (sheet: SheetConfig, folder?: FolderConfig, workspace?: WorkspaceConfig) => void;
  onSelectTab: (tabId: string, sheet: SheetConfig, folder?: FolderConfig, workspace?: WorkspaceConfig) => void;
}

type NavItem = { label: string; path: AppRoutePath; icon: IconName; activePaths?: AppRoutePath[] };
const WORKSPACE_NAV: NavItem[] = [
  { label: "Home", path: "/today", icon: "today" },
  { label: "Opportunities", path: "/opportunities", icon: "opportunities" },
  { label: "Pipeline", path: "/saved", icon: "crm", activePaths: ["/saved", "/crm"] },
  { label: "Agents", path: "/agents", icon: "agents" }
];
const SYSTEM_NAV: NavItem[] = [
  { label: "Sources", path: "/sources", icon: "sources", activePaths: ["/sources", "/explorer"] },
  { label: "Automations", path: "/operations", icon: "operations" },
  { label: "Settings", path: "/profile", icon: "profile" }
];

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate, counts, theme, onToggleTheme, mobileOpen, onCloseMobile, collapsed = false, onToggleCollapse }) => {
  const renderItem = (item: NavItem) => {
    const active = (item.activePaths || [item.path]).includes(currentPath);
    return <li key={item.label}><button type="button" className={`os-nav-btn ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => { onNavigate(item.path); onCloseMobile(); }}><span className="os-nav-btn-left"><Icon name={item.icon} size={17}/><span>{item.label}</span></span>{item.label === "Opportunities" && typeof counts[item.path] === "number" && <span className="os-nav-count">{counts[item.path]}</span>}</button></li>;
  };
  return <aside className={`os-sidebar ${mobileOpen ? "mobile-open open" : ""} ${collapsed ? "collapsed" : ""}`} aria-label="Primary navigation">
    <div className="os-sidebar-brand"><div className="os-brand-identity"><span className="os-brand-badge" aria-hidden="true">OS</span><div><div className="os-brand-title">Opportunity OS</div><div className="os-brand-sub">Private intelligence</div></div></div><button type="button" className="os-sidebar-close-btn" aria-label={mobileOpen ? "Close navigation" : "Collapse navigation"} onClick={mobileOpen ? onCloseMobile : onToggleCollapse}>{mobileOpen ? <Icon name="close" size={16}/> : <span aria-hidden="true">‹</span>}</button></div>
    <div className="os-sidebar-scroll"><nav aria-label="Workspace navigation"><div className="os-nav-group-label">Workspace</div><ul className="os-nav-list">{WORKSPACE_NAV.map(renderItem)}</ul><div className="os-nav-group-label os-nav-system-label">System</div><ul className="os-nav-list">{SYSTEM_NAV.map(renderItem)}</ul></nav></div>
    <div className="os-sidebar-footer"><button type="button" className="os-profile-mini" onClick={() => onNavigate("/profile")} aria-label="Open Sandeep Gautam profile"><span className="os-profile-avatar" aria-hidden="true">SG</span><span><span className="os-profile-mini-name">Sandeep Gautam</span><span className="os-profile-mini-meta">Owner workspace</span></span></button><button type="button" className="os-theme-quiet" onClick={onToggleTheme}><Icon name={theme === "dark" ? "sun" : "moon"} size={15}/><span>{theme === "dark" ? "Use light appearance" : "Use dark appearance"}</span></button></div>
  </aside>;
};
