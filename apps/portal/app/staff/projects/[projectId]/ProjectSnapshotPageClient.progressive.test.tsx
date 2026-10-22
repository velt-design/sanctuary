import { act, StrictMode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import ProjectSnapshotPageClient from './ProjectSnapshotPageClient';
import type { ProjectWorkReadLoaders } from '@/lib/projects/projectWorkInitialRead';
import { projectFixtureSnapshot } from '@/app/qa/portal-progressive-fixture/ProjectJourney';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => ({ user: { id: 'fictional-staff' }, role: 'staff' }) }));
vi.mock('@/components/ui/toast/ToastProvider', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/components/navigation/ProjectsIndexLink', () => ({ default: ({children, ...props}: any) => <a {...props}>{children}</a> }));
vi.mock('@/lib/supabase/browserClient', () => ({ supabaseHostFromUrl: () => 'fictional', supabaseRuntimeUrl: () => 'https://fictional.invalid' }));
// Keep actual route queries, frame, masthead, tab navigation and access/mutation gates.
// Specialist bodies are outside this query/identity regression.
vi.mock('@/components/projects/ProjectPage/projectTabModules', () => ({
  preloadProjectOverviewModule: async () => undefined, preloadProjectTab: async () => undefined,
  OverviewTab: () => <section>Actual Overview slot</section>, CommercialTab: () => <section>Actual Commercial slot</section>, JobPacksTab: () => <section>Job Packs</section>,
}));
function deferred<T>() { let resolve!: (value:T)=>void; const promise = new Promise<T>(done => {resolve=done;}); return { promise, resolve }; }
const response = (id: string) => ({ snapshot: projectFixtureSnapshot(id), generatedAt: '2026-10-22T00:00:00Z' });
const flush = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); };
afterEach(() => { document.body.innerHTML = ''; window.history.replaceState(null, '', '/'); });
function mount(loaders: ProjectWorkReadLoaders) {
 const client = new QueryClient({ defaultOptions: {queries: { retry: false, gcTime: 0 }} });
 const tree = (id: string) => <StrictMode><QueryClientProvider client={client}><ProjectSnapshotPageClient projectId={id} tab="activity" estimateId={null} debugExportEnabled={false} readLoaders={loaders} readOnly /></QueryClientProvider></StrictMode>;
 const rendered = renderIntoDocument(tree('proj_progressive_a'));
 return { ...rendered, project: (id:string) => rendered.rerender(tree(id)), close: () => { rendered.unmount(); client.clear(); } };
}
describe('actual project initial query and persistent frame', () => {
 it('keeps real header/tabs through summary and full result, permits pending tab selection, and guards record actions', async () => {
  const summary = deferred<any>(), snapshot = deferred<any>();
  const loaders = { summary: vi.fn(() => summary.promise), snapshot: vi.fn(() => snapshot.promise), command: vi.fn(() => new Promise<any>(() => {})), payment: vi.fn(() => new Promise<any>(() => {})) };
  const ui = mount(loaders); await flush();
  const header = ui.container.querySelector('[aria-label="Project summary"]');
  const tabs = ui.container.querySelector('[aria-label="Project sections"]');
  expect(header).not.toBeNull(); expect(tabs).not.toBeNull();
  expect(ui.container.textContent).toContain('Reading project'); expect(ui.container.textContent).not.toContain('Unassigned');
  const commercial = [...ui.container.querySelectorAll('button')].find(button => button.textContent === 'Commercial')!;
  act(() => commercial.click()); expect(ui.container.textContent).toContain('Actual Commercial slot');
  summary.resolve(response('proj_progressive_a')); await flush();
  expect(ui.container.textContent).toContain('Fictional courtyard');
  expect(ui.container.querySelector('[aria-label="Project summary"]')).toBe(header);
  expect(ui.container.querySelector('[aria-label="Project sections"]')).toBe(tabs);
  snapshot.resolve(response('proj_progressive_a')); await flush();
  expect(ui.container.querySelector('[data-project-snapshot-state="fresh"]')).not.toBeNull();
  expect(ui.container.querySelector('[aria-label="Project summary"]')).toBe(header);
  expect(loaders.summary).toHaveBeenCalledTimes(1); expect(loaders.snapshot).toHaveBeenCalledTimes(1);
  expect(ui.container.querySelector('a[href$="/design-workbench"]')?.getAttribute('aria-disabled')).toBe('true');
  ui.close();
 });
 it('never applies an older project result after A to B changes', async () => {
  const a = deferred<any>(), b = deferred<any>();
  const load = (id:string) => id.endsWith('_b') ? b.promise : a.promise;
  const ui = mount({ summary: load, snapshot: load, command: () => new Promise<any>(() => {}), payment: () => new Promise<any>(() => {}) });
  await flush(); ui.project('proj_progressive_b'); await flush();
  a.resolve(response('proj_progressive_a')); await flush();
  expect(ui.container.textContent).not.toContain('Fictional courtyard');
  expect(ui.container.textContent).toContain('Reading project');
  b.resolve(response('proj_progressive_b')); await flush();
  expect(ui.container.textContent).toContain('Fictional harbour'); expect(ui.container.textContent).not.toContain('Fictional courtyard');
  ui.close();
 });
 it('retains the actual frame after an initial read failure and recovers with Retry', async () => {
  const read = vi.fn().mockRejectedValueOnce(new Error('Synthetic failure')).mockRejectedValueOnce(new Error('Synthetic failure')).mockImplementation(async () => response('proj_progressive_a'));
  const ui = mount({ summary: read, snapshot: read, command: () => new Promise<any>(() => {}), payment: () => new Promise<any>(() => {}) });
  const header = ui.container.querySelector('[aria-label="Project summary"]'); await flush();
  expect(ui.container.textContent).toContain('Could not load project details'); expect(ui.container.textContent).not.toContain('last known details');
  expect(ui.container.textContent).toContain('Status unavailable'); expect(ui.container.textContent).toContain('Owner unavailable');
  expect(ui.container.textContent).not.toContain('Reading status'); expect(ui.container.querySelector('[title*="Last known project status"]')).toBeNull();
  const retry = [...ui.container.querySelectorAll('button')].find(button => button.textContent === 'Retry')!;
  act(() => retry.click()); await flush();
  expect(ui.container.textContent).toContain('Fictional courtyard'); expect(ui.container.querySelector('[aria-label="Project summary"]')).toBe(header);
  ui.close();
 });
});
