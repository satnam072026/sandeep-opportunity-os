import React, { useState, useMemo } from "react";
import type { OpportunityRecord } from "../../types/opportunity";
import type { AgentId } from "../../types/agent";
import type { AppRoutePath } from "../../app/router/router";
import { AGENT_REGISTRY } from "../../config/agentRegistry";
import { DATA_SOURCE_REGISTRY } from "../../config/dataSources";
import { resolveOpportunityProvenance } from "../../engine/provenance";
import { Icon } from "../../components/ui/Icon";

interface AiAgentsPageProps {
  opportunities: OpportunityRecord[];
  onSelectOpportunity: (opp: OpportunityRecord) => void;
  onNavigate: (path: AppRoutePath, params?: Record<string, string>) => void;
  onSyncNow: () => void;
  isSyncing?: boolean;
}

export const AiAgentsPage: React.FC<AiAgentsPageProps> = ({
  opportunities,
  onSelectOpportunity,
  onNavigate,
  onSyncNow,
  isSyncing = false
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId | "ALL">("ALL");

  // Calculate live stats for each agent from the opportunities pool
  const agentStats = useMemo(() => {
    const map = new Map<AgentId, { total: number; highMatch: number; leads: OpportunityRecord[] }>();
    for (const agent of AGENT_REGISTRY) {
      map.set(agent.id, { total: 0, highMatch: 0, leads: [] });
    }

    for (const opp of opportunities) {
      const prov = resolveOpportunityProvenance(opp);
      for (const p of prov) {
        const stat = map.get(p.agentId);
        if (stat) {
          stat.total++;
          if (opp.score_total >= 80) stat.highMatch++;
          if (stat.leads.length < 5) stat.leads.push(opp);
        }
      }
    }
    return map;
  }, [opportunities]);

  const displayedAgents = useMemo(() => {
    if (selectedAgentId === "ALL") return AGENT_REGISTRY;
    return AGENT_REGISTRY.filter((a) => a.id === selectedAgentId);
  }, [selectedAgentId]);

  return (
    <div className="os-workspace-body">
      {/* Fleet Header */}
      <div className="os-page-header">
        <div>
          <div className="os-page-tagline">AUTONOMOUS MULTI-AGENT INTELLIGENCE</div>
          <h1 className="os-page-title">AI Research Agent Fleet</h1>
          <p className="os-page-subtitle">
            Three configured agents independently scout employment, contracts, and scholarship targets on 6–8 hour
            schedules. Opportunity OS acts as the central control room—ingesting, scoring, and deduplicating their findings.
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
            <span>{isSyncing ? "Ingesting Fleet Feeds..." : "Sync Fleet Feeds"}</span>
          </button>
        </div>
      </div>

      {/* Fleet Telemetry Strip */}
      <div className="os-metric-strip">
        <div className="os-metric-card">
          <div className="os-metric-label">ACTIVE AGENT FLEET</div>
          <div className="os-metric-val mono">5 / 5</div>
          <div className="os-metric-delta good">● All Autonomous Agents Online</div>
        </div>
        <div className="os-metric-card">
          <div className="os-metric-label">TOTAL DISCOVERIES</div>
          <div className="os-metric-val mono">{opportunities.length}</div>
          <div className="os-metric-delta info">Deduplicated in Canonical DB</div>
        </div>
        <div className="os-metric-card">
          <div className="os-metric-label">HIGH-SIGNAL TARGETS</div>
          <div className="os-metric-val mono">
            {opportunities.filter((o) => o.score_total >= 80 && o.is_active !== false).length}
          </div>
          <div className="os-metric-delta good">Score ≥ 80 · Ready for Outreach</div>
        </div>
        <div className="os-metric-card">
          <div className="os-metric-label">SYNC INTERVAL</div>
          <div className="os-metric-val mono">5h 00m</div>
          <div className="os-metric-delta info">00, 05, 10, 15, 20 UTC Cycle</div>
        </div>
      </div>

      {/* Agent Filter Tabs */}
      <div className="os-filter-bar" style={{ marginTop: 24, marginBottom: 20 }}>
        <div className="os-filter-group">
          <span className="os-filter-label">Filter Agent:</span>
          <button
            type="button"
            className={`btn-ghost ${selectedAgentId === "ALL" ? "active" : ""}`}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              backgroundColor: selectedAgentId === "ALL" ? "var(--bg-elevated)" : "transparent",
              color: selectedAgentId === "ALL" ? "var(--accent-primary)" : "var(--text-secondary)"
            }}
            onClick={() => setSelectedAgentId("ALL")}
          >
            All Agents (5)
          </button>
          {AGENT_REGISTRY.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={`btn-ghost ${selectedAgentId === agent.id ? "active" : ""}`}
              style={{
                padding: "4px 10px",
                borderRadius: 4,
                backgroundColor: selectedAgentId === agent.id ? "var(--bg-elevated)" : "transparent",
                color: selectedAgentId === agent.id ? agent.themeColor : "var(--text-secondary)"
              }}
              onClick={() => setSelectedAgentId(agent.id)}
            >
              {agent.name}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
          gap: 20
        }}
      >
        {displayedAgents.map((agent) => {
          const stats = agentStats.get(agent.id) || { total: 0, highMatch: 0, leads: [] };
          const connectedSourceObj = DATA_SOURCE_REGISTRY.find((s) => agent.connectedSources.includes(s.id));

          return (
            <div
              key={agent.id}
              className="os-card"
              style={{
                borderTop: `3px solid ${agent.themeColor}`,
                display: "flex",
                flexDirection: "column",
                gap: 16
              }}
            >
              {/* Card Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      backgroundColor: agent.accentBg,
                      color: agent.themeColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      fontWeight: 700
                    }}
                  >
                    <Icon name="sparkles" size={18} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                        {agent.name}
                      </h3>
                      <span className="os-badge neutral mono" style={{ fontSize: 10 }}>
                        {agent.codename}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {agent.role}
                    </div>
                  </div>
                </div>

                <span className="os-badge good mono" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--status-success-fg)" }} />
                  {agent.health}
                </span>
              </div>

              {/* Description */}
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {agent.description}
              </p>

              {/* Connected Source & Schedule Info */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  padding: 12,
                  backgroundColor: "var(--bg-elevated)",
                  borderRadius: 6,
                  border: "1px solid var(--border-subtle)",
                  fontSize: 12
                }}
              >
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em" }}>
                    CONNECTED SOURCE
                  </div>
                  <div style={{ color: "var(--text-primary)", fontWeight: 500, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {connectedSourceObj?.name || agent.sourceType}
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em" }}>
                    AGENT CADENCE
                  </div>
                  <div style={{ color: "var(--text-primary)", fontWeight: 500, marginTop: 2 }}>
                    {agent.updateSchedule}
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em" }}>
                    ASSIGNED PIPELINES
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                    {agent.assignedPipelines.map((pipe) => (
                      <span key={pipe} className="os-badge info mono" style={{ fontSize: 10 }}>
                        {pipe}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em" }}>
                    DISCOVERIES
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                    <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                      {stats.total}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      ({stats.highMatch} high match)
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Discoveries Sample */}
              {stats.leads.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      marginBottom: 8,
                      letterSpacing: "0.04em"
                    }}
                  >
                    RECENT DISCOVERIES FROM THIS AGENT
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {stats.leads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => onSelectOpportunity(lead)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 10px",
                          borderRadius: 4,
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border-subtle)",
                          cursor: "pointer",
                          fontSize: 12,
                          transition: "border-color 140ms ease"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "var(--border-strong)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--border-subtle)";
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                          <div style={{ fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {lead.title}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {lead.organization} · {lead.location}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            className={`os-badge mono ${lead.score_total >= 80 ? "good" : "neutral"}`}
                            style={{ fontSize: 11 }}
                          >
                            {lead.score_total} pts
                          </span>
                          <Icon name="external" size={12} className="text-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Card Footer Actions */}
              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 12,
                  borderTop: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: 12, padding: "4px 8px" }}
                  onClick={() => {
                    const firstPipe = agent.assignedPipelines[0];
                    if (firstPipe === "freelance_leads") onNavigate("/freelance");
                    else if (firstPipe === "visa_jobs") onNavigate("/jobs");
                    else if (firstPipe === "masters_scholarships") onNavigate("/masters");
                    else if (firstPipe === "remote_jobs") onNavigate("/remote");
                    else onNavigate("/opportunities");
                  }}
                >
                  <span>Explore Leads</span>
                  <Icon name="external" size={12} />
                </button>

                {connectedSourceObj?.url && (
                  <a
                    href={connectedSourceObj.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: "4px 8px", textDecoration: "none" }}
                  >
                    <span>View Tracker</span>
                    <Icon name="external" size={12} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
