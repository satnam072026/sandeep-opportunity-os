import { test, expect } from "@playwright/test";

const ROUTES = [
  ["/today", "Today Command Center"],
  ["/freelance", "Freelance Client Leads"],
  ["/jobs", "Visa & Cyprus Jobs"],
  ["/masters", "Master's & Scholarships"],
  ["/remote", "Remote & Internships"],
  ["/saved", "Saved & CRM Follow-ups"],
  ["/operations", "System Operations & Evidence"],
  ["/profile", "Candidate Profile & Governance"]
] as const;

test.describe("Sandeep Opportunity OS — enterprise frontend flows", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.title.includes("unauthenticated")) {
      return;
    }
    await page.addInitScript(() => {
      window.localStorage.setItem("sandeep_neon_auth_token", "sess_e2e_valid_token");
      window.localStorage.setItem(
        "sandeep_neon_auth_user",
        JSON.stringify({
          id: "usr_sandeep_e2e",
          name: "Sandeep Gautam",
          email: "sandeep.gautam@opportunity-os.local",
          role: "admin"
        })
      );
    });
  });

  test("all eight routes render current shell metadata", async ({ page }) => {
    for (const [path, breadcrumb] of ROUTES) {
      await page.goto(path);
      await expect(page.locator(".os-breadcrumb-current")).toHaveText(breadcrumb);
      await expect(page.locator(".os-page-header")).toBeVisible();
    }
  });

  test("workspace drawer traps focus, persists CRM notes across reload, and closes with Escape", async ({ page }) => {
    await page.goto("/freelance");
    let firstRecord = page.locator(".responsive-switch [role='button']:visible").first();
    await firstRecord.focus();
    await firstRecord.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: /Close inspector drawer/ })).toBeFocused();

    const noteBox = page.locator("#drawer-crm-note");
    const note = "E2E persistence check — contact lead with verified case-study evidence";
    await noteBox.fill(note);
    await page.getByRole("button", { name: "Save CRM Note" }).click();
    await page.waitForTimeout(300);

    await page.reload();
    firstRecord = page.locator(".responsive-switch [role='button']:visible").first();
    await firstRecord.focus();
    await firstRecord.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(noteBox).toHaveValue(note);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(firstRecord).toBeFocused();
  });

  test("Today uses the runtime date instead of the old hard-coded 14 October value", async ({ page }) => {
    await page.goto("/today");
    const title = page.locator(".os-page-title");
    await expect(title).toContainText("Sandeep");
    await expect(title).not.toContainText("14 October 2026");
  });

  test("390px CRM view uses cards instead of a squeezed table", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/freelance");
    await expect(page.locator(".responsive-switch .os-table")).toBeHidden();
    const cards = page.locator(".responsive-switch .os-mobile-card");
    await expect(cards.first()).toBeVisible();
  });

  test("light and dark themes remain available", async ({ page }) => {
    await page.goto("/today");
    const shell = page.locator(".os-shell");
    await expect(shell).toHaveAttribute("data-theme", "dark");
    if ((page.viewportSize()?.width || 0) <= 768) {
      await page.getByRole("button", { name: "Toggle navigation drawer" }).click();
    }
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(shell).toHaveAttribute("data-theme", "light");
  });

  test("Operations renders data source sections and manual sync runs", async ({ page }) => {
    await page.goto("/operations");
    await expect(page.locator("h2:has-text('Neon PostgreSQL Lakebase Health')")).toBeVisible();
    await expect(page.locator("h2:has-text('Automated 5-Hour Ingestion Daemon')")).toBeVisible();
    await expect(page.locator("h2:has-text('1. Google Sheets Sources')")).toBeVisible();
    await expect(page.locator("h2:has-text('2. Google Drive Trackers')")).toBeVisible();
    await expect(page.locator("h2:has-text('3. Local-Only Muse Workstation Trackers')")).toBeVisible();
    await expect(page.locator("h2:has-text('4. Canonical Database')")).toBeVisible();
    await expect(page.locator("h2:has-text('5. Legacy & Disconnected')")).toBeVisible();

    // Verify setup guide toggle
    const toggleBtn = page.getByRole("button", { name: "Service Account Setup Guide" });
    await toggleBtn.click();
    await expect(page.locator(".os-setup-guide")).toBeVisible();

    // Trigger sync
    const syncBtn = page.getByRole("button", { name: "Sync Data Now" });
    await syncBtn.click();
    await expect(page.locator(".os-telemetry-val:has-text('Records')").first()).toBeVisible();
  });

  test("Opportunity drawer renders Sources & Files / Drive Pack section", async ({ page }) => {
    await page.goto("/jobs");
    const firstRecord = page.locator(".responsive-switch [role='button']:visible").first();
    await firstRecord.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await expect(page.locator("h3:has-text('6. Sources & Files / Drive Pack')")).toBeVisible();
    await expect(page.locator(".os-drive-pack-card:has-text('Source Tracker')")).toBeVisible();
    await expect(page.locator(".os-drive-pack-card:has-text('Drive Application Pack')")).toBeVisible();
    await expect(page.locator("h3:has-text('7. AI Agent Fleet Provenance & Sources')")).toBeVisible();
  });

  test("AI Agents page renders the 3 configured fleet cards with provenance badges", async ({ page }) => {
    await page.goto("/agents");
    await expect(page.locator(".os-page-title")).toHaveText("AI Research Agent Fleet");
    await expect(page.locator("h3:has-text('Bago Muse')")).toBeVisible();
    await expect(page.locator("h3:has-text('Haya Satnam')")).toBeVisible();
    await expect(page.locator("h3:has-text('Kattu AI')")).toBeVisible();
    await expect(page.locator("h3:has-text('Haya Arsh')")).toHaveCount(0);
  });

  test("Data Sources page renders Google Drive/Sheets and local sources registry", async ({ page }) => {
    await page.goto("/sources");
    await expect(page.locator(".os-page-title")).toHaveText("Data Sources & Ingestion Hub");
    await expect(page.locator("td:has-text('MUSE | FACEBOOK & INSTAGRAM JOB HUNTER')").first()).toBeVisible();
    await expect(page.locator("td:has-text('MASTER_JOB_APPLICATION_TRACKER.xlsx')").first()).toBeVisible();
    await expect(page.locator("td:has-text('master-spreadsheet.xlsx')").first()).toBeVisible();
  });

  test("All Opportunities page renders unified table with Agent column and agent filters", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.locator(".os-page-title")).toHaveText("All Opportunities Directory");
    if ((page.viewportSize()?.width || 0) > 768) {
      await expect(page.locator("th:has-text('Agent')")).toBeVisible();
    } else {
      await expect(page.locator(".responsive-switch .os-mobile-card").first()).toBeVisible();
    }
    await expect(page.locator("button:has-text('Bago Muse')").first()).toBeVisible();
    await expect(page.locator("button:has-text('Haya Satnam')").first()).toBeVisible();
  });

  test("Today page renders immediate priority spotlight cards and action queue tabs", async ({ page }) => {
    await page.goto("/today");
    // Verify immediate priority spotlight cards
    const spotlightCards = page.locator(".os-spotlight-card");
    await expect(spotlightCards.first()).toBeVisible();
    await expect(spotlightCards.locator(".os-spotlight-rank").first()).toHaveText("#1");

    // Verify action queue saved view tabs
    const queueTabs = page.locator(".os-queue-toolbar [role='tab']");
    await expect(queueTabs.filter({ hasText: "Top Actions" })).toBeVisible();
    await expect(queueTabs.filter({ hasText: "New Leads" })).toBeVisible();
    await expect(queueTabs.filter({ hasText: "Follow-ups Due" })).toBeVisible();

    // Verify human-friendly category formatters are used and raw DB enums are never rendered
    await expect(page.locator("body")).not.toContainText("freelance_leads");
    await expect(page.locator("body")).not.toContainText("visa_jobs");
    await expect(page.locator("body")).not.toContainText("masters_scholarships");
  });

  test("Single primary Sync Data action exists in top bar without duplicates in Today header or Sidebar footer", async ({ page }) => {
    await page.goto("/today");
    // 1. Primary Sync Data button in topbar
    const topbarSync = page.locator(".os-topbar .os-sync-control button:has-text('Sync Data')");
    await expect(topbarSync).toBeVisible();

    // 2. Today header must NOT have a duplicate sync button
    const todayHeaderSync = page.locator(".os-page-header button:has-text('Sync')");
    await expect(todayHeaderSync).toHaveCount(0);

    // 3. Sidebar footer must NOT have a duplicate sync button
    const sidebarSync = page.locator(".os-sidebar-footer button:has-text('Sync')");
    await expect(sidebarSync).toHaveCount(0);
  });

  test("Open Access: loads Today Command Center immediately without password or login barrier", async ({ page, context }) => {
    // Clear storage to simulate brand new user
    await context.clearCookies();
    await page.goto("/today");
    await page.evaluate(() => {
      window.localStorage.removeItem("sandeep_neon_auth_token");
      window.localStorage.removeItem("sandeep_neon_auth_user");
    });
    await page.reload();

    // Verify app opens directly without any password prompt or login screen
    await expect(page.locator(".os-breadcrumb-current")).toHaveText("Today Command Center", { timeout: 30000 });
    await expect(page.locator("h1:has-text('Enterprise Control Center')")).toHaveCount(0);
  });

  test("Workspace Agents: displays Bago Muse, Kattu AI, and Haya Satnam while excluding placeholders", async ({ page }) => {
    await page.goto("/today");
    if ((page.viewportSize()?.width || 0) <= 768) {
      await page.getByRole("button", { name: "Toggle navigation drawer" }).click();
    }

    const agentSwitcher = page.locator(".os-agent-switcher-container");
    await expect(agentSwitcher).toBeVisible();

    // Verify exactly 3 configured agents
    await expect(agentSwitcher.locator(".os-agent-name:has-text('Bago Muse')")).toBeVisible();
    await expect(agentSwitcher.locator(".os-agent-name:has-text('Kattu AI')")).toBeVisible();
    await expect(agentSwitcher.locator(".os-agent-name:has-text('Haya Satnam')")).toBeVisible();
    await expect(agentSwitcher.locator(".os-agent-name:has-text('Haya Arsh')")).toHaveCount(0);

    // Strict rule: NEVER show Sandy Muse in the agent switcher
    await expect(agentSwitcher.locator(".os-agent-name:has-text('Sandy Muse')")).toHaveCount(0);
  });

  test("Drive Explorer: omits the unconfigured workspace and enables one-click file navigation", async ({ page }) => {
    await page.goto("/today");
    if ((page.viewportSize()?.width || 0) <= 768) {
      await page.getByRole("button", { name: "Toggle navigation drawer" }).click();
    }

    const explorer = page.locator(".os-drive-explorer");
    await expect(explorer).toBeVisible();

    // Verify configured root workspaces in the tree
    await expect(explorer.locator(".ws-label:has-text('Bago Muse')")).toBeVisible();
    await expect(explorer.locator(".ws-label:has-text('MUSESATNAM')")).toBeVisible();
    await expect(explorer.locator(".ws-label:has-text('Projects KattuAI')")).toBeVisible();
    await expect(explorer.locator(".ws-label:has-text('Haya Arsh workspace')")).toHaveCount(0);
    await expect(explorer.locator(".ws-label:has-text('Job Apply')")).toBeVisible();
    await expect(explorer.locator(".ws-label:has-text('JOB_CMS_AGENTS')")).toBeVisible();

    // One-click: Click Bago Muse in Workspace Agents
    await page.click(".os-agent-item:has-text('Bago Muse')");
    await expect(page).toHaveURL(/.*explorer.*/);

    // Verify Sheet Workspace dominates view with metrics, tabs, and spreadsheet
    await expect(page.locator(".os-compact-metric-strip")).toBeVisible();
    await expect(page.locator(".os-sheet-tabs-wrapper")).toBeVisible();
    await expect(page.locator(".os-spreadsheet-workspace")).toBeVisible();

    // One-click: Click tab 'DAILY RESULTS'
    const dailyTab = page.locator(".os-sheet-tab:has-text('DAILY RESULTS')");
    if (await dailyTab.isVisible()) {
      await dailyTab.click();
      await expect(dailyTab).toHaveClass(/active/);
    }
  });
});


