import { act, type AnchorHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projects } from '../../data/projects';
import { getProjectCollectionItems } from './projectCollection';
import ProjectNavigator from './ProjectNavigator';
import { readCollectionReturn, saveCollectionReturn } from './projectCollectionReturn';
import type { MouseEvent as ReactMouseEvent } from 'react';

// Keep the actual controls/history logic; presentation is covered separately.
vi.mock('@/components/marketing-foundation', () => ({
  Disclosure: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  EditorialCard: ({ title, copy, href, ...props }: { title: string; copy: string; href: string } & HTMLAttributes<HTMLAnchorElement>) => <a href={href} data-project-card={props['data-project-card' as keyof typeof props]}><h2>{title}</h2><p>{copy}</p></a>,
}));
vi.mock('next/link', () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }));
vi.mock('next/navigation', () => ({ usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search) }));

let root: Root;
let host: HTMLDivElement;
const items = getProjectCollectionItems(projects);
const render = () => act(async () => root.render(<ProjectNavigator projects={items} activeProject={items[0]} collectionMode initialSearchParams="utm_source=test" />));
function select(label: string, value: string) {
  const field = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
  field.value = value;
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  window.history.replaceState({}, '', '/projects?utm_source=test');
  localStorage.clear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); readCollectionReturn(); });

function prepareReturn(link: boolean) {
  vi.stubGlobal('scrollY', 1266);
  const click = (href: string) => {
    const anchor = document.createElement('a'); anchor.href = href;
    saveCollectionReturn({ target: anchor, button: 0 } as unknown as ReactMouseEvent<HTMLElement>);
  };
  click('/projects/dairy-flat-estate');
  const originalEntry = window.history.state;
  window.history.replaceState({}, '', '/projects/dairy-flat-estate'); readCollectionReturn();
  if (link) click('/projects?utm_source=test');
  window.history.replaceState(link ? {} : originalEntry, '', '/projects?utm_source=test');
  vi.stubGlobal('scrollY', 850);
  return vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
}

describe('collection restoration ownership', () => {
  let frames: Map<number, FrameRequestCallback>;
  beforeEach(() => {
    frames = new Map();
    let nextFrame = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  });
  async function flushFrames() {
    await act(async () => {
      // Drain deferred restoration too, so the former animation-frame writer
      // cannot pass a no-scroll assertion merely because it has not fired yet.
      for (let count = 0; frames.size && count < 10; count++) {
        const batch = Array.from(frames.values()); frames.clear();
        batch.forEach(callback => callback(performance.now()));
      }
    });
    expect(frames.size).toBe(0);
  }

  it('does not replay collection coordinates over browser-entry restoration or early input', async () => {
    const scroll = prepareReturn(false);
    await render();
    await flushFrames();
    expect(scroll).not.toHaveBeenCalled();
  });

  it('restores an explicit filtered All projects link after card readiness', async () => {
    const scroll = prepareReturn(true);
    await render();
    await flushFrames();
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 1266, behavior: 'instant' });
    expect(window.location.search).toBe('?utm_source=test');
  });

  it.each(['touchstart', 'wheel', 'pointerdown', 'keydown'])('yields to %s before stored card size is ready', async type => {
    const scroll = prepareReturn(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      window.dispatchEvent(new Event(type));
      return 'compact';
    });
    await render();
    await flushFrames();
    expect(scroll).not.toHaveBeenCalled();
  });
});

describe('collection filter edits', () => {
  it('composes both edits before any render or server navigation settles', async () => {
    await render();
    const pushes = vi.spyOn(window.history, 'pushState');
    await act(async () => { select('Filter by audience', 'residential'); select('Filter by roof form', 'gable'); });
    expect(pushes.mock.calls.map(call => call[2])).toEqual(['/projects?utm_source=test&audience=residential', '/projects?utm_source=test&audience=residential&form=gable']);
    await render();
    expect(host.querySelectorAll('[data-project-card]')).toHaveLength(4);
    expect(host.textContent).toContain('4 of 15 projects');
    await act(async () => (host.querySelector('.project-navigator__filter-reset') as HTMLButtonElement).click());
    expect(window.location.search).toBe('?utm_source=test');
    await render();
    expect(host.querySelectorAll('[data-project-card]')).toHaveLength(15);
    pushes.mockRestore();
  });

  it('reads restored history and a reloaded URL instead of stale initial server props', async () => {
    window.history.replaceState({}, '', '/projects?audience=commercial&form=gable');
    await render();
    expect(host.querySelectorAll('[data-project-card]')).toHaveLength(2);
    window.history.replaceState({}, '', '/projects?audience=residential');
    await render();
    expect(host.querySelectorAll('[data-project-card]')).toHaveLength(10);
    await act(async () => root.unmount()); root = createRoot(host);
    await render();
    expect(host.querySelector<HTMLSelectElement>('[aria-label="Filter by audience"]')!.value).toBe('residential');
    expect(host.querySelector<HTMLSelectElement>('[aria-label="Filter by roof form"]')!.value).toBe('all');
  });
});
