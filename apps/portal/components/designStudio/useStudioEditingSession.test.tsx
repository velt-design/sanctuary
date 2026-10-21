import { act } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { useStudioEditingSession, type StudioEditingSessionProps } from './useStudioEditingSession';
import { changeStudioSaveSession, createStudioSaveSession, prepareStudioSave, settleStudioSave } from '../../lib/designStudio/saveSession';
import { persistStudioWorkingCopy, readStudioWorkingCopy, studioWorkingCopyKey } from '../../lib/designStudio/workingCopy';
import { listStudioPendingCommands, sendStudioCommand, stageStudioCommand } from '../../lib/designStudio/saveTransport';
import { invalidateStudioLifecycle, prepareStudioSignOut } from '../../lib/designStudio/studioLifecycle';
import { buildNewStudioPergolaDraft } from '../../lib/designStudio/newPergola';
const mocks = vi.hoisted(() => ({ get: vi.fn(), keys: vi.fn(), update: vi.fn(), owner: vi.fn(), api: vi.fn() }));
vi.mock('idb-keyval', () => ({ get: mocks.get, keys: mocks.keys, update: mocks.update }));
vi.mock('@/lib/localFirst/store', () => ({ getLocalFirstStoreOwner: mocks.owner }));
vi.mock('@/lib/repo/apiClient', async load => ({ ...await load<typeof import('@/lib/repo/apiClient')>(), apiJson: mocks.api }));
const scope = { actorId: '10000000-0000-4000-8000-000000000001', projectId: 'proj_20000000-0000-4000-8000-000000000001', estimateId: 'est_30000000-0000-4000-8000-000000000001', designId: 'design' };
const requestId = '40000000-0000-4000-8000-000000000001';
const props: StudioEditingSessionProps = { scope, editable: true, updatedAt: '2026-09-24T00:00:00Z', view: { schemaVersion: 'studio_authoring_view.v1', designId: 'design', revision: 3, spatial: { houseAssembly: null, decks: [], openings: [], pergolas: [] }, site: { access: 'normal' }, objectOptions: [], pricing: 'unpriced' } };
const receipt = { revision: 4, savedAt: '2026-09-24T01:00:00Z', alreadyExisted: false };
const fresh = () => createStudioSaveSession(scope, props.view, props.updatedAt);
const pending = () => { const initial = fresh(); initial.edit.site.access = 'hard'; return prepareStudioSave(changeStudioSaveSession(fresh(), initial.edit), requestId); };
const db = new Map<string, unknown>();
let transactions: Promise<unknown>;
let latest: ReturnType<typeof useStudioEditingSession>;
const mounted: ReturnType<typeof renderIntoDocument>[] = [];
function Harness(input: StudioEditingSessionProps) { latest = useStudioEditingSession(input); return <div>{latest.status}</div>; }
function mount(input = props) { const result = renderIntoDocument(<Harness {...input} />); mounted.push(result); return result; }
const flush = async () => { await act(async () => {}); };
beforeEach(() => {
  invalidateStudioLifecycle();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: vi.fn(async (name, _options, callback) => callback({ name })),
  } });
  vi.resetAllMocks(); db.clear(); transactions = Promise.resolve(); mocks.owner.mockReturnValue(scope.actorId);
  mocks.get.mockImplementation(async key => structuredClone(db.get(key)));
  mocks.keys.mockImplementation(async () => [...db.keys()]);
  mocks.update.mockImplementation((key: string, fn: (old: unknown) => unknown) => {
    const operation = transactions.then(() => { db.set(key, structuredClone(fn(structuredClone(db.get(key))))); });
    transactions = operation.catch(() => undefined); return operation;
  });
  mocks.api.mockResolvedValue({ receipt, pricing: 'unpriced' });
});
afterEach(() => { for (const item of mounted.splice(0)) item.unmount(); });
async function edit(access: string) { await act(async () => { const next = structuredClone(latest.edit!); next.site.access = access; latest.change(next); }); }

describe('studio sign-out lifecycle integration', () => {
  it('flushes the latest queued edit through unmount and refuses saved callbacks while frozen', async () => {
    const rendered = mount(); await flush(); await edit('hard');
    let release!: () => void;
    transactions = new Promise<void>(resolve => { release = resolve; });
    act(() => { const next = structuredClone(latest.edit!); next.site.access = 'easy'; latest.change(next); });
    const save = latest.save; const retry = latest.retry;
    let preparation!: ReturnType<typeof prepareStudioSignOut>;
    await act(async () => { preparation = prepareStudioSignOut(scope.actorId, () => true); });
    expect(latest.canEdit).toBe(false);
    await act(async () => { await save(); await retry(); });
    expect(mocks.api).not.toHaveBeenCalled(); expect(latest.session?.pending).toBeNull();
    rendered.unmount();
    let result!: Awaited<typeof preparation>;
    await act(async () => { release(); result = await preparation; });
    expect(result.state).toBe('ready');
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { edit: { site: { access: 'easy' } }, dirty: true, pending: null } });
    if (result.state === 'ready') result.release();
  });
  it('blocks sign-out when the latest accepted edit fails durable storage', async () => {
    mount(); await flush(); mocks.update.mockRejectedValueOnce(Error('quota')); await edit('hard');
    let result!: Awaited<ReturnType<typeof prepareStudioSignOut>>;
    await act(async () => { result = await prepareStudioSignOut(scope.actorId, () => true); });
    expect(result.state).toBe('blocked'); expect(latest.localDurable).toBe(false); expect(mocks.owner()).toBe(scope.actorId);
  });
  it('resumes initial restore after sign-out is cancelled during its read', async () => {
    let resolve!: (value: unknown) => void;
    mocks.get.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    mount(); await flush(); expect(latest.status).toBe('loading');
    let result!: Awaited<ReturnType<typeof prepareStudioSignOut>>;
    await act(async () => { result = await prepareStudioSignOut(scope.actorId, () => true); });
    await act(async () => resolve(undefined)); expect(latest.canEdit).toBe(false);
    await act(async () => { if (result.state === 'ready') result.release(); });
    await flush(); expect(latest).toMatchObject({ status: 'ready', canEdit: true, localDurable: true });
  });
  it('retains an in-flight exact request and ignores late success after A -> null -> A', async () => {
    let resolve!: (value: unknown) => void;
    mocks.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    mount(); await flush(); await edit('hard');
    let saving!: Promise<void>; await act(async () => { saving = latest.save(); });
    const body = mocks.api.mock.calls[0][1].body;
    let result!: Awaited<ReturnType<typeof prepareStudioSignOut>>;
    await act(async () => { result = await prepareStudioSignOut(scope.actorId, () => true); });
    expect(result.state).toBe('ready');
    await act(async () => {
      invalidateStudioLifecycle(); mocks.owner.mockReturnValue(null); mocks.owner.mockReturnValue(scope.actorId);
      resolve({ receipt, pricing: 'unpriced' }); await saving;
      if (result.state === 'ready') result.release();
    });
    expect(await listStudioPendingCommands(scope)).toMatchObject({ entries: [{ recovery: { state: 'valid', body, receipt } }] });
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'recovery', session: { pending: { command: JSON.parse(body) } } });
    expect(latest.session?.baseRevision).toBe(3);
  });
});

describe('connected studio editing session', () => {
  it('retains the confirmed receipt when recovered duplication cannot be settled', async () => {
    const state = pending();
    const retained = await sendStudioCommand(scope, state.pending!.command);
    expect(retained.state).toBe('confirmed');
    const copy = buildNewStudioPergolaDraft({pergolaId:'unsent-copy',currentPergolas:[]});
    // Represents a retained working copy from an interrupted/older client,
    // containing an operation absent from the confirmed command.
    state.edit.schemaVersion='studio_authoring_edit.v2';
    state.edit.spatial.pergolas.push(copy);
    state.edit.objectOptions.push({objectId:copy.id,values:{}});
    state.edit.duplications=[{targetId:copy.id,sourceId:null,values:{},rowOrigins:{flashings:{},infills:{}}}];
    state.generation += 1;
    expect((await persistStudioWorkingCopy(scope,state,null)).state).toBe('persisted');
    mount({...props,view:{...props.view,revision:4},updatedAt:receipt.savedAt});await flush();
    expect(latest).toMatchObject({status:'recovery',canEdit:false,session:{baseRevision:3}});
    expect(latest.session?.pending?.command.requestId).toBe(requestId);
    expect(await listStudioPendingCommands(scope)).toMatchObject({entries:[{recovery:{state:'valid',receipt}}]});
    expect(latest.message).toContain('confirmed save is retained');
  });
  it('refreshes a clean acknowledged cache when a newer saved design is loaded', async () => {
    const acknowledged = { ...fresh(), generation: 9 };
    expect((await persistStudioWorkingCopy(scope, acknowledged, null)).state).toBe('persisted');
    mount({ ...props, view: { ...props.view, revision: 4, site: { access: 'easy' } }, updatedAt: receipt.savedAt });
    await flush();
    expect(latest).toMatchObject({ status: 'ready', canEdit: true, canSave: false, localDurable: true,
      session: { baseRevision: 4, generation: 9, dirty: false, pending: null, edit: { site: { access: 'easy' } } } });
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { baseRevision: 4, dirty: false } });
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it('preserves unsaved edits when the saved design advances', async () => {
    const state = fresh(); state.edit.site.access = 'hard';
    expect((await persistStudioWorkingCopy(scope, changeStudioSaveSession(fresh(), state.edit), null)).state).toBe('persisted');
    mount({ ...props, view: { ...props.view, revision: 4 }, updatedAt: receipt.savedAt }); await flush();
    expect(latest).toMatchObject({ status: 'recovery', canEdit: false, session: { baseRevision: 3, dirty: true, edit: { site: { access: 'hard' } } } });
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { baseRevision: 3, dirty: true } });
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it('does not replace a clean cache with an older server revision', async () => {
    expect((await persistStudioWorkingCopy(scope, fresh(), null)).state).toBe('persisted');
    mount({ ...props, view: { ...props.view, revision: 2 } }); await flush();
    expect(latest).toMatchObject({ status: 'recovery', canEdit: false, session: { baseRevision: 3 } });
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { baseRevision: 3 } });
  });
  it('loads local storage before editing, persists edits and restores dirty work on reload', async () => {
    const first = mount(); expect(latest.canEdit).toBe(false); await flush();
    expect(latest).toMatchObject({ status: 'ready', localDurable: true, canEdit: true });
    await edit('hard'); expect(latest.session?.dirty).toBe(true);
    first.unmount(); mount(); await flush();
    expect(latest.edit?.site.access).toBe('hard'); expect(latest.canSave).toBe(true);
  });
  it('keeps edits made during the request and durably settles them before acknowledgement', async () => {
    let resolve!: (value: unknown) => void;
    mocks.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    mount(); await flush(); await edit('hard');
    let saving!: Promise<void>; await act(async () => { saving = latest.save(); });
    const body = mocks.api.mock.calls[0][1].body;
    await edit('easy'); expect(latest.edit?.site.access).toBe('easy');
    await act(async () => { resolve({ receipt, pricing: 'unpriced' }); await saving; });
    expect(latest).toMatchObject({ status: 'ready', localDurable: true, session: { baseRevision: 4, dirty: true, pending: null } });
    expect(JSON.parse(body).edit.site.access).toBe('hard');
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { edit: { site: { access: 'easy' } }, dirty: true } });
    expect(await listStudioPendingCommands(scope)).toMatchObject({ state: 'available', entries: [] });
  });
  it('retries an unconfirmed save using its exact body despite later edits', async () => {
    mocks.api.mockRejectedValueOnce(Error('offline'));
    mount(); await flush(); await edit('hard'); await act(async () => { await latest.save(); });
    expect(latest.canRetry).toBe(true);
    const body = mocks.api.mock.calls[0][1].body;
    await edit('easy'); await act(async () => { await latest.retry(); });
    expect(mocks.api.mock.calls[1][1].body).toBe(body);
    expect(latest.session?.dirty).toBe(true);
  });
  it.each([false, true])('recovers a confirmed receipt after reload (already settled: %s)', async settledAlready => {
    const state = pending(); const stored = await persistStudioWorkingCopy(scope, state, null);
    await sendStudioCommand(scope, state.pending!.command);
    if (settledAlready && stored.state === 'persisted') await persistStudioWorkingCopy(scope, settleStudioSave(state, requestId, { kind: 'success', receipt }), stored.token);
    mocks.api.mockClear(); mount({ ...props, view: { ...props.view, revision: 4 }, updatedAt: receipt.savedAt }); await flush();
    expect(latest).toMatchObject({ status: 'ready', session: { baseRevision: 4, pending: null }, localDurable: true });
    expect(mocks.api).not.toHaveBeenCalled();
    expect(await listStudioPendingCommands(scope)).toMatchObject({ entries: [] });
  });
  it('restores a prepared unstaged request without inventing a new request identity', async () => {
    const state = pending(); await persistStudioWorkingCopy(scope, state, null);
    mount(); await flush(); expect(latest.canRetry).toBe(true); expect(mocks.api).not.toHaveBeenCalled();
    await act(async () => { await latest.retry(); });
    expect(mocks.api.mock.calls[0][1].body).toBe(JSON.stringify(state.pending!.command));
  });
  it.each(['corrupt', 'orphan', 'cross-base'])('blocks editing and preserves %s recovery data', async fault => {
    if (fault === 'corrupt') db.set(studioWorkingCopyKey(scope), '{bad');
    if (fault === 'orphan') await stageStudioCommand(scope, pending().pending!.command);
    if (fault === 'cross-base') {
      const local = fresh(); local.edit.site.access = 'hard';
      await persistStudioWorkingCopy(scope, changeStudioSaveSession(fresh(), local.edit), null);
    }
    const before = structuredClone([...db]);
    mount(fault === 'cross-base' ? { ...props, updatedAt: receipt.savedAt } : props); await flush();
    expect(latest.status).toBe('recovery'); expect(latest.canEdit).toBe(false);
    expect([...db]).toEqual(before); expect(mocks.api).not.toHaveBeenCalled();
  });
  it('blocks a stale CAS write and retains the unsaved edit in memory without sending', async () => {
    mount(); await flush();
    const key = studioWorkingCopyKey(scope); const replacement = JSON.parse(db.get(key) as string); replacement.session.generation = 20;
    db.set(key, JSON.stringify(replacement)); await edit('hard');
    expect(latest).toMatchObject({ status: 'recovery', localDurable: false });
    expect(latest.edit?.site.access).toBe('hard');
    await act(async () => { await latest.save(); }); expect(mocks.api).not.toHaveBeenCalled();
    expect(JSON.parse(db.get(key) as string).session.generation).toBe(20);
  });
  it('retains the receipt when settled working-copy persistence fails', async () => {
    mount(); await flush(); await edit('hard');
    mocks.api.mockImplementationOnce(async () => { mocks.update.mockRejectedValueOnce(Error('receipt storage')).mockRejectedValueOnce(Error('working storage')); return { receipt, pricing: 'unpriced' }; });
    await act(async () => { await latest.save(); });
    expect(latest.canEdit).toBe(false);
    const journal = await listStudioPendingCommands(scope); expect(journal.state).toBe('available');
    if (journal.state === 'available') expect(journal.entries).toHaveLength(1);
  });
  it('does not expose old-owner responses or permit writes after owner change', async () => {
    let resolve!: (value: unknown) => void; mocks.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const rendered = mount(); await flush(); await edit('hard');
    let saving!: Promise<void>; await act(async () => { saving = latest.save(); });
    mocks.owner.mockReturnValue('another'); rendered.rerender(<Harness {...props} />);
    expect(latest.session).toBeNull();
    await act(async () => { resolve({ receipt, pricing: 'unpriced' }); await saving; });
    expect(latest.session).toBeNull(); expect(latest.canEdit).toBe(false);
  });
  it('keeps locked versions read-only without writing a new working copy', async () => {
    mount({ ...props, editable: false }); await flush();
    expect(latest.status).toBe('locked'); expect(db.size).toBe(0); expect(latest.canEdit).toBe(false);
  });
  it('drains accepted edits after unmount without starting a network request', async () => {
    const rendered = mount(); await flush();
    act(() => { const next = structuredClone(latest.edit!); next.site.access = 'hard'; latest.change(next); rendered.unmount(); });
    await flush();
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { dirty: true, edit: { site: { access: 'hard' } } } });
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it.each([4, 5])('allows only exact replay after a lost response with server revision %s, without rebasing edits', async serverRevision => {
    const state = pending(); const later = structuredClone(state.edit); later.site.access = 'easy';
    const local = changeStudioSaveSession(state, later);
    await persistStudioWorkingCopy(scope, local, null); await stageStudioCommand(scope, state.pending!.command);
    mount({ ...props, view: { ...props.view, revision: serverRevision }, updatedAt: receipt.savedAt }); await flush();
    expect(latest).toMatchObject({ canRetry: true, canEdit: false, canSave: false, session: { baseRevision: 3 } });
    await edit('hard'); expect(latest.edit?.site.access).toBe('easy');
    await act(async () => { await latest.retry(); });
    expect(mocks.api.mock.calls[0][1].body).toBe(JSON.stringify(state.pending!.command));
    if (serverRevision === 4) {
      expect(latest).toMatchObject({ canEdit: true, session: { baseRevision: 4, dirty: true, pending: null } });
    } else {
      expect(latest).toMatchObject({ status: 'recovery', canEdit: false, session: { baseRevision: 3 } });
      expect((await listStudioPendingCommands(scope)).state).toBe('available');
    }
    expect(latest.edit?.site.access).toBe('easy');
  });
  it('retains pending reconciliation after receipt storage fails, then reloads and retries without losing later edits', async () => {
    let resolve!: (value: unknown) => void;
    mocks.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const first = mount(); await flush(); await edit('hard');
    let saving!: Promise<void>; await act(async () => { saving = latest.save(); });
    const body = mocks.api.mock.calls[0][1].body;
    await edit('easy');
    mocks.update.mockRejectedValueOnce(Error('receipt quota'));
    await act(async () => { resolve({ receipt, pricing: 'unpriced' }); await saving; });
    expect(latest).toMatchObject({ canRetry: true, canEdit: false, session: { baseRevision: 3, dirty: true } });
    expect(latest.session?.pending).not.toBeNull();
    first.unmount(); mount({ ...props, view: { ...props.view, revision: 4 }, updatedAt: receipt.savedAt }); await flush();
    expect(latest.canRetry).toBe(true);
    await act(async () => { await latest.retry(); });
    expect(mocks.api.mock.calls[1][1].body).toBe(body);
    expect(latest).toMatchObject({ canEdit: true, session: { baseRevision: 4, pending: null, dirty: true } });
    expect(latest.edit?.site.access).toBe('easy');
    expect(await listStudioPendingCommands(scope)).toMatchObject({ entries: [] });
  });
  it('recovers an earlier already-settled working copy whose journal has no receipt', async () => {
    const state = pending(); const later = structuredClone(state.edit); later.site.access = 'easy';
    const settled = settleStudioSave(changeStudioSaveSession(state, later), requestId, { kind: 'success', receipt });
    await persistStudioWorkingCopy(scope, settled, null); await stageStudioCommand(scope, state.pending!.command);
    mount({ ...props, view: { ...props.view, revision: 4 }, updatedAt: receipt.savedAt }); await flush();
    expect(latest).toMatchObject({ canRetry: true, canEdit: false, session: { pending: null, dirty: true } });
    await act(async () => { await latest.retry(); });
    expect(mocks.api.mock.calls[0][1].body).toBe(JSON.stringify(state.pending!.command));
    expect(latest).toMatchObject({ canEdit: true, session: { pending: null, dirty: true } });
    expect(latest.edit?.site.access).toBe('easy');
    expect(await listStudioPendingCommands(scope)).toMatchObject({ entries: [] });
  });
  it('recovers an already-settled no-op receipt at the original revision without losing later edits', async () => {
    const state = pending(); const later = structuredClone(state.edit); later.site.access = 'easy';
    const noOpReceipt = { ...receipt, revision: state.baseRevision };
    const settled = settleStudioSave(changeStudioSaveSession(state, later), requestId, { kind: 'success', receipt: noOpReceipt });
    await persistStudioWorkingCopy(scope, settled, null); await stageStudioCommand(scope, state.pending!.command);
    mocks.api.mockResolvedValue({ receipt: noOpReceipt, pricing: 'unpriced' });
    mount({ ...props, updatedAt: noOpReceipt.savedAt }); await flush();
    expect(latest).toMatchObject({ canRetry: true, canEdit: false, canSave: false, session: { baseRevision: 3, pending: null, dirty: true } });
    await edit('hard'); expect(latest.edit?.site.access).toBe('easy');
    await act(async () => { await latest.retry(); });
    expect(mocks.api.mock.calls[0][1].body).toBe(JSON.stringify(state.pending!.command));
    expect(latest).toMatchObject({ canEdit: true, localDurable: true, session: { baseRevision: 3, baseUpdatedAt: noOpReceipt.savedAt, pending: null, dirty: true } });
    expect(latest.edit?.site.access).toBe('easy');
    expect(await listStudioPendingCommands(scope)).toMatchObject({ entries: [] });
  });
});

describe('explicit saved-basis recovery', () => {
 it('offers an explicit choice for retained local work and loads saved only after preservation', async () => {
  const state = fresh(), edit = structuredClone(state.edit); edit.site.access = 'hard';
  await persistStudioWorkingCopy(scope, changeStudioSaveSession(state, edit), null);
  const newer = { ...props, view: { ...props.view, revision: 4 }, updatedAt: '2026-09-28T01:00:00Z' };
  mount(newer); await flush();
  expect(latest.canEdit).toBe(false); expect(latest.canUseSaved).toBe(true); expect(latest.edit?.site.access).toBe('hard');
  mocks.api.mockResolvedValueOnce({ authoring: { state: 'ready', nextAction: 'edit', view: newer.view, estimate: { id: scope.estimateId, projectId: scope.projectId, updatedAt: newer.updatedAt, requiresNewRevision: false } } });
  await act(async () => { await latest.useSaved(); });
  expect(latest).toMatchObject({ canEdit: true, canSave: false, canUseSaved: false, localDurable: true });
  expect(latest.edit?.site.access).toBe('normal'); expect(latest.retainedCopies[0].session.edit.site.access).toBe('hard');
 });
 it('clears the prior successful-save message when a new edit starts', async () => {
  mount(); await flush(); await edit('hard'); await act(async () => { await latest.save(); });
  expect(latest.message).toBe('Saved.'); await edit('easy'); expect(latest.message).toBeNull(); expect(latest.session?.dirty).toBe(true);
 });
});
