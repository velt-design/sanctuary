import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import StudioAuthoringLoader from './StudioAuthoringLoader';

const mocks = vi.hoisted(() => ({ api: vi.fn(), leaf: vi.fn(), actorId: 'actor' as string | undefined }));
vi.mock('@/lib/repo/apiClient', () => ({ apiJson: mocks.api }));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => ({ user: mocks.actorId ? { id: mocks.actorId } : null, role: 'staff' }) }));
vi.mock('./studioLeafLoading', () => ({ loadStudioEditor: mocks.leaf }));
vi.mock('./StudioRevisionStart', () => ({ default: (props: Record<string, unknown>) => <div data-testid="revision">{JSON.stringify(props)}</div> }));
vi.mock('./StudioCreateAction', () => ({ default: (props: Record<string, unknown>) => <div data-testid="recovery">{JSON.stringify(props)}</div> }));
const source = () => ({ state: 'ready', estimate: { id: 'est_source', projectId: 'proj_one', versionLabel: 'V1', updatedAt: '2026-09-24T00:00:00Z', requiresNewRevision: false }, view: { designId: 'design', revision: 4 }, nextAction: 'edit', reason: null });
const mounted: ReturnType<typeof renderIntoDocument>[] = [];
const Editor = (props: { scope: { estimateId: string; actorId: string } }) => <div data-testid="editor">{props.scope.actorId}:{props.scope.estimateId}</div>;
beforeEach(() => { vi.resetAllMocks(); mocks.actorId = 'actor'; mocks.api.mockResolvedValue({ authoring: source() }); mocks.leaf.mockResolvedValue(Editor); });
afterEach(() => mounted.splice(0).forEach(value => value.unmount()));
async function mount(intent?: 'edit' | 'revision' | 'duplicate') {
  const rendered = renderIntoDocument(<StudioAuthoringLoader projectId="proj_one" estimateId="est_source" intent={intent} duplicateName="Copy of courtyard" />);
  mounted.push(rendered); await act(async () => {}); return rendered.container;
}
describe('Studio authoring intent', () => {
  it.each(['website-import','import'])('keeps legacy %s responses review-only without an import or editor', async nextAction => {
    mocks.api.mockResolvedValue({authoring:{...source(),state:'needs-import',view:null,nextAction,reason:'Open the established calculator.'}});
    const container=await mount();
    expect(container.textContent).toContain('Open the established calculator.');
    expect(container.querySelector('[data-testid="revision"]')).toBeNull();
    expect(container.querySelector('[data-testid="editor"]')).toBeNull();
  });
  it('opens the editor only for the normal editable source intent', async () => {
    const container = await mount(); expect(container.querySelector('[data-testid="editor"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="revision"]')).toBeNull();
  });
  it.each(['revision', 'duplicate'] as const)('requires explicit creation for %s, without forwarding navigation query into source reads', async intent => {
    const container = await mount(intent);
    expect(container.querySelector('[data-testid="editor"]')).toBeNull();
    const props = JSON.parse(container.querySelector('[data-testid="revision"]')!.textContent!);
    expect(props).toMatchObject({ estimateId: 'est_source', revision: 4, updatedAt: source().estimate.updatedAt });
    if (intent === 'duplicate') expect(props.duplicateName).toBe('Copy of courtyard');
    else expect(props).not.toHaveProperty('duplicateName');
    expect(mocks.api.mock.calls[0][0]).toBe('/api/projects/proj_one/estimates/est_source/studio');
  });
  it('does not invent an editable design for an unsupported historical source', async () => {
    mocks.api.mockResolvedValue({ authoring: { ...source(), state: 'needs-import', view: null, nextAction: 'import-required', reason: 'Supported import required.' } });
    const container = await mount('duplicate');
    expect(container.textContent).toContain('Supported import required.');
    expect(container.querySelector('[data-testid="revision"]')).toBeNull();
    expect(container.querySelector('[data-testid="editor"]')).toBeNull();
    expect(JSON.parse(container.querySelector('[data-testid="recovery"]')!.textContent!).intent).toEqual({ mode: 'recover', sourceEstimateId: 'est_source' });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
describe('Studio editor loading boundary', () => {
  it('starts the leaf with the data request and retains loading until both are ready', async () => {
    const data = deferred<{ authoring: ReturnType<typeof source> }>(), leaf = deferred<typeof Editor>();
    mocks.api.mockReturnValue(data.promise); mocks.leaf.mockReturnValue(leaf.promise);
    const container = await mount();
    expect(mocks.api).toHaveBeenCalledTimes(1); expect(mocks.leaf).toHaveBeenCalledTimes(1);
    await act(async () => data.resolve({ authoring: source() }));
    expect(container.textContent).toContain('Opening saved design');
    expect(container.querySelector('[data-testid="editor"]')).toBeNull();
    await act(async () => leaf.resolve(Editor));
    expect(container.querySelector('[data-testid="editor"]')?.textContent).toBe('actor:est_source');
  });
  it('retries a failed module without offering to recover or replace the saved design', async () => {
    mocks.leaf.mockResolvedValueOnce(null);
    const container = await mount();
    expect(container.textContent).toContain('The design editor could not be opened');
    expect(container.querySelector('[data-testid="recovery"]')).toBeNull();
    await act(async () => (container.querySelector('button') as HTMLButtonElement).click());
    expect(mocks.leaf).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="editor"]')).not.toBeNull();
  });
  it('does not preload editing code before auth or for revision/duplicate creation', async () => {
    mocks.actorId = undefined;
    await mount(); expect(mocks.api).not.toHaveBeenCalled(); expect(mocks.leaf).not.toHaveBeenCalled();
    mocks.actorId = 'actor';
    await mount('revision'); await mount('duplicate');
    expect(mocks.leaf).not.toHaveBeenCalled();
  });
  it('discards an old actor/source completion while the leaf is pending', async () => {
    const leaf = deferred<typeof Editor>();
    mocks.leaf.mockReturnValueOnce(leaf.promise);
    await mount();
    const oldSignal = mocks.api.mock.calls[0][1].signal as AbortSignal;
    mocks.actorId = 'other';
    mocks.api.mockResolvedValue({ authoring: { ...source(), estimate: { ...source().estimate, id: 'est_other' } } });
    await act(async () => mounted[0].rerender(<StudioAuthoringLoader projectId="proj_one" estimateId="est_other" />));
    expect(oldSignal.aborted).toBe(true);
    expect(mounted[0].container.querySelector('[data-testid="editor"]')?.textContent).toBe('other:est_other');
    await act(async () => leaf.resolve(Editor));
    expect(mounted[0].container.querySelector('[data-testid="editor"]')?.textContent).toBe('other:est_other');
  });
  it('does not wait on unused editor code for an unsupported source', async () => {
    mocks.leaf.mockReturnValue(new Promise(() => {}));
    mocks.api.mockResolvedValue({ authoring: { ...source(), state: 'needs-import', view: null, reason: 'Use the specialist calculator.' } });
    expect((await mount()).textContent).toContain('Use the specialist calculator');
  });
  it('aborts the source request on unmount while the leaf loads', async () => {
    const leaf = deferred<typeof Editor>(); mocks.leaf.mockReturnValue(leaf.promise);
    await mount(); const signal = mocks.api.mock.calls[0][1].signal as AbortSignal;
    mounted.pop()!.unmount(); expect(signal.aborted).toBe(true);
    await act(async () => leaf.resolve(Editor));
  });
});
