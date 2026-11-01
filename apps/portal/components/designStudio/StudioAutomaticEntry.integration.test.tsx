import { act, StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import StudioProjectEntry from './StudioProjectEntry';
import StudioNativeEntry from './StudioNativeEntry';
import { bindLocalFirstStoreOwner, clearLocalFirstStoreOwner, createEmptyLocalFirstState, writeLocalFirstWorkingCopy, __resetLocalFirstStoreForTests, __setLocalFirstStorageAdapterForTests } from '@/lib/localFirst/store';
import * as lifecycle from '@/lib/designStudio/studioSessionLifecycle';
import type { StudioProjectDesigns } from '@/lib/designStudio/projectDesigns';

const mocks = vi.hoisted(() => ({ native: vi.fn(), api: vi.fn() }));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => ({ status: 'authenticated', user: { id: 'actor' }, role: 'staff' }) }));
vi.mock('@/lib/repo/apiClient', () => ({ apiJson: mocks.api }));
// Keep the real preparation, local drain and cancellation. Only physical native
// navigation is replaced, so a second nonowned fence cannot be mocked away.
vi.mock('@/lib/designStudio/studioDocumentNavigation', async original => {
  const real = await original<typeof import('@/lib/designStudio/studioDocumentNavigation')>();
  return { ...real, navigateStudioDocument: (href: string, replace = false, _native?: unknown, signal?: AbortSignal) => real.navigateStudioDocument(href, replace, mocks.native, signal) };
});
vi.mock('./StudioCreateAction', () => ({ default: () => { throw Error('Existing design entry must not create another design.'); } }));

const projectId = 'proj_10000000-0000-4000-8000-000000000001';
const estimateId = 'est_20000000-0000-4000-8000-000000000001';
const callback = `/staff/design-studio/${projectId}/${estimateId}/edit`;
const inventory: StudioProjectDesigns = { project: { id: projectId.slice(5), name: 'Synthetic project' }, loadError: false, designs: [{ id: estimateId, label: 'Design 1', versionLabel: 'V1', createdAt: '', history: 'Current draft', quoteLabel: null, canOpenEditor: true, status: 'draft', commercialScopeId: null, isActiveDraft: true }] };
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
let mounted: ReturnType<typeof renderIntoDocument> | undefined;
let prepared: MockInstance<typeof lifecycle.prepareStudioNavigation>;
let saved: ReturnType<typeof createEmptyLocalFirstState>;
const flush = () => act(async () => {});
function entry(kind: 'project' | 'fallback', data = inventory) {
  return kind === 'project' ? <StudioProjectEntry projectId={projectId} actorId="actor" initial={data} /> : <StudioNativeEntry callback={callback} />;
}
beforeEach(() => {
  __resetLocalFirstStoreForTests(); lifecycle.invalidateStudioLifecycle(); vi.clearAllMocks();
  saved = createEmptyLocalFirstState();
  __setLocalFirstStorageAdapterForTests({ get: async () => saved, set: async value => { saved = structuredClone(value); } });
  bindLocalFirstStoreOwner('actor');
  prepared = vi.spyOn(lifecycle, 'prepareStudioNavigation');
});
afterEach(() => {
  mounted?.unmount(); mounted = undefined;
  for (const result of prepared.mock.results) if (result.type === 'return') result.value.release();
  vi.restoreAllMocks(); clearLocalFirstStoreOwner(); lifecycle.invalidateStudioLifecycle(); __setLocalFirstStorageAdapterForTests(null);
});

it.each(['project', 'fallback'] as const)('lets only the live StrictMode %s effect acquire a fence and navigate once', async kind => {
  mounted = renderIntoDocument(<StrictMode>{entry(kind)}</StrictMode>);
  await flush();
  expect(mounted.container.textContent).not.toContain('already being checked');
  expect(prepared).toHaveBeenCalledExactlyOnceWith('actor');
  expect(mocks.native).toHaveBeenCalledExactlyOnceWith(callback, true);
  expect(prepared.mock.results[0].value.fenced()).toBe(false);
  expect(mocks.api).not.toHaveBeenCalled();
});
it.each(['project', 'fallback'] as const)('keeps ordinary %s entry single-dispatch without an effect replay', async kind => {
  mounted = renderIntoDocument(entry(kind)); await flush();
  expect(prepared).toHaveBeenCalledOnce(); expect(mocks.native).toHaveBeenCalledExactlyOnceWith(callback, true);
});
it.each(['project', 'fallback'] as const)('does not acquire a fence, read or navigate after immediate %s retirement', async kind => {
  mounted = renderIntoDocument(<StrictMode>{entry(kind)}</StrictMode>); mounted.unmount(); mounted = undefined;
  await flush(); expect(prepared).not.toHaveBeenCalled(); expect(mocks.native).not.toHaveBeenCalled(); expect(mocks.api).not.toHaveBeenCalled();
});
it.each(['project', 'fallback'] as const)('drains accepted local work before %s entry, then cancels a retired navigation without losing the write or leaking its fence', async kind => {
  const held = deferred();
  __setLocalFirstStorageAdapterForTests({ get: async () => saved, set: async value => { await held.promise; saved = structuredClone(value); } });
  const write = writeLocalFirstWorkingCopy({ entityKey: 'estimate:ordinary', data: { name: 'Last accepted edit' } });
  mounted = renderIntoDocument(<StrictMode>{entry(kind)}</StrictMode>); await flush();
  expect(prepared).toHaveBeenCalledOnce(); expect(prepared.mock.results[0].value.fenced()).toBe(true); expect(mocks.native).not.toHaveBeenCalled();
  mounted.unmount(); mounted = undefined;
  await act(async () => { held.resolve(); await write; }); await flush();
  expect(saved.workingCopies['estimate:ordinary'].data).toEqual({ name: 'Last accepted edit' }); expect(mocks.native).not.toHaveBeenCalled(); expect(prepared.mock.results[0].value.fenced()).toBe(false);
  mounted = renderIntoDocument(entry(kind)); await flush(); expect(mocks.native).toHaveBeenCalledExactlyOnceWith(callback, true); expect(prepared).toHaveBeenCalledTimes(2);
});
it('retires a held refreshed inventory before it can dispatch navigation or creation', async () => {
  const held = deferred(); mocks.api.mockImplementation(async () => { await held.promise; return { ...inventory, projectId }; });
  mounted = renderIntoDocument(entry('project', { ...inventory, loadError: true })); await flush();
  await act(async () => mounted!.container.querySelector('button')!.click());
  expect(mocks.api).toHaveBeenCalledExactlyOnceWith(`/api/projects/${projectId}/studio`, { signal: expect.any(AbortSignal), cache: 'no-store' });
  const signal = mocks.api.mock.calls[0][1].signal as AbortSignal;
  mounted.unmount(); mounted = undefined; expect(signal.aborted).toBe(true);
  await act(async () => held.resolve()); expect(prepared).not.toHaveBeenCalled(); expect(mocks.native).not.toHaveBeenCalled();
});
