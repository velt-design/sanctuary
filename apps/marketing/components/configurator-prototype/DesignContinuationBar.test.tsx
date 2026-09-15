import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import DesignContinuationBar from './DesignContinuationBar';
import { updateDesignContinuation, readDesignContinuation } from './designContinuation';

let path = '/';
vi.mock('next/navigation', () => ({ usePathname: () => path }));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let openingBottom = 500;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  path = '/products'; openingBottom = 500;
  updateDesignContinuation({ started: false, dismissed: false, section: 'structure' });
  host = document.createElement('div'); document.body.append(host);
  const hero = document.createElement('section'); hero.dataset.homepageHero = '';
  hero.getBoundingClientRect = () => ({ bottom: openingBottom } as DOMRect);
  host.append(hero);
  const mount = document.createElement('div'); host.append(mount); root = createRoot(mount);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = () => act(async () => root.render(<DesignContinuationBar />));
const scroll = (bottom: number) => act(async () => { openingBottom = bottom; window.dispatchEvent(new Event('scroll')); });

it('appears beyond other pages opening sections and hides on return', async () => {
  path = '/products';
  await render(); expect(host.querySelector('aside')).toBeNull();
  await scroll(-1); expect(host.textContent).toContain('Start designing');
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/configurator-preview?open=1');
  await scroll(10); expect(host.querySelector('aside')).toBeNull();
});

it('offers the saved-design destination after editing and remembers dismissal', async () => {
  await render(); await scroll(-1);
  await act(async () => updateDesignContinuation({ started: true, section: 'roof' }));
  expect(host.textContent).toContain('Continue designing');
  expect(host.querySelector('a')?.getAttribute('href')).toContain('resume=1');
  await act(async () => (host.querySelector('button') as HTMLButtonElement).click());
  expect(host.querySelector('aside')).toBeNull();
  expect(readDesignContinuation()).toEqual({ started: true, dismissed: true, section: 'roof' });
});

it('does not compete with enquiry or private transaction pages', async () => {
  for (const route of ['/design-enquiry', '/contact', '/quote/example', '/invoice/example']) {
    path = route; await render(); await scroll(-1); expect(host.querySelector('aside')).toBeNull();
  }
});

 it('shows on the homepage after a short scroll while the hero remains visible', async () => {
  path = '/'; vi.stubGlobal('scrollY', 0); await render();
  expect(host.querySelector('aside')).toBeNull();
  vi.stubGlobal('scrollY', 120); await scroll(600);
  expect(host.textContent).toContain('Start designing');
  vi.stubGlobal('scrollY', 0); await scroll(720);
  expect(host.querySelector('aside')).toBeNull();
});
