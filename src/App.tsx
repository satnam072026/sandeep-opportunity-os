import React, { useEffect, useState, useCallback } from "react";
import { AppRouterProvider, useAppRouter } from "./app/router/router";
import {
  fetchOpportunityState,
  getFastCachedState,
  performOpportunitySync,
  persistWorkflowMutation,
  persistCandidateProfile,
  type RepositoryState
} from "./features/opportunities/api/opportunityRepository";
import { AppShell } from "./components/ui/AppShell";
import { OpportunityDrawer } from "./components/ui/OpportunityDrawer";
import { LoadingSkeleton } from "./components/ui/LoadingSkeleton";
import { TodayPage } from "./features/today/TodayPage";
import { WorkspacePage } from "./features/workspaces/WorkspacePage";
import { SavedFollowUpsPage } from "./features/crm/SavedFollowUpsPage";
import { AiAgentsPage } from "./features/agents/AiAgentsPage";
import { DataSourcesPage } from "./features/sources/DataSourcesPage";
import { OperationsPage } from "./features/operations/OperationsPage";
import { ProfilePage } from "./features/profile/ProfilePage";
import { AuthProvider, AuthGuard } from "./features/auth/AuthGuard";
import { ExplorerWorkspace } from "./features/explorer/ExplorerWorkspace";
import {
  type ExplorerSelection,
  type ExplorerAgent,
  type WorkspaceConfig,
  type FolderConfig,
  type SheetConfig,
  type ExplorerAgentId
} from "./features/explorer/explorerData";
import type { CandidateProfile, OpportunityRecord, WorkflowState } from "./types/opportunity";

const MainContent: React.FC = () => {
  const { currentPath, searchParams, navigate } = useAppRouter();
  const [repoState, setRepoState] = useState<RepositoryState | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityRecord | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Initialize Explorer selection from search params or defaults
  const [selection, setSelection] = useState<ExplorerSelection>(() => {
    const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : searchParams;
    const agent = (sp.get("agent") as ExplorerAgentId) || "bago_muse";
    const ws = sp.get("ws") || "ws_bagomuse";
    const hasFolder = sp.has("folder");
    const hasSheet = sp.has("sheet");
    const folder = hasFolder ? sp.get("folder") || undefined : "f_social_hunter";
    const sheet = hasSheet ? sp.get("sheet") || undefined : (hasFolder ? undefined : "muse_social_job_hunter");
    const tab = sp.get("tab") || (sheet ? "ALL LEADS" : undefined);
    return {
      agentId: agent,
      workspaceId: ws,
      folderId: folder,
      sheetId: sheet,
      tabId: tab
    };
  });

  useEffect(() => {
    if (currentPath === "/explorer") {
      const agent = searchParams.get("agent") as ExplorerAgentId | null;
      const ws = searchParams.get("ws");
      const hasFolder = searchParams.has("folder");
      const hasSheet = searchParams.has("sheet");
      const hasTab = searchParams.has("tab");

      setSelection((prev) => ({
        agentId: agent || prev.agentId,
        workspaceId: ws || prev.workspaceId,
        folderId: hasFolder ? searchParams.get("folder") || undefined : prev.folderId,
        sheetId: hasSheet ? searchParams.get("sheet") || undefined : (hasFolder ? undefined : prev.sheetId),
        tabId: hasTab ? searchParams.get("tab") || undefined : (hasSheet ? undefined : prev.tabId)
      }));
    }
  }, [currentPath, searchParams]);

  useEffect(() => {
    let active = true;

    // 1. Immediately hydrate from persistent cache if available for instant zero-latency render
    void getFastCachedState().then((cachedState) => {
      if (active && cachedState) {
        setRepoState((prev) => prev || cachedState);
      }
    });

    // 2. Fetch fresh live state from Neon / Supabase / server
    void fetchOpportunityState().then((state) => {
      if (active) {
        setRepoState(state);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", next);
      }
      return next;
    });
  }, []);

  const handleUpdateWorkflow = useCallback(
    async (record: OpportunityRecord, patch: Partial<WorkflowState>) => {
      const updated = await persistWorkflowMutation(record, patch);
      setRepoState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          opportunities: prev.opportunities.map((o) => (o.id === updated.id ? updated : o))
        };
      });
      setSelectedOpportunity(updated);
    },
    []
  );

  const handleTriggerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      if (repoState) {
        const { state } = await performOpportunitySync(repoState.opportunities, repoState.profile);
        setRepoState(state);
        setSelectedOpportunity((current) =>
          current ? state.opportunities.find((item) => item.id === current.id) || null : null
        );
      } else {
        const refreshed = await fetchOpportunityState();
        setRepoState(refreshed);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [repoState]);

  const handleUpdateProfile = useCallback(async (nextProfile: CandidateProfile) => {
    const persisted = await persistCandidateProfile(nextProfile);
    setRepoState((prev) => (prev ? { ...prev, profile: persisted } : prev));
  }, []);

  // Selection handlers for Drive Explorer and Workspace Agents
  const handleSelectAgent = useCallback(
    (agent: ExplorerAgent) => {
      let wsId = agent.defaultWorkspaceId;
      let fId: string | undefined = undefined;
      let sId: string | undefined = undefined;
      let tId: string | undefined = undefined;

      if (agent.id === "bago_muse") {
        wsId = "ws_bagomuse";
        fId = "f_social_hunter";
        sId = "muse_social_job_hunter";
        tId = "ALL LEADS";
      } else if (agent.id === "kattu_ai") {
        wsId = "ws_kattu";
        fId = "f_regional_fleet";
        sId = "kattu_india_regional";
        tId = "ALL ROLES";
      } else if (agent.id === "haya_satnam") {
        wsId = "ws_musesatnam";
        fId = "f_global_jobs";
        sId = "satnam_global_jobs";
        tId = "All Roles";
      }

      const next: ExplorerSelection = {
        agentId: agent.id,
        workspaceId: wsId,
        folderId: fId,
        sheetId: sId,
        tabId: tId
      };
      setSelection(next);
      navigate("/explorer", {
        agent: agent.id,
        ws: wsId,
        ...(fId ? { folder: fId } : {}),
        ...(sId ? { sheet: sId } : {}),
        ...(tId ? { tab: tId } : {})
      });
    },
    [navigate]
  );

  const handleSelectWorkspace = useCallback(
    (ws: WorkspaceConfig) => {
      const next: ExplorerSelection = {
        workspaceId: ws.id,
        agentId: ws.ownerAgentId,
        folderId: undefined,
        sheetId: undefined,
        tabId: undefined
      };
      setSelection(next);
      navigate("/explorer", {
        ws: ws.id,
        ...(ws.ownerAgentId ? { agent: ws.ownerAgentId } : {})
      });
    },
    [navigate]
  );

  const handleSelectFolder = useCallback(
    (folder: FolderConfig, ws: WorkspaceConfig) => {
      const next: ExplorerSelection = {
        workspaceId: ws.id,
        agentId: ws.ownerAgentId,
        folderId: folder.id,
        sheetId: undefined,
        tabId: undefined
      };
      setSelection(next);
      navigate("/explorer", {
        ws: ws.id,
        folder: folder.id,
        ...(ws.ownerAgentId ? { agent: ws.ownerAgentId } : {})
      });
    },
    [navigate]
  );

  const handleSelectSheet = useCallback(
    (sheet: SheetConfig, folder?: FolderConfig, ws?: WorkspaceConfig) => {
      const wsId = ws?.id || selection.workspaceId;
      const fId = folder?.id || selection.folderId;
      const tId = sheet.tabs[0]?.id;

      const next: ExplorerSelection = {
        workspaceId: wsId,
        folderId: fId,
        sheetId: sheet.id,
        tabId: tId,
        agentId: ws?.ownerAgentId || selection.agentId
      };
      setSelection(next);
      navigate("/explorer", {
        ws: wsId,
        ...(fId ? { folder: fId } : {}),
        sheet: sheet.id,
        ...(tId ? { tab: tId } : {})
      });
    },
    [navigate, selection]
  );

  const handleSelectTab = useCallback(
    (tabId: string, sheet: SheetConfig, folder?: FolderConfig, ws?: WorkspaceConfig) => {
      const wsId = ws?.id || selection.workspaceId;
      const fId = folder?.id || selection.folderId;

      const next: ExplorerSelection = {
        workspaceId: wsId,
        folderId: fId,
        sheetId: sheet.id,
        tabId: tabId,
        agentId: ws?.ownerAgentId || selection.agentId
      };
      setSelection(next);
      navigate("/explorer", {
        ws: wsId,
        ...(fId ? { folder: fId } : {}),
        sheet: sheet.id,
        tab: tabId
      });
    },
    [navigate, selection]
  );

  if (!repoState) {
    return <LoadingSkeleton />;
  }

  const { opportunities, profile, mode, nativeSheetId, uploadedXlsxId, lastSyncedAt } = repoState;

  return (
    <AppShell
      currentPath={currentPath}
      onNavigate={navigate}
      opportunities={opportunities}
      onSelectOpportunity={setSelectedOpportunity}
      mode={mode}
      lastSyncedAt={lastSyncedAt}
      onSyncNow={handleTriggerSync}
      isSyncing={isSyncing}
      theme={theme}
      onToggleTheme={toggleTheme}
      selection={selection}
      onSelectAgent={handleSelectAgent}
      onSelectWorkspace={handleSelectWorkspace}
      onSelectFolder={handleSelectFolder}
      onSelectSheet={handleSelectSheet}
      onSelectTab={handleSelectTab}
    >
      {/* 1. Drive Explorer Workspace View */}
      {currentPath === "/explorer" && (
        <ExplorerWorkspace
          opportunities={opportunities}
          selectedOpportunityId={selectedOpportunity?.id}
          onSelectOpportunity={setSelectedOpportunity}
          lastSyncedAt={lastSyncedAt}
          selection={selection}
          onUpdateSelection={(patch) => {
            setSelection((prev) => {
              const next = { ...prev, ...patch };
              navigate("/explorer", {
                ...(next.agentId ? { agent: next.agentId } : {}),
                ...(next.workspaceId ? { ws: next.workspaceId } : {}),
                ...(next.folderId ? { folder: next.folderId } : {}),
                ...(next.sheetId ? { sheet: next.sheetId } : {}),
                ...(next.tabId ? { tab: next.tabId } : {})
              });
              return next;
            });
          }}
        />
      )}

      {/* 2. Today Command Center */}
      {currentPath === "/today" && (
        <TodayPage
          opportunities={opportunities}
          onSelectOpportunity={setSelectedOpportunity}
          onNavigate={navigate}
          lastSyncedAt={lastSyncedAt}
          onSyncNow={handleTriggerSync}
          isSyncing={isSyncing}
        />
      )}

      {/* 3. All Opportunities Directory */}
      {currentPath === "/opportunities" && (
        <WorkspacePage
          category="all"
          title="All Opportunities Directory"
          subtitle="Unified multi-agent database spanning freelance leads, engineering jobs, remote opportunities, and scholarships."
          opportunities={opportunities}
          selectedId={selectedOpportunity?.id}
          onSelectOpportunity={setSelectedOpportunity}
        />
      )}

      {/* 4. AI Agent Fleet */}
      {currentPath === "/agents" && (
        <AiAgentsPage
          opportunities={opportunities}
          onSelectOpportunity={setSelectedOpportunity}
          onNavigate={navigate}
          onSyncNow={handleTriggerSync}
          isSyncing={isSyncing}
        />
      )}

      {/* 5. Data Sources Hub */}
      {currentPath === "/sources" && (
        <DataSourcesPage
          onSyncNow={handleTriggerSync}
          isSyncing={isSyncing}
          lastSyncedAt={lastSyncedAt}
          recordCount={opportunities.length}
        />
      )}

      {/* 6. Pipelines */}
      {currentPath === "/freelance" && (
        <WorkspacePage
          category="freelance_leads"
          title="Freelance Client Leads"
          subtitle="High-conversion Cyprus & UK SME targets with deterministic DOM findings and commercial outreach hooks."
          opportunities={opportunities}
          selectedId={selectedOpportunity?.id}
          onSelectOpportunity={setSelectedOpportunity}
        />
      )}
      {currentPath === "/jobs" && (
        <WorkspacePage
          category="visa_jobs"
          title="Visa & Cyprus Jobs"
          subtitle="Junior / Graduate & Early-Career (0–2 yr) frontend and full-stack roles with Seniority Gate enforcement."
          opportunities={opportunities}
          selectedId={selectedOpportunity?.id}
          onSelectOpportunity={setSelectedOpportunity}
        />
      )}
      {currentPath === "/masters" && (
        <WorkspacePage
          category="masters_scholarships"
          title="Master's & Scholarships"
          subtitle="UCLan Cyprus 40% Alumni Scholarship, Erasmus Mundus Joint Masters & EU MSc programmes."
          opportunities={opportunities}
          selectedId={selectedOpportunity?.id}
          onSelectOpportunity={setSelectedOpportunity}
        />
      )}
      {currentPath === "/remote" && (
        <WorkspacePage
          category="remote_jobs"
          title="Remote & Internships"
          subtitle="Cyprus-compatible remote roles with Regional Restriction Gate excluding US-only & Africa-only listings."
          opportunities={opportunities}
          selectedId={selectedOpportunity?.id}
          onSelectOpportunity={setSelectedOpportunity}
        />
      )}

      {/* 7. CRM Follow-ups */}
      {(currentPath === "/crm" || currentPath === "/saved") && (
        <SavedFollowUpsPage
          opportunities={opportunities}
          onSelectOpportunity={setSelectedOpportunity}
        />
      )}

      {/* 8. Operations & Health */}
      {currentPath === "/operations" && (
        <OperationsPage
          mode={mode}
          nativeSheetId={nativeSheetId}
          uploadedXlsxId={uploadedXlsxId}
          lastSyncedAt={lastSyncedAt}
          recordCount={opportunities.length}
          opportunities={opportunities}
          onTriggerSync={handleTriggerSync}
          isSyncing={isSyncing}
          telemetry={repoState.syncTelemetry}
        />
      )}

      {/* 9. Candidate Profile */}
      {currentPath === "/profile" && (
        <ProfilePage profile={profile} onUpdateProfile={handleUpdateProfile} />
      )}

      {/* Detail Drawer for Inspecting and Mutating Sandeep's 7 CRM Fields */}
      <OpportunityDrawer
        opportunity={selectedOpportunity}
        onClose={() => setSelectedOpportunity(null)}
        onUpdateWorkflow={handleUpdateWorkflow}
      />
    </AppShell>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <AuthGuard>
      <AppRouterProvider>
        <MainContent />
      </AppRouterProvider>
    </AuthGuard>
  </AuthProvider>
);

export default App;
