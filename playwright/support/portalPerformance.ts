import type { Locator, Page, Request } from "@playwright/test";

type PortalPerformanceJourneyKind =
  "cold-route" | "warm-navigation" | "interaction";

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

export function assertResponsivePortalJourneyHasNoBlockingOverlay(
  journey: Pick<PortalPerformanceJourney, 'name' | 'kind' | 'blockingOverlaySeen'>,
): void {
  if (!journey.blockingOverlaySeen) return;
  throw new Error(
    `${journey.name} (${journey.kind}) showed a blocking or generic loading overlay during a responsive journey.`,
  );
}

type JourneyProbe = {
  startedAt: number;
  resourceStartIndex: number;
  longTaskStartIndex: number;
  requests: Request[];
  onRequest: (request: Request) => void;
};

export type PortalFinalFrameCapture = {
  name: string;
  page: Page;
  selector: string;
  token: string;
};

type PortalVisualFeedbackState = "visible" | "hidden" | "checked" | "disabled";

type PortalVisualFeedbackCondition = {
  selector: string;
  state: PortalVisualFeedbackState;
};

declare global {
  interface Window {
    __portalPerformanceProbe?: {
      blockingOverlaySeen: boolean;
      longTasks: number[];
    };
    __portalVisualFeedbackProbe?: {
      startedAt: number;
      completedAt: number | null;
      observer?: MutationObserver;
    };
    __portalFinalFrameContinuity?: Record<
      string,
      {
        broken: boolean;
        observer: MutationObserver;
        selector: string;
      }
    >;
    __portalIdleRevisitProbe?: {
      broken: boolean;
      observer: MutationObserver;
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

    const blockingOverlaySelectors = [
      '[aria-label="Page loading"]',
      "[data-portal-instant-shell]",
      '[data-ui-foundation-consumer="blueprint-loading"]',
      '[data-ui-foundation-consumer="projects-pending"]',
      '[data-ui-foundation-consumer="contacts-pending"]',
    ];
    const inspectBlockingOverlay = () => {
      const blockingOverlay = blockingOverlaySelectors
        .flatMap((selector) =>
          Array.from(document.querySelectorAll<HTMLElement>(selector)),
        )
        .find((element) => {
          const style = getComputedStyle(element);
          return (
            !element.hidden &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          );
        });
      if (blockingOverlay) state.blockingOverlaySeen = true;
    };

    const attachDomObserver = () => {
      inspectBlockingOverlay();
      if (!document.documentElement) return;
      new MutationObserver(inspectBlockingOverlay).observe(
        document.documentElement,
        {
          attributes: true,
          childList: true,
          subtree: true,
        },
      );
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", attachDomObserver, {
        once: true,
      });
    } else {
      attachDomObserver();
    }

    try {
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          state.longTasks.push(entry.duration);
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Long-task observation is best-effort and is supported by the Chromium gate.
    }
  });
}

export async function capturePortalFinalFrame(
  locator: Locator,
  name: string,
  continuitySelector: string,
  timeoutMs = 60_000,
): Promise<PortalFinalFrameCapture> {
  await locator.waitFor({ state: "visible", timeout: timeoutMs });
  const page = locator.page();
  const token = `portal-frame-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await page.evaluate(
    ({ captureToken, selector }) => {
      const isVisible = () =>
        Array.from(document.querySelectorAll<HTMLElement>(selector)).some(
          (element) => {
            const style = getComputedStyle(element);
            return (
              !element.hidden &&
              style.display !== "none" &&
              style.visibility !== "hidden"
            );
          },
        );
      const captures = window.__portalFinalFrameContinuity ?? {};
      const observer = new MutationObserver(() => {
        const current = captures[captureToken];
        if (current && !isVisible()) current.broken = true;
      });
      captures[captureToken] = { broken: !isVisible(), observer, selector };
      window.__portalFinalFrameContinuity = captures;
      observer.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    },
    { captureToken: token, selector: continuitySelector },
  );
  return { name, page, selector: continuitySelector, token };
}

export async function assertPortalFinalFrameContinuity(
  capture: PortalFinalFrameCapture,
): Promise<void> {
  const state = await capture.page
    .evaluate(
      ({ captureToken, selector }) => {
        const captures = window.__portalFinalFrameContinuity;
        const current = captures?.[captureToken];
        current?.observer.disconnect();
        if (captures) delete captures[captureToken];
        const visible = Array.from(
          document.querySelectorAll<HTMLElement>(selector),
        ).some((element) => {
          const style = getComputedStyle(element);
          return (
            !element.hidden &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          );
        });
        return { broken: current?.broken ?? true, visible };
      },
      { captureToken: capture.token, selector: capture.selector },
    )
    .catch(() => ({ broken: true, visible: false }));
  if (state.broken || !state.visible) {
    throw new Error(
      `${capture.name} hid its usable UI frame while background values settled.`,
    );
  }
}

async function browserProbeCounts(
  page: Page,
): Promise<{ resources: number; longTasks: number }> {
  return page.evaluate(() => ({
    resources: performance.getEntriesByType("resource").length,
    longTasks: window.__portalPerformanceProbe?.longTasks.length ?? 0,
  }));
}

export async function beginPortalJourney(
  page: Page,
  options?: { cold?: boolean },
): Promise<JourneyProbe> {
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
  page.on("request", onRequest);
  return {
    startedAt: Date.now(),
    resourceStartIndex: counts.resources,
    longTaskStartIndex: counts.longTasks,
    requests,
    onRequest,
  };
}

export async function beginPortalVisualFeedback(
  page: Page,
  condition: PortalVisualFeedbackCondition,
): Promise<void> {
  await page.evaluate(({ selector, state }) => {
    window.__portalVisualFeedbackProbe?.observer?.disconnect();
    const probe = {
      startedAt: performance.now(),
      completedAt: null as number | null,
      observer: undefined as MutationObserver | undefined,
    };
    window.__portalVisualFeedbackProbe = probe;

    const conditionMet = () => {
      const element = document.querySelector(selector);
      if (state === "hidden") return !element;
      if (!(element instanceof HTMLElement)) return false;
      if (state === "checked")
        return element instanceof HTMLInputElement && element.checked;
      if (state === "disabled") {
        return (
          (element instanceof HTMLButtonElement ||
            element instanceof HTMLInputElement) &&
          element.disabled
        );
      }
      const style = getComputedStyle(element);
      return (
        !element.hidden &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    };

    const captureFeedback = () => {
      if (probe.completedAt !== null || !conditionMet()) return;
      probe.completedAt = performance.now();
      probe.observer?.disconnect();
    };
    probe.observer = new MutationObserver(captureFeedback);
    probe.observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    requestAnimationFrame(captureFeedback);
  }, condition);
}

export async function portalVisualFeedbackMs(
  page: Page,
  timeoutMs = 5_000,
): Promise<number> {
  await page.waitForFunction(
    () => window.__portalVisualFeedbackProbe?.completedAt !== null,
    undefined,
    { timeout: timeoutMs },
  );
  return page.evaluate(() => {
    const probe = window.__portalVisualFeedbackProbe;
    if (!probe || probe.completedAt === null)
      throw new Error("Portal visual feedback was not captured.");
    return Math.round(probe.completedAt - probe.startedAt);
  });
}

export function elapsedJourneyMs(probe: JourneyProbe): number {
  return Date.now() - probe.startedAt;
}

export async function waitForBackgroundSettled(
  page: Page,
  probe: JourneyProbe,
): Promise<number> {
  await page
    .waitForLoadState("networkidle", { timeout: 5_000 })
    .catch(() => undefined);
  return elapsedJourneyMs(probe);
}

export async function finishPortalJourney(
  page: Page,
  probe: JourneyProbe,
  input: Omit<
    PortalPerformanceJourney,
    "requestCount" | "transferBytes" | "longestTaskMs" | "blockingOverlaySeen"
  >,
): Promise<PortalPerformanceJourney> {
  page.off("request", probe.onRequest);
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
      const resources = (
        performance.getEntriesByType("resource") as PerformanceResourceTiming[]
      )
        .slice(resourceStartIndex)
        .filter((entry) => {
          try {
            return new URL(entry.name).origin === currentOrigin;
          } catch {
            return false;
          }
        });
      const longTasks = (
        window.__portalPerformanceProbe?.longTasks ?? []
      ).slice(longTaskStartIndex);
      return {
        transferBytes: resources.reduce(
          (sum, entry) => sum + Math.max(0, entry.transferSize || 0),
          0,
        ),
        longestTaskMs: longTasks.length ? Math.max(...longTasks) : 0,
        blockingOverlaySeen:
          window.__portalPerformanceProbe?.blockingOverlaySeen ?? false,
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
