import { act, type AnchorHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projects } from '../../data/projects';
import { getProjectCollectionItems } from './projectCollection';
import ProjectNavigator from './ProjectNavigator';

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
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

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
