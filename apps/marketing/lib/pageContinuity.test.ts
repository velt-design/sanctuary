import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPageContinuity } from './pageContinuity';
import { buildProjectDetailHistoryState } from './projectDetailNavigation';

let owner: ReturnType<typeof createPageContinuity> | undefined;
let y = 0;
beforeEach(() => {
  sessionStorage.clear(); window.history.replaceState({}, '', '/'); document.body.innerHTML = '<main class="two-col-page"></main>';
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y });
  vi.spyOn(window, 'scrollTo').mockImplementation((options: unknown) => { y = typeof options === 'object' ? (options as ScrollToOptions).top ?? y : 0; });
  y = 0; owner = createPageContinuity(); owner.commit();
});
afterEach(() => { owner?.dispose(); document.body.innerHTML = ''; document.body.removeAttribute('style'); document.body.scrollTop = 0; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function capture(top: number, nested = 0) {
  y = top; document.querySelector<HTMLElement>('.two-col-page')!.scrollTop = nested;
  document.dispatchEvent(new Event('scroll'));
}
function push(path: string) { window.history.pushState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: 'retained' }, '', path); owner!.commit(); }
const browserReplace = window.history.replaceState;
function traverse(state: unknown, path: string) { browserReplace.call(window.history, state, '', path); window.dispatchEvent(new PopStateEvent('popstate', { state })); owner!.commit(); }

it('keeps independent snapshots for repeated URLs, native history state and nested scrollers', () => {
  capture(1440, 320); const first = window.history.state;
  push('/projects'); capture(850, 140); const projects = window.history.state;
  push('/'); expect(y).toBe(0); capture(650, 80); const second = window.history.state;
  expect(first.__sanctuaryPageEntry).not.toBe(second.__sanctuaryPageEntry);
  traverse(projects, '/projects'); expect(y).toBe(850); expect(document.querySelector<HTMLElement>('.two-col-page')!.scrollTop).toBe(140);
  traverse(first, '/'); expect(y).toBe(1440); expect(document.querySelector<HTMLElement>('.two-col-page')!.scrollTop).toBe(320);
  traverse(second, '/'); expect(y).toBe(650);
  expect(projects.__PRIVATE_NEXTJS_INTERNALS_TREE).toBe('retained');
});

it('owns native restoration only while mounted and restores the previous policy on disposal', () => {
  owner!.dispose(); window.history.scrollRestoration = 'auto'; owner = createPageContinuity();
  expect(window.history.scrollRestoration).toBe('manual'); owner.dispose(); owner = undefined;
  expect(window.history.scrollRestoration).toBe('auto');
});

it('restores a reload from bounded tab coordinates without storing URLs or personal data', () => {
  capture(1250, 90); owner!.dispose(); owner = createPageContinuity(); y = 0; owner.commit();
  expect(y).toBe(1250);
  expect(sessionStorage.getItem('sanctuary.page-positions.v1')).not.toContain('/');
});

it('saves the logical top during native elastic overscroll without cancelling the gesture', () => {
  const scroll = vi.mocked(window.scrollTo); scroll.mockClear();
  capture(-28, -12); document.body.scrollTop = -18;
  document.dispatchEvent(new Event('scroll'));
  expect(y).toBe(-28);
  expect(document.body.scrollTop).toBe(-18);
  expect(scroll).not.toHaveBeenCalled();
  owner!.dispose(); owner = undefined;
  const stored = JSON.parse(sessionStorage.getItem('sanctuary.page-positions.v1')!);
  expect(stored.at(-1)[1].position).toEqual({ x: 0, y: 0, body: 0, containers: [0] });
  y = 420; document.body.scrollTop = 0;
  owner = createPageContinuity(); owner.commit();
  expect(y).toBe(0); // The snapshot remains valid for reload/Back, rather than being rejected.
});

it('restores a persisted BODY coordinate into the viewport after the page scroll owner changes', () => {
  document.body.style.overflowY = 'auto';
  vi.spyOn(document.body, 'clientHeight', 'get').mockReturnValue(844);
  vi.spyOn(document.body, 'scrollHeight', 'get').mockReturnValue(3000);
  capture(0, 140); document.body.scrollTop = 1266; document.dispatchEvent(new Event('scroll'));
  owner!.dispose(); owner = undefined;
  expect(JSON.parse(sessionStorage.getItem('sanctuary.page-positions.v1')!).at(-1)[1].position).toEqual({ x: 0, y: 0, body: 1266, containers: [140] });
  document.body.style.overflowY = 'clip'; document.body.scrollTop = 0;
  document.querySelector<HTMLElement>('.two-col-page')!.scrollTop = 0;
  owner = createPageContinuity(); owner.commit();
  expect(y).toBe(1266); expect(document.body.scrollTop).toBe(0);
  expect(document.querySelector<HTMLElement>('.two-col-page')!.scrollTop).toBe(140);
});

it('restores a persisted viewport coordinate into BODY without adding nested pane offsets', () => {
  capture(1266, 140); owner!.dispose(); owner = undefined;
  y = 0; document.body.style.overflowY = 'auto';
  vi.spyOn(document.body, 'clientHeight', 'get').mockReturnValue(844);
  vi.spyOn(document.body, 'scrollHeight', 'get').mockReturnValue(3000);
  document.querySelector<HTMLElement>('.two-col-page')!.scrollTop = 0;
  owner = createPageContinuity(); owner.commit();
  expect(y).toBe(0); expect(document.body.scrollTop).toBe(1266);
  expect(document.querySelector<HTMLElement>('.two-col-page')!.scrollTop).toBe(140);
});

it('new fragment navigation targets its anchor and is not an old pathname position', () => {
  capture(900); const target = document.createElement('section'); target.id = 'details'; target.scrollIntoView = vi.fn(); document.body.append(target);
  push('/guide#details'); expect(target.scrollIntoView).toHaveBeenCalledOnce();
});

it('keeps the source coordinate while a mobile menu pins BODY at a negative offset', () => {
  capture(1440); const source = window.history.state;
  document.body.style.position = 'fixed'; document.body.style.top = '-1440px';
  capture(0); push('/projects'); document.body.style.position = ''; document.body.style.top = '';
  traverse(source, '/'); expect(y).toBe(1440);
});

it('marks native traversal before a framework bubble subscriber can synchronously commit', () => {
  owner!.dispose(); owner = undefined;
  const framework = () => owner!.commit(); window.addEventListener('popstate', framework);
  owner = createPageContinuity(); owner.commit(); capture(1440); const source = window.history.state;
  push('/projects'); capture(850);
  browserReplace.call(window.history, source, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate', { state: source }));
  expect(y).toBe(1440);
  window.removeEventListener('popstate', framework);
});

it('restores a known entry even if the route commit occurs before any pop subscriber', () => {
  capture(1440); const source = window.history.state;
  push('/projects'); capture(850);
  browserReplace.call(window.history, source, '', '/'); owner!.commit();
  expect(y).toBe(1440);
  // URL replacement is a fresh identity, rather than restoring the replaced page's coordinate.
  window.history.replaceState(window.history.state, '', '/guide'); owner!.commit(); expect(y).toBe(0);
});

it('leaves a marked desktop project switch to its hero-anchor owner instead of replaying the page coordinate', () => {
  owner!.dispose(); window.history.replaceState({}, '', '/projects/first');
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  owner = createPageContinuity(); owner.commit(); capture(3000);
  const source = buildProjectDetailHistoryState(window.history.state, 'first');
  window.history.pushState(buildProjectDetailHistoryState({}, 'second'), '', '/projects/second'); owner.commit();
  capture(2000);
  // The specific project owner has aligned its new heading before global route commit.
  browserReplace.call(window.history, source, '', '/projects/first'); y = 140;
  owner.commit(); expect(y).toBe(140);
});
