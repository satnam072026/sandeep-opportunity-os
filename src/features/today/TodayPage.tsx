import React, { useMemo } from "react";
import { buildTodayPriorityQueue, bucketFollowUps } from "../../engine/core";
import type { OpportunityRecord } from "../../types/opportunity";
import type { AppRoutePath } from "../../app/router/router";
import { getGreeting, getLocalIsoDate } from "../../lib/date";
import { formatRelativeTime } from "../../pipeline/syncService";
import { formatCategoryName, decodeHtmlEntities } from "../../lib/formatters";
import { AGENT_REGISTRY } from "../../config/agentRegistry";

interface TodayPageProps {
  opportunities: OpportunityRecord[];
  onSelectOpportunity: (opp: OpportunityRecord) => void;
  onNavigate?: (path: AppRoutePath) => void;
  lastSyncedAt?: string;
  onSyncNow?: () => void;
  isSyncing?: boolean;
  agentHealth?: Record<string, { health: string; lastSync: string; message: string }> | null;
}

function dueLabel(record: OpportunityRecord): string {
  const value = record.workflow?.follow_up_date || record.follow_up_date || record.deadline;
  if (!value) return "No date";
  const today = getLocalIsoDate();
  if (value === today) return "Due today";
  if (value < today) return "Overdue";
  const tomorrow = new Date(`${today}T12:00:00`); tomorrow.setDate(tomorrow.getDate() + 1);
  if (value === tomorrow.toISOString().slice(0, 10)) return "Tomorrow";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

export const TodayPage: React.FC<TodayPageProps> = ({ opportunities, onSelectOpportunity, onNavigate, lastSyncedAt, onSyncNow, isSyncing = false, agentHealth }) => {
  const todayIso = getLocalIsoDate();
  const queue = useMemo(() => buildTodayPriorityQueue(opportunities, todayIso), [opportunities, todayIso]);
  const buckets = useMemo(() => bucketFollowUps(opportunities, todayIso), [opportunities, todayIso]);
  const active = useMemo(() => opportunities.filter((item) => item.is_active !== false), [opportunities]);
  const highFit = useMemo(() => active.filter((item) => item.score_total >= 85).length, [active]);
  const dueSoon = buckets["Overdue"].length + buckets["Due today"].length + buckets["Tomorrow"].length;
  const actions = queue.slice(0, 5);
  const newCount = active.filter((item) => (item.workflow?.status || item.user_status) === "New").length;
  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${todayIso}T12:00:00`));

  return <div className="command-home">
    <header className="command-hero os-page-header"><div><p className="command-date">{dateLabel}</p><h1 className="os-page-title">{getGreeting()}, Sandeep</h1><p>Your agents found {newCount} active leads. {Math.min(dueSoon, actions.length)} opportunities need attention now.</p></div><button type="button" className="btn-secondary command-review" onClick={() => onNavigate?.("/opportunities")}>Review changes</button></header>
    <section className="command-metrics" aria-label="Opportunity summary">
      <button type="button" onClick={() => onNavigate?.("/saved")}><span>Needs action</span><strong className="mono">{Math.min(queue.length, 5)}</strong><small>{dueSoon} due within 48 hours</small></button>
      <button type="button" onClick={() => onNavigate?.("/opportunities")}><span>High-fit opportunities</span><strong className="mono">{highFit}</strong><small>Fit score 85 or higher</small></button>
      <button type="button" onClick={() => onNavigate?.("/saved")}><span>Due this week</span><strong className="mono">{dueSoon}</strong><small>Applications and follow-ups</small></button>
    </section>
    <div className="command-grid">
      <section className="command-panel command-queue"><header className="command-panel-head"><div><h2>Next best actions</h2><p>Ranked by fit, urgency, and evidence confidence.</p></div><button type="button" className="command-link" onClick={() => onNavigate?.("/opportunities")}>Open all opportunities →</button></header><ol>
        {actions.map((item, index) => <li key={item.id}><button type="button" className="command-action-row" onClick={() => onSelectOpportunity(item)}><span className="command-rank mono">{String(index + 1).padStart(2, "0")}</span><span className="command-opportunity"><span className="command-action-label">{item.action_badge || "Review opportunity"}</span><strong>{decodeHtmlEntities(item.title)}</strong><small>{formatCategoryName(item.category)} · {decodeHtmlEntities(item.organization)}</small></span><span className="command-score mono">{item.score_total}</span><span className="command-due">{dueLabel(item)}</span><span className={`command-status ${(item.workflow?.status || item.user_status) === "Preparing" ? "warning" : ""}`}>{item.workflow?.status || item.user_status || "New"}</span></button></li>)}
      </ol></section>
      <aside className="command-side">
        <section className="command-panel"><header className="command-panel-head"><div><h2>Agent health</h2><p>Last successful research runs</p></div><button className="command-link" type="button" onClick={() => onNavigate?.("/agents")}>Manage</button></header><div className="command-agents">{AGENT_REGISTRY.map((agent) => {
          const liveHealth = agentHealth?.[agent.id]?.health || agent.health;
          const isGood = liveHealth === "Healthy" || liveHealth === "Active" || liveHealth === "online";
          const isWarning = liveHealth === "Permission required" || liveHealth === "Degraded";
          return <div className="command-agent" key={agent.id}>
            <span className="command-agent-avatar" aria-hidden="true">{agent.name.split(" ").map((part) => part[0]).join("")}</span>
            <span>
              <strong>{agent.name}</strong>
              <small>{agentHealth?.[agent.id]?.message || `${agent.recordsAccepted.toLocaleString()} accepted records`}</small>
            </span>
            <span className={`command-health ${isGood ? "good" : isWarning ? "warning" : "danger"}`}>{liveHealth}</span>
          </div>;
        })}</div></section>
        <button type="button" className="command-sync-card" onClick={onSyncNow} disabled={isSyncing}><span><strong>{isSyncing ? "Syncing sources…" : "Refresh intelligence"}</strong><small>Last synced {formatRelativeTime(lastSyncedAt)}</small></span><span aria-hidden="true">↻</span></button>
      </aside>
    </div>
  </div>;
};
