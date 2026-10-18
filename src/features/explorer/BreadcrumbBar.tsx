import React, { useState, useRef, useEffect } from "react";
import type { OpportunityRecord } from "../../types/opportunity";
import { Icon } from "../../components/ui/Icon";

export interface BreadcrumbSegment {
  id: string;
  label: string;
  onClick?: () => void;
}

interface BreadcrumbBarProps {
  breadcrumbs: BreadcrumbSegment[];
  opportunities: OpportunityRecord[];
  onSelectOpportunity: (opp: OpportunityRecord) => void;
  lastSyncedAt: string;
  onSyncNow: () => void;
  isSyncing?: boolean;
  onLogout?: () => void;
  onToggleMobileMenu?: () => void;
}

export const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({
  breadcrumbs,
  opportunities,
  onSelectOpportunity,
  lastSyncedAt,
  onSyncNow,
  isSyncing = false,
  onLogout,
  onToggleMobileMenu
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
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

  const searchHits = searchQuery.trim()
    ? opportunities
        .filter((o) => {
          const q = searchQuery.toLowerCase();
          return (
            o.title.toLowerCase().includes(q) ||
            o.organization.toLowerCase().includes(q) ||
            o.id.toLowerCase().includes(q) ||
            o.location.toLowerCase().includes(q)
          );
        })
        .slice(0, 8)
    : [];

  // Format relative last synced time
  const formatLastSync = (iso: string): string => {
    if (!iso) return "Synced recently";
    const deltaMs = Date.now() - new Date(iso).getTime();
    if (isNaN(deltaMs) || deltaMs < 0) return "Just now";
    const mins = Math.floor(deltaMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  return (
    <header className="os-topbar" aria-label="Application Header & Breadcrumbs">
      <div className="os-topbar-left">
        {onToggleMobileMenu && (
          <button
            type="button"
            className="os-mobile-menu-btn"
            aria-label="Toggle navigation drawer"
            onClick={onToggleMobileMenu}
          >
            <Icon name="menu" size={16} />
          </button>
        )}

        <nav className="os-breadcrumbs" aria-label="Current Path">
          <span className="os-breadcrumb-root" title="Sandeep Opportunity OS">
            Opportunity OS
          </span>
          {breadcrumbs.map((segment, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <React.Fragment key={segment.id}>
                <span className="os-breadcrumb-sep" aria-hidden="true">
                  /
                </span>
                {segment.onClick && !isLast ? (
                  <button
                    type="button"
                    className="os-breadcrumb-btn"
                    onClick={segment.onClick}
                    title={`Navigate to ${segment.label}`}
                  >
                    {segment.label}
                  </button>
                ) : (
                  <span
                    className={`os-breadcrumb-current ${isLast ? "active" : ""}`}
                    aria-current={isLast ? "location" : undefined}
                  >
                    {segment.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      <div className="os-topbar-right">
        {/* Fast Global Search */}
        <div className="os-global-search-wrap">
          <span className="os-search-icon" aria-hidden="true">
            <Icon name="search" size={13} />
          </span>
          <input
            ref={searchInputRef}
            type="search"
            id="os-breadcrumb-search"
            name="search"
            className="os-global-search-input"
            placeholder="Search records or orgs..."
            aria-label="Global opportunity search (Press / to focus)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <kbd className="os-search-kbd">/</kbd>

          {searchHits.length > 0 && (
            <div className="os-search-dropdown" role="listbox" aria-label="Search results">
              {searchHits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className="os-search-hit"
                  onClick={() => {
                    onSelectOpportunity(hit);
                    setSearchQuery("");
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

        {/* Subtle Status Indicator */}
        <div className="os-status-indicator" title="System Status & Active Opportunities">
          <span className="os-status-pulse" aria-hidden="true" />
          <span className="os-status-text">
            Synced {formatLastSync(lastSyncedAt)} <span className="os-status-sep">|</span> 3 agents active{" "}
            <span className="os-status-sep">|</span> {opportunities.length.toLocaleString()} opps
          </span>
        </div>

        {/* The Single Primary Sync Data Action */}
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
              style={{ display: "inline-block", fontSize: "14px" }}
              aria-hidden="true"
            >
              🔄
            </span>
            <span>{isSyncing ? "Syncing..." : "Sync Data"}</span>
          </button>
        </div>


        {/* Logout (if Neon Auth session exists) */}
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
  );
};
