import {
  expect,
  test,
  type Page,
  type Request,
  type TestInfo,
} from "@playwright/test";

import {
  expectVisiblePortalProject,
  openPortalPage,
  withPortalBrowserEvidence,
} from "./support/portalAgent";

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const EXPLICIT_NON_PRODUCTION_HOST =
  /(^|[.-])(?:dev|development|preview|qa|stage|staging|test)(?:[.-]|$)/;
const PORTAL_WEB_VITALS_PATH = "/api/staff/v1/performance/web-vitals";

interface BlockedMutation {
  method: string;
  url: string;
}

test.use({ serviceWorkers: "block" });

function requireNonProductionTarget(testInfo: TestInfo) {
  const readinessTarget =
    process.env.PORTAL_PROJECT_WORK_V2_READINESS_TARGET?.trim().toLowerCase();
  if (readinessTarget !== "staging") {
    throw new Error(
      "Read-only command-centre smoke requires PORTAL_PROJECT_WORK_V2_READINESS_TARGET=staging.",
    );
  }

  const stagingProjectRef =
    process.env.PORTAL_PROJECT_WORK_V2_STAGING_PROJECT_REF?.trim().toLowerCase();
  if (!stagingProjectRef || !/^[a-z0-9]{20}$/.test(stagingProjectRef)) {
    throw new Error(
      "Read-only command-centre smoke requires a valid PORTAL_PROJECT_WORK_V2_STAGING_PROJECT_REF.",
    );
  }

  const productionProjectRef =
    process.env.PORTAL_PRODUCTION_SUPABASE_PROJECT_REF?.trim().toLowerCase();
  if (productionProjectRef && productionProjectRef === stagingProjectRef) {
    throw new Error(
      "Read-only command-centre smoke refuses a staging Supabase ref that matches the declared production ref.",
    );
  }

  const rawBaseUrl = String(testInfo.project.use.baseURL ?? "").trim();
  if (!rawBaseUrl) {
    throw new Error(
      "Read-only command-centre smoke requires an explicit Playwright baseURL.",
    );
  }

  const baseUrl = new URL(rawBaseUrl);
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error(
      `Read-only command-centre smoke refuses unsupported baseURL protocol ${baseUrl.protocol}.`,
    );
  }
  if (baseUrl.username || baseUrl.password) {
    throw new Error(
      "Read-only command-centre smoke refuses credentials embedded in baseURL.",
    );
  }

  const hostname = baseUrl.hostname.toLowerCase();
  const isLoopback = LOOPBACK_HOSTS.has(hostname);
  const isExplicitNonProductionRemote =
    EXPLICIT_NON_PRODUCTION_HOST.test(hostname);
  if (!isLoopback && !isExplicitNonProductionRemote) {
    throw new Error(
      `Read-only command-centre smoke refuses ambiguous or production-like host ${hostname}. Use loopback or an explicitly named dev/staging/preview/qa/test host.`,
    );
  }
}

function redactRequestUrl(request: Request) {
  try {
    const url = new URL(request.url());
    return `${url.origin}${url.pathname}`;
  } catch {
    return "<unparseable request URL>";
  }
}

async function installReadOnlyRequestGuard(
  page: Page,
  blockedMutations: BlockedMutation[],
) {
  page.on("request", (request) => {
    const method = request.method().toUpperCase();
    if (!READ_ONLY_METHODS.has(method)) {
      blockedMutations.push({
        method,
        url: redactRequestUrl(request),
      });
    }
  });

  await page.route("**/*", async (route) => {
    const method = route.request().method().toUpperCase();
    if (!READ_ONLY_METHODS.has(method)) {
      await route.abort("blockedbyclient");
      return;
    }

    await route.fallback();
  });
}

async function suppressPortalWebVitalsTelemetry(page: Page) {
  await page.addInitScript((webVitalsPath) => {
    const nativeSendBeacon =
      typeof navigator.sendBeacon === "function"
        ? navigator.sendBeacon.bind(navigator)
        : null;

    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: (url: string | URL, data?: BodyInit | null) => {
        try {
          const target = new URL(String(url), window.location.href);
          if (
            target.origin === window.location.origin &&
            target.pathname === webVitalsPath
          ) {
            return true;
          }
        } catch {
          // Delegate malformed or non-standard URLs to the native implementation.
        }
        return nativeSendBeacon ? nativeSendBeacon(url, data) : false;
      },
    });
  }, PORTAL_WEB_VITALS_PATH);
}

test("authenticated Project Overview is one read-only command-centre surface", async ({
  page,
}, testInfo) => {
  requireNonProductionTarget(testInfo);

  const blockedMutations: BlockedMutation[] = [];
  await suppressPortalWebVitalsTelemetry(page);
  await installReadOnlyRequestGuard(page, blockedMutations);

  try {
    await withPortalBrowserEvidence(
      page,
      testInfo,
      { phase: "command-centre-readonly-auth" },
      async () => {
        await openPortalPage(page, "/staff/projects", { heading: "Projects" });
        await expectVisiblePortalProject(page);

        const projectHref = await page
          .locator('a[href^="/staff/projects/proj_"]')
          .first()
          .getAttribute("href");
        expect(
          projectHref,
          "Expected an RLS-visible project link.",
        ).toBeTruthy();

        const projectUrl = new URL(projectHref!, page.url());
        expect(
          projectUrl.origin,
          "Project link must remain on the tested portal origin.",
        ).toBe(new URL(page.url()).origin);
        expect(projectUrl.pathname).toMatch(
          /^\/staff\/projects\/proj_[a-zA-Z0-9_-]+$/,
        );

        await openPortalPage(page, `${projectUrl.pathname}?tab=activity`);

        const overview = page.locator('[data-project-overview-layout="true"]');
        await expect(overview).toBeVisible({ timeout: 60_000 });
        await expect(
          page.locator('[data-project-orientation="true"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-project-work-section="true"]'),
        ).toHaveCount(1);
        await expect(
          page.locator("[data-command-centre-source]"),
        ).toBeVisible();
        await expect(
          page.locator('[data-recent-notes-events="true"]'),
        ).toBeVisible();

        await expect(
          page.locator(
            '[data-overview-column="tasks"], [data-project-tasks-card="true"], [data-stage3-workstreams-slot]',
          ),
        ).toHaveCount(0);

        const prohibitedActionName = /\b(?:call|site visits?)\b/i;
        await expect(
          page.getByRole("link", { name: prohibitedActionName }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: prohibitedActionName }),
        ).toHaveCount(0);
      },
    );
  } finally {
    expect(
      blockedMutations,
      `Read-only smoke blocked application mutation request(s): ${blockedMutations
        .map(({ method, url }) => `${method} ${url}`)
        .join(", ")}`,
    ).toEqual([]);
  }
});
