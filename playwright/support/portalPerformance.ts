import type { Page, Request } from '@playwright/test';

type PortalPerformanceJourneyKind = 'cold-route' | 'warm-navigation' | 'interaction';

export type PortalPerformanceJourney = {
  name: string;
  kind: PortalPerformanceJourneyKind;
  feedbackMs: number;
  usefulContentMs: number;
  backgroundSettledMs?: number;
  requestCount: number;
  transferBytes: number;
  longestTaskMs: number;
  blockingOverlaySeen: boolean;
  productTargetMet: boolean;
  regressionBudgetMet: boolean;
};

export type PortalPerformanceRun = {
  schemaVersion: 2;
  capturedAt: string;
  buildId: string | null;
  journeys: PortalPerformanceJourney[];
};

type JourneyProbe = {
  startedAt: number;
  resourceStartIndex: number;
  longTaskStartIndex: number;
  requests: Request[];
  onRequest: (request: Request) => void;
};

declare global {
  interface Window {
    __portalPerformanceProbe?: {
      blockingOverlaySeen: boolean;
      longTasks: number[];
    };
  }
}

export async function installPortalPerformanceProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = {
      blockingOverlaySeen: false,
      longTasks: [] as number[],
    };
    window.__portalPerformanceProbe = state;

    const inspectBlockingOverlay = () => {
      if (document.querySelector('[aria-label="Page loading"]')) {
        state.blockingOverlaySeen = true;
      }
    };

    const attachDomObserver = () => {
      inspectBlockingOverlay();
      if (!document.documentElement) return;
      new MutationObserver(inspectBlockingOverlay).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachDomObserver, { once: true });
    } else {
      attachDomObserver();
    }

    try {
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          state.longTasks.push(entry.duration);
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // Long-task observation is best-effort and is supported by the Chromium gate.
    }
  });
}

async function browserProbeCounts(page: Page): Promise<{ resources: number; longTasks: number }> {
  return page.evaluate(() => ({
    resources: performance.getEntriesByType('resource').length,
    longTasks: window.__portalPerformanceProbe?.longTasks.length ?? 0,
  }));
}

export async function beginPortalJourney(page: Page, options?: { cold?: boolean }): Promise<JourneyProbe> {
  if (!options?.cold) {
    await page.evaluate(() => {
      if (window.__portalPerformanceProbe) {
        window.__portalPerformanceProbe.blockingOverlaySeen = false;
      }
    });
  }
  const counts = options?.cold
    ? { resources: 0, longTasks: 0 }
    : await browserProbeCounts(page);
  const requests: Request[] = [];
  const onRequest = (request: Request) => requests.push(request);
  page.on('request', onRequest);
  return {
    startedAt: Date.now(),
    resourceStartIndex: counts.resources,
    longTaskStartIndex: counts.longTasks,
    requests,
    onRequest,
  };
}

export function elapsedJourneyMs(probe: JourneyProbe): number {
  return Date.now() - probe.startedAt;
}

export async function waitForBackgroundSettled(page: Page, probe: JourneyProbe): Promise<number> {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  return elapsedJourneyMs(probe);
}

export async function finishPortalJourney(
  page: Page,
  probe: JourneyProbe,
  input: Omit<PortalPerformanceJourney, 'requestCount' | 'transferBytes' | 'longestTaskMs' | 'blockingOverlaySeen'>,
): Promise<PortalPerformanceJourney> {
  page.off('request', probe.onRequest);
  const currentOrigin = new URL(page.url()).origin;
  const requestCount = probe.requests.filter((request) => {
    try {
      return new URL(request.url()).origin === currentOrigin;
    } catch {
      return false;
    }
  }).length;

  const browserMetrics = await page.evaluate(
    ({ resourceStartIndex, longTaskStartIndex, currentOrigin }) => {
      const resources = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .slice(resourceStartIndex)
        .filter((entry) => {
          try {
            return new URL(entry.name).origin === currentOrigin;
          } catch {
            return false;
          }
        });
      const longTasks = (window.__portalPerformanceProbe?.longTasks ?? []).slice(longTaskStartIndex);
      return {
        transferBytes: resources.reduce((sum, entry) => sum + Math.max(0, entry.transferSize || 0), 0),
        longestTaskMs: longTasks.length ? Math.max(...longTasks) : 0,
        blockingOverlaySeen: window.__portalPerformanceProbe?.blockingOverlaySeen ?? false,
      };
    },
    {
      resourceStartIndex: probe.resourceStartIndex,
      longTaskStartIndex: probe.longTaskStartIndex,
      currentOrigin,
    },
  );

  return {
    ...input,
    requestCount,
    transferBytes: browserMetrics.transferBytes,
    longestTaskMs: Number(browserMetrics.longestTaskMs.toFixed(1)),
    blockingOverlaySeen: browserMetrics.blockingOverlaySeen,
  };
}

export function portalPerformanceBuildId(): string | null {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    process.env.NEXT_PUBLIC_BUILD_ID?.trim() ||
    null
  );
}
