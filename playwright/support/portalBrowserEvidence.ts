import type { Page, TestInfo } from '@playwright/test';

export type PortalEvidenceMode = 'default' | 'full';

export interface PortalBrowserEvidence {
  consoleMessages: Array<{ type: string; text: string }>;
  failedRequests: Array<{ method: string; url: string; failureText: string | null }>;
  responseFailures: Array<{ method: string; url: string; status: number; statusText: string }>;
  pageErrors: string[];
}

export interface PortalBrowserEvidenceContext {
  routeId?: string;
  route?: string;
  scenarioId?: string;
  pageId?: string;
  fixtureSlug?: string;
  phase?: string;
  label?: string;
}

export interface AttachPortalBrowserEvidenceOptions {
  forceRich?: boolean;
  maxDomSnapshotLength?: number;
}

const DEFAULT_DOM_SNAPSHOT_LIMIT = 200_000;
const SENSITIVE_QUERY_KEYS = /(?:password|token|secret|service[_-]?role|apikey|api[_-]?key|access[_-]?token|refresh[_-]?token)/i;
const SENSITIVE_TEXT_PATTERN =
  /((?:password|token|secret|service[_-]?role|apikey|api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*)([^&\s"']+)/gi;

export function resolvePortalEvidenceMode(env: NodeJS.ProcessEnv = process.env): PortalEvidenceMode {
  return env.PORTAL_EVIDENCE_MODE === 'full' ? 'full' : 'default';
}

export function shouldAttachRichPortalEvidence(
  testInfo?: Pick<TestInfo, 'status' | 'expectedStatus'>,
  forceRich = false,
): boolean {
  if (forceRich) return true;
  if (resolvePortalEvidenceMode() === 'full') return true;
  if (testInfo?.status && testInfo.expectedStatus && testInfo.status !== testInfo.expectedStatus) {
    return true;
  }
  return false;
}

export function redactSensitiveText(value: string): string {
  let redacted = value;
  const secretValues = [
    process.env.PORTAL_TEST_PASSWORD,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_ANON_KEY,
  ].filter((secret): secret is string => Boolean(secret && secret.length >= 4));

  for (const secret of secretValues) {
    redacted = redacted.split(secret).join('[REDACTED]');
  }

  return redacted.replace(SENSITIVE_TEXT_PATTERN, '$1[REDACTED]');
}

export function sanitizeUrlForEvidence(value: string): string {
  try {
    const url = new URL(value);
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEYS.test(key)) {
        url.searchParams.set(key, '[REDACTED]');
      }
    }
    return redactSensitiveText(url.toString());
  } catch {
    return redactSensitiveText(value);
  }
}

export function redactEvidenceValue(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map((item) => redactEvidenceValue(item));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_QUERY_KEYS.test(key) ? '[REDACTED]' : redactEvidenceValue(entry),
    ]),
  );
}

export function installPortalBrowserEvidence(page: Page): PortalBrowserEvidence {
  const evidence: PortalBrowserEvidence = {
    consoleMessages: [],
    failedRequests: [],
    responseFailures: [],
    pageErrors: [],
  };

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      evidence.consoleMessages.push({
        type: message.type(),
        text: redactSensitiveText(message.text()),
      });
    }
  });

  page.on('pageerror', (error) => {
    evidence.pageErrors.push(redactSensitiveText(error.stack ?? error.message));
  });

  page.on('requestfailed', (request) => {
    evidence.failedRequests.push({
      method: request.method(),
      url: sanitizeUrlForEvidence(request.url()),
      failureText: request.failure()?.errorText ? redactSensitiveText(request.failure()?.errorText ?? '') : null,
    });
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;

    const request = response.request();
    evidence.responseFailures.push({
      method: request.method(),
      url: sanitizeUrlForEvidence(response.url()),
      status,
      statusText: response.statusText(),
    });
  });

  return evidence;
}

export async function readPortalPageDebugExportForEvidence(page: Page): Promise<unknown | null> {
  const locator = page.locator('[data-portal-debug-export="true"]').first();
  if ((await locator.count()) === 0) return null;

  const raw = await locator.textContent();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return {
      invalidDebugExport: true,
      parseError: redactSensitiveText(String(error)),
      rawPreview: redactSensitiveText(raw.slice(0, 1_000)),
    };
  }
}

export async function attachPortalBrowserEvidence(
  testInfo: TestInfo,
  page: Page,
  evidence: PortalBrowserEvidence,
  context: PortalBrowserEvidenceContext = {},
  options: AttachPortalBrowserEvidenceOptions = {},
) {
  const rich = shouldAttachRichPortalEvidence(testInfo, options.forceRich);
  const debugExport = await readPortalPageDebugExportForEvidence(page).catch(() => null);

  const payload = redactEvidenceValue({
    context,
    currentUrl: sanitizeUrlForEvidence(page.url()),
    title: await page.title().catch(() => null),
    viewport: page.viewportSize(),
    evidenceMode: resolvePortalEvidenceMode(),
    richEvidenceAttached: rich,
    debugExportAvailable: Boolean(debugExport),
    consoleMessages: evidence.consoleMessages,
    failedRequests: evidence.failedRequests,
    responseFailures: evidence.responseFailures,
    pageErrors: evidence.pageErrors,
  });

  await testInfo.attach('portal-browser-evidence.json', {
    body: JSON.stringify(payload, null, 2),
    contentType: 'application/json',
  });

  if (debugExport) {
    await testInfo.attach('portal-debug-export.json', {
      body: JSON.stringify(redactEvidenceValue(debugExport), null, 2),
      contentType: 'application/json',
    });
  }

  if (!rich) return;

  const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
  if (screenshot) {
    await testInfo.attach('portal-page-screenshot.png', {
      body: screenshot,
      contentType: 'image/png',
    });
  }

  const maxDomLength = options.maxDomSnapshotLength ?? DEFAULT_DOM_SNAPSHOT_LIMIT;
  const domSnapshot = await page
    .evaluate((limit) => document.documentElement.outerHTML.slice(0, limit), maxDomLength)
    .catch(() => null);
  if (domSnapshot) {
    await testInfo.attach('portal-dom-snapshot.html', {
      body: redactSensitiveText(domSnapshot),
      contentType: 'text/html',
    });
  }
}

export async function withPortalBrowserEvidence<T>(
  page: Page,
  testInfo: TestInfo,
  context: PortalBrowserEvidenceContext,
  run: (evidence: PortalBrowserEvidence) => Promise<T>,
): Promise<T> {
  const evidence = installPortalBrowserEvidence(page);
  let failed = false;

  try {
    return await run(evidence);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    await attachPortalBrowserEvidence(testInfo, page, evidence, context, { forceRich: failed });
  }
}
