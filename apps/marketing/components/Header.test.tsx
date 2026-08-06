import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildEnquiryHref,
  getEnquiryRouteContext,
} from '../lib/enquiryContext';
import Header from './Header';

let currentPathname = '/projects';
let root: Root | null = null;
let container: HTMLDivElement | null = null;
let mediaListeners: Array<(event: MediaQueryListEvent) => void> = [];

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}));

beforeAll(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  currentPathname = '/projects';
  window.history.replaceState({}, '', '/');
  mediaListeners = [];
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: 320,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(min-width: 901px)' ? false : true,
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        mediaListeners.push(listener);
      },
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        mediaListeners = mediaListeners.filter((candidate) => candidate !== listener);
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    })),
  });
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
  });
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  container = null;
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
  document.body.className = '';
  vi.restoreAllMocks();
});

async function renderHeader() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<Header />));
}

async function openMenu() {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-controls="mobile-menu"]');
  expect(trigger).not.toBeNull();
  await act(async () => trigger?.click());
  return trigger!;
}

async function pressKey(key: string, shiftKey = false) {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key,
      shiftKey,
    }));
  });
}

describe('shared mobile header interaction', () => {
  it('uses the canonical homepage route during a production static root render', async () => {
    currentPathname = '/index';
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
    });
    await renderHeader();

    const header = document.querySelector<HTMLElement>('header.site');
    const desktopCta = header?.querySelector<HTMLAnchorElement>('.nav-cta');
    const brandLink = header?.querySelector<HTMLAnchorElement>('.site-brand');
    const activePrimaryLink = header?.querySelector<HTMLAnchorElement>(
      'nav[aria-label="Primary"] a[aria-current="page"]',
    );

    expect(header?.getAttribute('data-hero-navigation')).toBe('overlay');
    expect(brandLink?.getAttribute('href')).toBe('/');
    expect(activePrimaryLink).toBeNull();
    expect(desktopCta).toBeNull();
  });

  it('balances the four desktop links around the viewport centre', async () => {
    await renderHeader();

    const linkLabels = (selector: string) => Array.from(
      document.querySelectorAll<HTMLAnchorElement>(selector),
      (link) => link.textContent?.trim(),
    );

    expect(linkLabels('.nav-list__cluster--left a')).toEqual([
      'Projects',
      'Products',
    ]);
    expect(linkLabels('.nav-list__cluster--right a')).toEqual([
      'Commercial',
      'Professionals',
    ]);
  });

  it('removes only the guided route desktop CTA and keeps the mobile action', async () => {
    currentPathname = '/home-guided';
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
    });
    await renderHeader();

    expect(document.querySelector('header.site .nav-cta')).toBeNull();
    expect(document.querySelector('header.site')?.getAttribute('data-hero-navigation'))
      .toBe('overlay');

    await openMenu();
    expect(document.querySelector<HTMLAnchorElement>(
      '#mobile-menu .mobile-menu__link--estimate',
    )?.textContent).toContain('Start your project');
  });

  it('uses governed audience, project and product context for the global enquiry action', async () => {
    currentPathname = '/architects-designers-builders';
    await renderHeader();

    const desktopCta = document.querySelector<HTMLAnchorElement>('header.site .nav-cta');
    expect(desktopCta?.getAttribute('href')).toBe(buildEnquiryHref({
      enquiryType: 'professional',
      sourcePath: currentPathname,
      sourceComponent: 'header',
    }));
    expect(desktopCta?.getAttribute('data-enquiry-type')).toBe('professional');

    currentPathname = '/projects/goodhome-commercial-terrace';
    await act(async () => root?.render(<Header />));

    expect(desktopCta?.getAttribute('href')).toBe(buildEnquiryHref({
      ...getEnquiryRouteContext(currentPathname),
      sourcePath: currentPathname,
      sourceComponent: 'header',
    }));

    currentPathname = '/products/pergolas/gable';
    await act(async () => root?.render(<Header />));

    expect(desktopCta?.getAttribute('href')).toBe(buildEnquiryHref({
      ...getEnquiryRouteContext(currentPathname),
      sourcePath: currentPathname,
      sourceComponent: 'header',
    }));
  });

  it('preserves a project finder brief in service-page enquiry actions', async () => {
    currentPathname = '/outdoor-rooms-auckland';
    window.history.replaceState(
      {},
      '',
      '/outdoor-rooms-auckland?project=outdoor-room&priorities=daylight,everyday-use',
    );
    await renderHeader();

    const desktopCta = document.querySelector<HTMLAnchorElement>('header.site .nav-cta');
    expect(desktopCta?.getAttribute('href')).toBe(buildEnquiryHref({
      enquiryType: 'residential',
      sourcePath: currentPathname,
      sourceComponent: 'header',
      sourceExperience: 'project-finder-home-v1',
      projectDirection: 'outdoor-room',
      projectPriorities: ['daylight', 'everyday-use'],
    }));
  });

  it('preserves a completed professional path only on its matching destination', async () => {
    currentPathname = '/architects-designers-builders';
    window.history.replaceState(
      {},
      '',
      '/architects-designers-builders?project=commercial-professional&professional_path=architects-designers',
    );
    await renderHeader();

    const desktopCta = document.querySelector<HTMLAnchorElement>('header.site .nav-cta');
    expect(desktopCta?.getAttribute('href')).toBe(buildEnquiryHref({
      enquiryType: 'professional',
      sourcePath: currentPathname,
      sourceComponent: 'header',
      sourceExperience: 'project-finder-home-v1',
      projectDirection: 'commercial-professional',
      projectProfessionalPath: 'architects-designers',
    }));

    window.history.replaceState(
      {},
      '',
      '/architects-designers-builders?project=commercial-professional',
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
    await act(async () => undefined);

    expect(desktopCta?.getAttribute('href')).toBe(buildEnquiryHref({
      ...getEnquiryRouteContext(currentPathname),
      sourcePath: currentPathname,
      sourceComponent: 'header',
    }));
  });

  it('preserves a finder brief and viewed project in project-page enquiry actions', async () => {
    currentPathname = '/projects/warkworth-outdoor-room';
    window.history.replaceState(
      {},
      '',
      '/projects/warkworth-outdoor-room?project=outdoor-room&priorities=daylight,everyday-use&reference=warkworth-outdoor-room',
    );
    await renderHeader();

    const desktopCta = document.querySelector<HTMLAnchorElement>('header.site .nav-cta');
    expect(desktopCta?.getAttribute('href')).toBe(buildEnquiryHref({
      enquiryType: 'residential',
      sourcePath: currentPathname,
      sourceComponent: 'header',
      sourceProject: 'warkworth-outdoor-room',
      sourceExperience: 'project-finder-home-v1',
      projectDirection: 'outdoor-room',
      projectPriorities: ['daylight', 'everyday-use'],
    }));
  });

  it('opens one accessible menu tree, moves focus and reversibly locks page scroll', async () => {
    await renderHeader();
    const menu = document.querySelector<HTMLDivElement>('#mobile-menu');
    expect(menu).not.toBeNull();
    expect(menu?.getAttribute('aria-hidden')).toBe('true');
    expect(menu?.hasAttribute('inert')).toBe(true);

    const trigger = await openMenu();
    const links = Array.from(menu!.querySelectorAll<HTMLAnchorElement>('a'));

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(menu?.getAttribute('aria-hidden')).toBe('false');
    expect(menu?.hasAttribute('inert')).toBe(false);
    expect(links.map((link) => link.textContent)).toEqual([
      'Projects',
      'Pergola options',
      'Commercial',
      'Professionals',
      'Start your project',
    ]);
    expect(document.activeElement).toBe(links[0]);
    expect(document.body.classList.contains('no-scroll')).toBe(true);
    expect(document.body.classList.contains('mobile-menu-open')).toBe(true);
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-320px');

    await pressKey('Escape');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(menu?.getAttribute('aria-hidden')).toBe('true');
    expect(menu?.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect(document.body.classList.contains('no-scroll')).toBe(false);
    expect(document.body.style.position).toBe('');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 320);
  });

  it('closes from the page backdrop without moving focus or losing scroll position', async () => {
    await renderHeader();
    const trigger = await openMenu();
    const menu = document.querySelector<HTMLDivElement>('#mobile-menu');
    const backdrop = document.querySelector<HTMLDivElement>(
      '[data-mobile-menu-backdrop]',
    );

    expect(menu?.getAttribute('role')).toBe('dialog');
    expect(menu?.getAttribute('aria-modal')).toBe('true');
    expect(backdrop?.getAttribute('data-mobile-menu-backdrop-state')).toBe('open');

    await act(async () => backdrop?.click());

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(menu?.getAttribute('aria-hidden')).toBe('true');
    expect(menu?.hasAttribute('aria-modal')).toBe(false);
    expect(backdrop?.getAttribute('data-mobile-menu-backdrop-state')).toBe('closed');
    expect(document.body.classList.contains('no-scroll')).toBe(false);
    expect(document.body.classList.contains('mobile-menu-open')).toBe(false);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 320);
  });

  it('cycles Tab and Shift+Tab through the trigger and every menu destination', async () => {
    await renderHeader();
    const trigger = await openMenu();
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('#mobile-menu a'),
    );

    expect(document.activeElement).toBe(links[0]);
    await pressKey('Tab', true);
    expect(document.activeElement).toBe(trigger);
    await pressKey('Tab', true);
    expect(document.activeElement).toBe(links.at(-1));
    await pressKey('Tab');
    expect(document.activeElement).toBe(trigger);
    await pressKey('Tab');
    expect(document.activeElement).toBe(links[0]);

    await pressKey('Escape');
  });

  it('captures touch scroll position before fixed-body styles can reset the viewport', async () => {
    await renderHeader();
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-controls="mobile-menu"]');
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
    });
    await act(async () => trigger?.click());

    expect(document.body.style.top).toBe('-320px');
    await pressKey('Escape');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 320);
  });

  it('closes without restoring the departed page scroll when browser history changes', async () => {
    await renderHeader();
    const trigger = await openMenu();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.classList.contains('no-scroll')).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('closes at the same 901px breakpoint used by the responsive CSS', async () => {
    await renderHeader();
    const trigger = await openMenu();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await act(async () => {
      for (const listener of mediaListeners) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.classList.contains('no-scroll')).toBe(false);
  });

  it('closes a stale open menu when the current route changes', async () => {
    await renderHeader();
    const trigger = await openMenu();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    currentPathname = '/products/pergolas/pitched';
    await act(async () => root?.render(<Header />));

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.classList.contains('no-scroll')).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
