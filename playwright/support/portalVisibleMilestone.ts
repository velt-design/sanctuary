import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

type PortalVisibleCondition = {
  selector: string;
  /** The existing exact heading's visible text, with accessible-name whitespace normalization. */
  text?: string;
};

export type PortalVisibleDestination = {
  pathname: string;
  conditions: PortalVisibleCondition[];
};

type VisibleCapture = {
  id: string;
  startedAt: number;
  completedAt: number | null;
  expired: boolean;
  stop: () => void;
};

declare global {
  interface Window {
    __portalVisibleDestination?: VisibleCapture;
  }
}

/** Arm before the action. Driver assertion polling must not define the DOM timestamp. */
export async function beginPortalVisibleDestination(
  page: Page,
  destination: PortalVisibleDestination,
  timeoutMs = 15_000,
): Promise<string> {
  if (!destination.conditions.length) throw new Error('A destination needs visible conditions.');
  const id = randomUUID();
  await page.evaluate(({ destination, timeoutMs, id }) => {
    window.__portalVisibleDestination?.stop();
    let frame = 0;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(capture);
    const probe: VisibleCapture = {
      id,
      startedAt: performance.now(),
      completedAt: null,
      expired: false,
      stop() {
        observer.disconnect();
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      },
    };
    window.__portalVisibleDestination = probe;

    // Use Chromium's Playwright style/box rule, with the fail-closed contents
    // exception below. Opacity and being outside the viewport do not make an
    // element hidden under that contract.
    function visible(element: Element): boolean {
      if (element.closest('[aria-hidden="true"]')) return false;
      const style = getComputedStyle(element);
      if (style.display === 'contents') {
        // Playwright's direct-text Range fallback can report boxes for CSS-hidden
        // contents. Be stricter: hidden UI must not earn destination readiness.
        // checkVisibility() itself cannot be used on a valid no-box contents owner.
        if (style.visibility !== 'visible') return false;
        for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
          const ancestorStyle = getComputedStyle(ancestor);
          if (ancestorStyle.display === 'none' || ancestorStyle.contentVisibility === 'hidden') return false;
        }
        return Array.from(element.childNodes).some((child) => {
          if (child instanceof Element) return visible(child);
          if (child.nodeType !== Node.TEXT_NODE) return false;
          const range = document.createRange();
          range.selectNode(child);
          const box = range.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        });
      }
      if (!element.checkVisibility() || style.visibility !== 'visible') return false;
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    }

    function capture() {
      if (probe.expired || probe.completedAt !== null) return;
      if (location.pathname !== destination.pathname) return;
      const allVisible = destination.conditions.every(({ selector, text }) =>
        Array.from(document.querySelectorAll(selector)).some((element) =>
          // Current PageHeader titles are plain text without name overrides or
          // element children. Fail closed if that contract changes; textContent
          // must never substitute for a different accessible heading name.
          (text === undefined || (
            !element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby') &&
            !element.children.length && element.textContent?.replace(/\s+/g, ' ').trim() === text
          )) && visible(element),
        ),
      );
      if (!allVisible) return;
      probe.completedAt = performance.now();
      probe.stop();
    }

    function onFrame() {
      capture();
      if (!probe.expired && probe.completedAt === null) frame = requestAnimationFrame(onFrame);
    }

    observer.observe(document.documentElement, { attributes: true, childList: true, characterData: true, subtree: true });
    timer = setTimeout(() => {
      probe.expired = true;
      probe.stop();
    }, timeoutMs);
    // Also see history-only changes and CSS/layout changes without a DOM mutation.
    frame = requestAnimationFrame(onFrame);
  }, { destination, timeoutMs, id });
  return id;
}

export async function retirePortalVisibleDestination(page: Page, id: string): Promise<void> {
  await page.evaluate((id) => {
    const probe = window.__portalVisibleDestination;
    if (probe?.id !== id) return;
    probe.stop();
    delete window.__portalVisibleDestination;
  }, id);
}

export async function portalVisibleDestinationMs(page: Page, id: string, timeoutMs = 15_000): Promise<number> {
  try {
    await page.waitForFunction((id) => {
      const probe = window.__portalVisibleDestination;
      return !probe || probe.id !== id || probe.expired || probe.completedAt !== null;
    }, id, { timeout: timeoutMs });
    return await page.evaluate((id) => {
      const probe = window.__portalVisibleDestination;
      if (!probe || probe.id !== id) throw new Error('Portal destination capture was replaced or retired.');
      if (probe.completedAt === null) throw new Error('Portal destination did not become simultaneously visible.');
      return Math.round(probe.completedAt - probe.startedAt);
    }, id);
  } finally {
    await retirePortalVisibleDestination(page, id);
  }
}
