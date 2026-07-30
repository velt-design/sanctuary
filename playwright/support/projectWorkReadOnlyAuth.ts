import {
  expect,
  type Page,
  type Request,
  type TestInfo,
} from "@playwright/test";

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const EXPLICIT_NON_PRODUCTION_HOST =
  /(^|[.-])(?:dev|development|preview|qa|stage|staging|test)(?:[.-]|$)/;
const PORTAL_WEB_VITALS_PATH = "/api/staff/v1/performance/web-vitals";

export interface BlockedProjectWorkMutation {
  method: string;
  url: string;
}

export function requireProjectWorkReadOnlyTarget(testInfo: TestInfo) {
  const readinessTarget =
    process.env.PORTAL_PROJECT_WORK_V2_READINESS_TARGET?.trim().toLowerCase();
  if (readinessTarget !== "staging") {
    throw new Error(
      "Read-only Project Work smoke requires PORTAL_PROJECT_WORK_V2_READINESS_TARGET=staging.",
    );
  }

  const stagingProjectRef =
    process.env.PORTAL_PROJECT_WORK_V2_STAGING_PROJECT_REF?.trim().toLowerCase();
  if (!stagingProjectRef || !/^[a-z0-9]{20}$/.test(stagingProjectRef)) {
    throw new Error(
      "Read-only Project Work smoke requires a valid PORTAL_PROJECT_WORK_V2_STAGING_PROJECT_REF.",
    );
  }

  const productionProjectRef =
    process.env.PORTAL_PRODUCTION_SUPABASE_PROJECT_REF?.trim().toLowerCase();
  if (productionProjectRef && productionProjectRef === stagingProjectRef) {
    throw new Error(
      "Read-only Project Work smoke refuses a staging Supabase ref that matches the declared production ref.",
    );
  }

  const rawBaseUrl = String(testInfo.project.use.baseURL ?? "").trim();
  if (!rawBaseUrl) {
    throw new Error(
      "Read-only Project Work smoke requires an explicit Playwright baseURL.",
    );
  }

  const baseUrl = new URL(rawBaseUrl);
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error(
      `Read-only Project Work smoke refuses unsupported baseURL protocol ${baseUrl.protocol}.`,
    );
  }
  if (baseUrl.username || baseUrl.password) {
    throw new Error(
      "Read-only Project Work smoke refuses credentials embedded in baseURL.",
    );
  }

  const hostname = baseUrl.hostname.toLowerCase();
  const isLoopback = LOOPBACK_HOSTS.has(hostname);
  const isExplicitNonProductionRemote =
    EXPLICIT_NON_PRODUCTION_HOST.test(hostname);
  if (!isLoopback && !isExplicitNonProductionRemote) {
    throw new Error(
      `Read-only Project Work smoke refuses ambiguous or production-like host ${hostname}. Use loopback or an explicitly named dev/staging/preview/qa/test host.`,
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

export async function installProjectWorkReadOnlyRequestGuard(
  page: Page,
  blockedMutations: BlockedProjectWorkMutation[],
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

export async function suppressProjectWorkWebVitalsTelemetry(page: Page) {
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

export function expectNoProjectWorkMutationRequests(
  blockedMutations: BlockedProjectWorkMutation[],
) {
  expect(
    blockedMutations,
    `Read-only smoke blocked application mutation request(s): ${blockedMutations
      .map(({ method, url }) => `${method} ${url}`)
      .join(", ")}`,
  ).toEqual([]);
}
