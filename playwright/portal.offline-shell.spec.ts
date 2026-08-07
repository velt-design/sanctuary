import { expect, test, type Locator, type Page } from "@playwright/test";

const productionBrowserSurface =
  process.env.PORTAL_PLAYWRIGHT_PRODUCTION === "1" ||
  Boolean(process.env.PORTAL_BASE_URL?.trim());
const requiredOfflineShellGate =
  process.env.PORTAL_OFFLINE_SHELL_REQUIRED === "1";

if (requiredOfflineShellGate && !productionBrowserSurface) {
  throw new Error(
    "The required offline-shell gate must run against next start or an explicit PORTAL_BASE_URL.",
  );
}

const GENERIC_LOADING_SELECTOR = [
  '[aria-label="Page loading"]:visible',
  "[data-portal-instant-shell]:visible",
  '[data-ui-foundation-consumer="blueprint-loading"]:visible',
].join(", ");

type CachedAssetEntry = {
  cacheName: string;
  url: string;
  pathname: string;
  search: string;
  authorization: string | null;
  cacheControl: string;
  contentDisposition: string;
  contentType: string;
  ok: boolean;
  redirected: boolean;
};

type CacheSnapshot = {
  cacheNames: string[];
  entries: CachedAssetEntry[];
};

type AuthenticatedPortalWarmResult = {
  unavailable: string | null;
  workerVersion: string | null;
};

test.describe("production soft-offline staff shell", () => {
  test.skip(
    !productionBrowserSurface,
    "The portal service worker is intentionally disabled in development. Run against next start or PORTAL_BASE_URL.",
  );

  function requireOrSkip(reason: string | null): void {
    if (!reason) return;
    if (requiredOfflineShellGate) {
      throw new Error(`Offline shell prerequisite failed: ${reason}`);
    }
    test.skip(true, reason);
  }

  async function authenticatedRouteUnavailable(
    page: Page,
  ): Promise<string | null> {
    const pathname = new URL(page.url()).pathname;
    if (pathname.startsWith("/login"))
      return "The staff browser session is not authenticated.";
    if (pathname.startsWith("/access-status"))
      return "The browser account does not currently have staff access.";
    return null;
  }

  async function expectDashboardFinalFrame(page: Page): Promise<void> {
    const root = page.locator(
      '[data-portal-page-shell="dashboard"][data-portal-page-shell-ready="true"]:visible',
    );
    await expect(root.locator('[data-dashboard-hero="true"]')).toBeVisible({
      timeout: 60_000,
    });
    for (const region of [
      "Quick actions",
      "Project portfolio",
      "Work Queue",
      "Recent Activity",
      "Recent Estimates",
      "My Tasks",
    ]) {
      await expect(
        root.getByRole("region", { name: region, exact: true }),
      ).toBeVisible();
    }
  }

  async function expectProjectsFinalFrame(page: Page): Promise<void> {
    const root = page.locator(
      '[data-portal-page-shell="projects"][data-portal-page-shell-ready="true"]:visible',
    );
    await expect(
      root.getByRole("region", { name: "Filters", exact: true }),
    ).toBeVisible({
      timeout: 60_000,
    });
    const table = root.getByRole("table", { name: "Projects", exact: true });
    await expect(table).toBeVisible();
    for (const column of [
      "Name",
      "Client",
      "Phone",
      "Address",
      "Journey",
      "Stage",
      "State",
      "Owner",
      "Next attention",
      "Actions",
    ]) {
      await expect(
        table.getByRole("columnheader", { name: column, exact: true }),
      ).toBeVisible();
    }
  }

  function checkedWorkerVersion(
    snapshot: { scope: string; scriptURL: string | null },
    description: string,
  ): string {
    expect(snapshot.scriptURL, `${description} must expose an active script URL.`).not.toBeNull();
    const scopeOrigin = new URL(snapshot.scope).origin;
    const script = new URL(snapshot.scriptURL as string);
    expect(script.origin, `${description} must be same-origin.`).toBe(scopeOrigin);
    expect(script.pathname, `${description} must use the reviewed worker script.`).toBe('/sw.js');
    expect(
      Array.from(script.searchParams.keys()),
      `${description} may carry only its release version.`,
    ).toEqual(['v']);
    const version = script.searchParams.get('v');
    expect(version, `${description} must carry a bounded release version.`).toMatch(
      /^[A-Za-z0-9._-]{1,80}$/,
    );
    return version as string;
  }

  async function expectActiveStaticWorker(page: Page): Promise<string> {
    const worker = await page.evaluate(async () => {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new Error('service_worker_ready_timeout')),
            30_000,
          );
        }),
      ]);
      return {
        active: registration.active?.scriptURL ?? null,
        scope: registration.scope,
      };
    });
    return checkedWorkerVersion(
      { scope: worker.scope, scriptURL: worker.active },
      'The first authenticated portal worker',
    );
  }

  async function warmAuthenticatedPortal(page: Page): Promise<AuthenticatedPortalWarmResult> {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const dashboardUnavailable = await authenticatedRouteUnavailable(page);
    if (dashboardUnavailable) {
      return { unavailable: dashboardUnavailable, workerVersion: null };
    }
    await expectDashboardFinalFrame(page);

    // A newly installed worker is guaranteed to control the next in-scope
    // document navigation once it is active. Waiting here avoids depending on
    // the timing of clients.claim() for the already-open Dashboard document.
    const workerVersion = await expectActiveStaticWorker(page);

    await page.goto("/staff/projects", { waitUntil: "domcontentloaded" });
    const projectsUnavailable = await authenticatedRouteUnavailable(page);
    if (projectsUnavailable) {
      return { unavailable: projectsUnavailable, workerVersion };
    }
    await expectProjectsFinalFrame(page);

    await expect
      .poll(
        () =>
          page
            .locator("[data-projects-index-state]")
            .first()
            .getAttribute("data-projects-index-state"),
        { timeout: 60_000 },
      )
      .toMatch(/^(fresh|refresh-failed|unavailable)$/);

    if (
      (await page
        .locator("[data-projects-index-state]")
        .first()
        .getAttribute("data-projects-index-state")) === "unavailable"
    ) {
      return {
        unavailable: "The authenticated browser session lost project access during the warm visit.",
        workerVersion,
      };
    }

    return {
      unavailable: await authenticatedRouteUnavailable(page),
      workerVersion,
    };
  }

  async function expectControlledStaticWorker(
    page: Page,
    expectedVersion: string,
  ): Promise<string> {
    const support = await page.evaluate(
      () => "serviceWorker" in navigator && "caches" in window,
    );
    expect(
      support,
      "This production browser must support Service Worker and CacheStorage.",
    ).toBe(true);

    try {
      await page.evaluate(async (version) => {
        const isExpectedController = () => {
          const scriptURL = navigator.serviceWorker.controller?.scriptURL;
          if (!scriptURL) return false;
          const script = new URL(scriptURL);
          return script.origin === location.origin
            && script.pathname === '/sw.js'
            && script.searchParams.size === 1
            && script.searchParams.get('v') === version;
        };
        if (isExpectedController()) return;

        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            navigator.serviceWorker.removeEventListener('controllerchange', inspect);
            reject(new Error('service_worker_controller_timeout'));
          }, 30_000);
          const inspect = () => {
            if (!isExpectedController()) return;
            window.clearTimeout(timeout);
            navigator.serviceWorker.removeEventListener('controllerchange', inspect);
            resolve();
          };
          navigator.serviceWorker.addEventListener('controllerchange', inspect);
          inspect();
        });
      }, expectedVersion);
    } catch (error) {
      const registrations = await page.evaluate(async () =>
        Promise.all(
          (await navigator.serviceWorker.getRegistrations()).map(async (registration) => ({
            scope: registration.scope,
            active: registration.active
              ? { scriptURL: registration.active.scriptURL, state: registration.active.state }
              : null,
            waiting: registration.waiting
              ? { scriptURL: registration.waiting.scriptURL, state: registration.waiting.state }
              : null,
            installing: registration.installing
              ? { scriptURL: registration.installing.scriptURL, state: registration.installing.state }
              : null,
          })),
        ),
      );
      throw new Error(
        `A versioned portal worker became active but did not control the current document. ${JSON.stringify({
          url: page.url(),
          expectedVersion,
          controller: await page.evaluate(
            () => navigator.serviceWorker.controller?.scriptURL ?? null,
          ),
          registrations,
          runtimeState: await page.locator("html").getAttribute("data-portal-offline-shell-state"),
        })}`,
        { cause: error },
      );
    }

    const worker = await page.evaluate(() => ({
      controller: navigator.serviceWorker.controller?.scriptURL ?? null,
      scope: location.href,
    }));
    const controlledVersion = checkedWorkerVersion(
      { scope: worker.scope, scriptURL: worker.controller },
      'The warmed Projects document controller',
    );
    expect(
      controlledVersion,
      'The controlled worker must be the exact release activated during the first authenticated page.',
    ).toBe(expectedVersion);
    return controlledVersion;
  }

  async function readStaticCache(page: Page): Promise<CacheSnapshot> {
    return page.evaluate(async () => {
      const entries: CachedAssetEntry[] = [];
      const cacheNames = await caches.keys();

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        for (const request of await cache.keys()) {
          const response = await cache.match(request);
          if (!response) continue;
          const url = new URL(request.url);
          entries.push({
            cacheName,
            url: request.url,
            pathname: url.pathname,
            search: url.search,
            authorization: request.headers.get("authorization"),
            cacheControl: response.headers.get("cache-control") ?? "",
            contentDisposition:
              response.headers.get("content-disposition") ?? "",
            contentType: response.headers.get("content-type") ?? "",
            ok: response.ok,
            redirected: response.redirected,
          });
        }
      }

      return { cacheNames, entries };
    });
  }

  async function expectSafeStaticCache(
    page: Page,
    version: string,
  ): Promise<void> {
    const expectedCacheName = `sanctuary-portal-static-v1:${version}`;
    await expect
      .poll(
        async () => {
          const snapshot = await readStaticCache(page);
          return (
            snapshot.cacheNames.includes("sanctuary-portal-static-meta-v1") &&
            snapshot.cacheNames.includes(expectedCacheName) &&
            snapshot.entries.some(
              (entry) => entry.cacheName === expectedCacheName,
            ) &&
            snapshot.entries.some(
              (entry) =>
                entry.cacheName === "sanctuary-portal-static-meta-v1" &&
                entry.pathname ===
                  `/__portal-static-cache-meta__/complete/${version}`,
            )
          );
        },
        { timeout: 30_000 },
      )
      .toBe(true);

    const snapshot = await readStaticCache(page);
    expect(snapshot.cacheNames).toContain("sanctuary-portal-static-meta-v1");
    expect(snapshot.cacheNames).toContain(expectedCacheName);
    expect(
      snapshot.cacheNames.filter((name) =>
        name.startsWith("sanctuary-portal-static-v1:"),
      ),
      "A fresh browser context must retain only the controlled release cache.",
    ).toEqual([expectedCacheName]);
    expect(
      snapshot.entries
        .filter(
          (entry) => entry.cacheName === "sanctuary-portal-static-meta-v1",
        )
        .map((entry) => entry.pathname),
      "A fresh browser context must retain only the controlled release completion marker.",
    ).toEqual([`/__portal-static-cache-meta__/complete/${version}`]);
    expect(
      snapshot.entries.filter((entry) => entry.cacheName === expectedCacheName)
        .length,
      "The controlled release cache must contain at least one real static asset.",
    ).toBeGreaterThan(0);
    expect(
      snapshot.entries.some(
        (entry) =>
          entry.cacheName === "sanctuary-portal-static-meta-v1" &&
          entry.pathname ===
            `/__portal-static-cache-meta__/complete/${version}`,
      ),
      "The controlled release must have a matching completion marker.",
    ).toBe(true);
    for (const cacheName of snapshot.cacheNames) {
      expect(cacheName).toMatch(
        /^(?:sanctuary-portal-static-meta-v1|sanctuary-portal-static-v1:[A-Za-z0-9._-]{1,80})$/,
      );
    }
    for (const entry of snapshot.entries) {
      const metadataMarker =
        entry.cacheName === "sanctuary-portal-static-meta-v1" &&
        /^\/__portal-static-cache-meta__\/complete\/[A-Za-z0-9._-]{1,80}$/.test(
          entry.pathname,
        );
      const allowedPath =
        metadataMarker ||
        [
          "/images/sp_dark_icon.png",
          "/logo-sanctuary.png",
          "/logo-sanctuary.svg",
        ].includes(entry.pathname) ||
        (entry.pathname.startsWith("/_next/static/") &&
          /\.(?:css|js|mjs|otf|ttf|wasm|woff2?)$/i.test(entry.pathname));

      expect(
        allowedPath,
        `Unsafe URL found in ${entry.cacheName}: ${entry.url}`,
      ).toBe(true);
      expect(
        entry.search,
        `Versioned/request-specific URL was cached: ${entry.url}`,
      ).toBe("");
      expect(
        entry.authorization,
        `Authorization was attached to cached asset: ${entry.url}`,
      ).toBeNull();
      expect(entry.ok, `Non-success response was cached: ${entry.url}`).toBe(
        true,
      );
      expect(
        entry.redirected,
        `Redirect response was cached: ${entry.url}`,
      ).toBe(false);
      expect(
        entry.cacheControl.toLowerCase(),
        `Private response was cached: ${entry.url}`,
      ).not.toContain("private");
      expect(
        entry.cacheControl.toLowerCase(),
        `No-store response was cached: ${entry.url}`,
      ).not.toContain("no-store");
      if (entry.pathname.startsWith("/_next/static/")) {
        expect(
          entry.cacheControl.toLowerCase(),
          `Non-immutable Next asset was cached: ${entry.url}`,
        ).toContain("immutable");
      }
      expect(
        entry.contentDisposition.toLowerCase(),
        `Download response was cached: ${entry.url}`,
      ).not.toContain("attachment");
      expect(
        entry.contentType.toLowerCase(),
        `Sensitive/document response was cached: ${entry.url}`,
      ).not.toMatch(
        /application\/(?:octet-stream|pdf)|text\/(?:html|x-component)/,
      );
      expect(entry.pathname).not.toMatch(
        /^\/(?:api|login|access-status)(?:\/|$)/,
      );
      expect(entry.url).not.toContain("_rsc=");
    }
  }

  async function expectOfflineFrame(
    page: Page,
    route: string,
    rootSelector: string,
  ): Promise<Locator> {
    await expect(
      page.locator('[data-portal-offline-shell-state="offline"]'),
    ).toBeVisible();
    await expect(
      page.locator("[data-portal-shell-host-route]"),
    ).toHaveAttribute("data-portal-shell-host-route", route);
    const root = page.locator(`${rootSelector}:visible`);
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute("data-portal-page-shell-ready", "true");
    const routeContent = page.locator('[data-portal-route-content="true"]');
    await expect(routeContent).toHaveAttribute("aria-hidden", "true");
    await expect(routeContent.locator(":scope > *")).toHaveCount(0);
    await expect(page.locator(GENERIC_LOADING_SELECTOR)).toHaveCount(0);
    return root;
  }

  async function renderedPrimaryNav(page: Page, key: string): Promise<Locator> {
    const link = page.locator(`a[data-nav-key="${key}"]:visible`).first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /^\//);
    return link;
  }

  async function clickOfflineNavigation(
    page: Page,
    link: Locator,
  ): Promise<string> {
    const href = await link.getAttribute("href");
    expect(href).toBeTruthy();
    const targetUrl = new URL(href as string, page.url()).toString();
    await link.click();
    await expect(page).toHaveURL(targetUrl);
    return href as string;
  }

  async function enterOfflineMode(page: Page): Promise<void> {
    await expect(
      page.locator('[data-portal-route-content="true"] > *'),
    ).not.toHaveCount(0);
    await page.context().setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false);
  }

  async function expectExplicitReconnect(
    page: Page,
    expectedShell: Locator,
  ): Promise<void> {
    const navigationRequests: string[] = [];
    const captureRequest = (request: {
      isNavigationRequest(): boolean;
      url(): string;
    }) => {
      const url = request.url();
      if (request.isNavigationRequest()) navigationRequests.push(url);
    };
    page.on("request", captureRequest);
    const currentUrl = page.url();

    await page.context().setOffline(false);
    await expect(
      page.locator('[data-portal-offline-shell-state="reconnected"]'),
    ).toBeVisible();
    await expect(expectedShell).toBeVisible();
    await expect(page).toHaveURL(currentUrl);
    const recovery = page.getByRole("link", {
      name: "Reload live data",
      exact: true,
    });
    await expect(recovery).toBeVisible();
    await expect(recovery).toHaveAttribute(
      "href",
      `${new URL(currentUrl).pathname}${new URL(currentUrl).search}${new URL(currentUrl).hash}`,
    );
    await page.waitForTimeout(500);
    await expect(
      page.locator('[data-portal-route-content="true"] > *'),
    ).toHaveCount(0);
    await expect(expectedShell).toBeVisible();
    page.off("request", captureRequest);

    expect(
      navigationRequests,
      "Reconnect must not perform an automatic document reload.",
    ).toEqual([]);
  }

  test("keeps core navigation usable offline and stores static assets only", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1600, height: 1000 });

    const warmResult = await warmAuthenticatedPortal(page);
    requireOrSkip(warmResult.unavailable);
    expect(warmResult.workerVersion).not.toBeNull();
    const staticCacheVersion = await expectControlledStaticWorker(
      page,
      warmResult.workerVersion as string,
    );
    await expectSafeStaticCache(page, staticCacheVersion);
    await enterOfflineMode(page);

    await clickOfflineNavigation(
      page,
      await renderedPrimaryNav(page, "dashboard"),
    );
    const dashboard = await expectOfflineFrame(
      page,
      "dashboard",
      '[data-portal-page-shell="dashboard"]',
    );
    await expect(
      dashboard.locator('[data-dashboard-hero="true"]'),
    ).toBeVisible();
    await expect(
      dashboard.getByRole("region", { name: "Project portfolio", exact: true }),
    ).toBeVisible();

    await clickOfflineNavigation(
      page,
      await renderedPrimaryNav(page, "projects"),
    );
    const projects = await expectOfflineFrame(
      page,
      "projects-index",
      '[data-portal-page-shell="projects"]',
    );
    await expect(
      projects.getByRole("region", { name: "Filters", exact: true }),
    ).toBeVisible();
    await expect(
      projects.getByRole("table", { name: "Projects", exact: true }),
    ).toBeVisible();

    await clickOfflineNavigation(
      page,
      await renderedPrimaryNav(page, "contacts"),
    );
    const contacts = await expectOfflineFrame(
      page,
      "contacts-index",
      '[data-portal-page-shell="contacts"]',
    );
    await expect(
      contacts.getByRole("region", { name: "Search contacts", exact: true }),
    ).toBeVisible();
    await expect(
      contacts.getByRole("table", { name: "Contacts", exact: true }),
    ).toBeVisible();

    await clickOfflineNavigation(
      page,
      await renderedPrimaryNav(page, "schedule"),
    );
    const schedule = await expectOfflineFrame(
      page,
      "schedule",
      '[data-portal-page-shell="schedule"]',
    );
    await expect(
      schedule.getByRole("complementary", { name: "Unscheduled jobs" }),
    ).toBeVisible();
    await expect(
      schedule.getByRole("region", { name: "Installer lanes" }),
    ).toBeVisible();
    await schedule.getByRole("button", { name: "Gantt", exact: true }).click();
    await expect(schedule).toHaveAttribute("data-schedule-view", "gantt");
    await expect(page).toHaveURL(/\/schedule\?view=gantt$/);
    await schedule.getByRole("button", { name: "Board", exact: true }).click();
    await expect(schedule).toHaveAttribute("data-schedule-view", "board");
    await expect(page).toHaveURL(/\/schedule\?view=board$/);

    const sidebarPanel = page.locator('[data-portal-sidebar-panel="true"]');
    const workQueueLink = sidebarPanel.getByRole("link", {
      name: "Work Queue",
      exact: true,
    });
    if (!(await workQueueLink.isVisible().catch(() => false))) {
      await sidebarPanel
        .getByRole("button", { name: "Expand Projects", exact: true })
        .click();
    }
    await expect(workQueueLink).toBeVisible();
    await clickOfflineNavigation(page, workQueueLink);
    const workQueue = await expectOfflineFrame(
      page,
      "work-queue",
      '[data-portal-page-shell="work-queue"]',
    );
    await expect(
      workQueue.getByRole("region", { name: "Work Queue filters" }),
    ).toBeVisible();
    await expect(
      workQueue.locator('[aria-label="Project work queue"]'),
    ).toBeVisible();

    await expectSafeStaticCache(page, staticCacheVersion);
    await expectExplicitReconnect(page, workQueue);
  });

  test("opens a real project shell, local tabs and Design Workbench while offline", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1600, height: 1000 });

    const warmResult = await warmAuthenticatedPortal(page);
    requireOrSkip(warmResult.unavailable);
    expect(warmResult.workerVersion).not.toBeNull();
    const staticCacheVersion = await expectControlledStaticWorker(
      page,
      warmResult.workerVersion as string,
    );

    const projectOpenLinks = page
      .getByRole("region", { name: "Projects list", exact: true })
      .getByRole("link", { name: "Open", exact: true });
    requireOrSkip(
      (await projectOpenLinks.count()) === 0
        ? "The authenticated browser account has no project available for the offline detail check."
        : null,
    );
    const projectLink = projectOpenLinks.first();
    const projectHref = await projectLink.getAttribute("href");
    requireOrSkip(
      projectHref
        ? null
        : "The available project did not expose a canonical detail URL.",
    );
    const projectPathname = new URL(
      projectHref as string,
      page.url(),
    ).pathname.replace(/\/$/, "");
    const liveDocumentTimeOrigin = await page.evaluate(
      () => performance.timeOrigin,
    );

    await projectLink.click();
    await expect(page).toHaveURL(
      new URL(projectHref as string, page.url()).toString(),
    );
    expect(
      await page.evaluate(() => performance.timeOrigin),
      "The real Projects control must use the mounted application rather than a document reload.",
    ).toBe(liveDocumentTimeOrigin);
    const liveProject = page.locator(
      '[data-project-shell-ready="true"][data-project-snapshot-state]:visible',
    );
    await expect(liveProject).toBeVisible({ timeout: 60_000 });
    await expect(
      liveProject.locator('[data-project-active-tab="activity"]'),
    ).toBeVisible();
    requireOrSkip(
      (await liveProject.getAttribute("data-project-snapshot-state")) ===
        "unavailable"
        ? "The selected project became unavailable before the offline detail check."
        : null,
    );

    await enterOfflineMode(page);
    await liveProject
      .getByRole("tablist", { name: "Project sections", exact: true })
      .getByRole("tab", { name: "Calculator", exact: true })
      .click();
    const project = await expectOfflineFrame(
      page,
      "project-detail",
      '[data-portal-page-shell="project-detail"]',
    );
    await expect(
      project.locator('[data-project-page-frame="true"]'),
    ).toBeVisible();
    await expect(
      project.locator('[data-project-active-tab="estimates"]'),
    ).toBeVisible();
    await expect(
      project.locator(
        '[data-portal-page-shell="project-calculator"][data-portal-page-shell-ready="true"]',
      ),
    ).toBeVisible();

    const projectSections = project.getByRole("tablist", {
      name: "Project sections",
      exact: true,
    });
    await projectSections
      .getByRole("tab", { name: "Commercial", exact: true })
      .click();
    await expect(
      project.locator('[data-project-active-tab="quotes"]'),
    ).toBeVisible();
    await expect(
      project.locator(
        '[data-portal-page-shell="project-commercial"][data-portal-page-shell-ready="true"]',
      ),
    ).toBeVisible();
    await expect(
      project.locator(
        '[data-portal-page-shell="quote-list"][data-portal-page-shell-ready="true"]',
      ),
    ).toBeVisible();

    const commercialSections = project.getByRole("tablist", {
      name: "Commercial sections",
      exact: true,
    });
    await commercialSections
      .getByRole("tab", { name: "Invoices", exact: true })
      .click();
    await expect(
      project.locator('[data-project-active-tab="invoices"]'),
    ).toBeVisible();
    await expect(
      project.locator(
        '[data-portal-page-shell="invoice-list"][data-portal-page-shell-ready="true"]',
      ),
    ).toBeVisible();

    await projectSections
      .getByRole("tab", { name: "Overview", exact: true })
      .click();
    await expect(
      project.locator('[data-project-active-tab="activity"]'),
    ).toBeVisible();

    const designWorkbenchLink = project.getByRole("link", {
      name: "Design Workbench",
      exact: true,
    });
    await expect(designWorkbenchLink).toHaveAttribute(
      "href",
      `${projectPathname}/design-workbench`,
    );
    await clickOfflineNavigation(page, designWorkbenchLink);
    const workbench = await expectOfflineFrame(
      page,
      "design-workbench",
      '[data-portal-page-shell="design-workbench"]',
    );
    await expect(
      workbench.locator('[data-workbench-pending-frame="true"]'),
    ).toBeVisible();
    await expect(
      workbench.locator('[data-workbench-object-rail="true"]'),
    ).toBeVisible();
    await expect(
      workbench.locator('[data-workbench-workspace="true"]'),
    ).toBeVisible();
    await expect(
      workbench.locator('[data-workbench-inspector="true"]'),
    ).toBeVisible();

    await expectSafeStaticCache(page, staticCacheVersion);
    await expectExplicitReconnect(page, workbench);
  });
});
