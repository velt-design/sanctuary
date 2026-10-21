import {defaultSidePanel} from '@sp/configurator/website';
import { retainStudioWorkingCopy, listStudioRetainedCopies } from './workingCopy';
import { useSavedStudioDesign, restoreRetainedWebsiteChoices } from './workingCopyRecovery';
import { newStudioWebsiteDesign } from './websiteDesign';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStudioSaveSession, changeStudioSaveSession, prepareStudioSave, settleStudioSave } from './saveSession';
import { stageStudioCommand, sendStudioCommand, acknowledgeStudioCommand, studioPendingCommandKey } from './saveTransport';
import { clearStudioWorkingCopy, persistStudioWorkingCopy, readStudioWorkingCopy, studioWorkingCopyKey } from './workingCopy';

const mocks = vi.hoisted(() => ({ get: vi.fn(), keys: vi.fn(), update: vi.fn(), owner: vi.fn(), api: vi.fn() }));
vi.mock('idb-keyval', () => ({ get: mocks.get, keys: mocks.keys, update: mocks.update }));
vi.mock('@/lib/localFirst/store', () => ({ getLocalFirstStoreOwner: mocks.owner }));
vi.mock('@/lib/repo/apiClient', async load => ({ ...await load<typeof import('@/lib/repo/apiClient')>(), apiJson: mocks.api }));
const scope = { actorId: '10000000-0000-4000-8000-000000000001', projectId: 'proj_20000000-0000-4000-8000-000000000001', estimateId: 'est_30000000-0000-4000-8000-000000000001', designId: 'design' };
const requestId = '40000000-0000-4000-8000-000000000001';
const receipt = { revision: 4, savedAt: '2026-09-24T01:00:00Z', alreadyExisted: false };
const initial = () => createStudioSaveSession(scope, { schemaVersion: 'studio_authoring_view.v1', designId: 'design', revision: 3, spatial: { houseAssembly: null, decks: [], openings: [], pergolas: [] }, site: { access: 'normal' }, objectOptions: [], pricing: 'unpriced' }, '2026-09-24T00:00:00Z');
const changed = () => { const state = initial(); state.edit.site.access = 'hard'; return changeStudioSaveSession(initial(), state.edit); };
const db = new Map<string, unknown>();
let transactions: Promise<unknown>;
beforeEach(() => {
  vi.resetAllMocks(); db.clear(); transactions = Promise.resolve(); mocks.owner.mockReturnValue(scope.actorId);
  mocks.get.mockImplementation(async key => structuredClone(db.get(key)));
  mocks.keys.mockImplementation(async () => [...db.keys()]);
  mocks.update.mockImplementation((key: string, fn: (previous: unknown) => unknown) => {
    const operation = transactions.then(() => { const value = fn(structuredClone(db.get(key))); db.set(key, structuredClone(value)); });
    transactions = operation.catch(() => undefined); return operation;
  });
  mocks.api.mockResolvedValue({ receipt, pricing: 'unpriced' });
});
async function persist(state = initial(), previous: string | null = null) {
  const result = await persistStudioWorkingCopy(scope, state, previous);
  expect(result.state).toBe('persisted'); if (result.state !== 'persisted') throw Error(); return result.token;
}

describe('studio durable working copy', () => {
  it('restores clean and dirty safe sessions after reload', async () => {
    expect(await readStudioWorkingCopy(scope)).toEqual({ state: 'absent' });
    const token = await persist();
    expect(await readStudioWorkingCopy(scope)).toEqual({ state: 'valid', token, session: initial() });
    const dirtyToken = await persist(changed(), token);
    expect(await readStudioWorkingCopy(scope)).toEqual({ state: 'valid', token: dirtyToken, session: changed() });
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it('preserves frozen command and newer edits, then persists advanced base before journal acknowledgement', async () => {
    const pending = prepareStudioSave(changed(), requestId);
    const edit = structuredClone(pending.edit); edit.site.access = 'easy';
    const later = changeStudioSaveSession(pending, edit);
    const token = await persist(later);
    expect((await readStudioWorkingCopy(scope)).state).toBe('recovery'); // Prepared but not staged yet.
    await stageStudioCommand(scope, pending.pending!.command);
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { pending: pending.pending, edit: { site: { access: 'easy' } }, dirty: true } });
    const result = await sendStudioCommand(scope, pending.pending!.command);
    expect(result.state).toBe('confirmed');
    expect((await readStudioWorkingCopy(scope)).state).toBe('recovery');
    const settled = settleStudioSave(later, requestId, { kind: 'success', receipt });
    const settledToken = await persist(settled, token);
    expect((await readStudioWorkingCopy(scope)).state).toBe('recovery');
    expect(await acknowledgeStudioCommand(scope, pending.pending!.command, { body: JSON.stringify(pending.pending!.command), receipt })).toBe(true);
    expect(await readStudioWorkingCopy(scope)).toEqual({ state: 'valid', session: settled, token: settledToken });
    expect(settled).toMatchObject({ baseRevision: 4, dirty: true, pending: null, edit: { site: { access: 'easy' } } });
  });
  it('does not lose newer work through stale or concurrent writes', async () => {
    const token = await persist();
    const first = changed(), second = changed(); second.edit.site.access = 'easy';
    const results = await Promise.all([persistStudioWorkingCopy(scope, first, token), persistStudioWorkingCopy(scope, second, token)]);
    expect(results.map(item => item.state)).toEqual(['persisted', 'conflict']);
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: first });
    const saved = results[0]; if (saved.state !== 'persisted') throw Error();
    expect((await persistStudioWorkingCopy(scope, initial(), saved.token)).state).toBe('conflict');
  });
  it.each(['foreign-scope', 'unknown-field', 'private-edit', 'invalid-spatial', 'invalid-pending', 'future', 'broken-json'])('preserves malformed or unsupported records: %s', async fault => {
    const key = studioWorkingCopyKey(scope), token = await persist();
    const record = JSON.parse(token);
    if (fault === 'foreign-scope') record.session.scope.actorId = 'foreign';
    if (fault === 'unknown-field') record.session.privateSnapshot = { cost: 100 };
    if (fault === 'private-edit') record.session.edit.site.privateCost = 100;
    if (fault === 'invalid-spatial') record.session.edit.spatial.pergolas = 'invalid';
    if (fault === 'invalid-pending') record.session.status = 'pending';
    if (fault === 'future') record.schemaVersion = 'studio_working_copy.v99';
    const raw = fault === 'broken-json' ? '{broken' : JSON.stringify(record); db.set(key, raw);
    expect((await readStudioWorkingCopy(scope)).state).toBe(fault === 'future' ? 'unsupported' : 'corrupt');
    expect((await persistStudioWorkingCopy(scope, initial(), raw)).state).toBe('conflict');
    expect(await clearStudioWorkingCopy(scope, raw)).toBe(false);
    expect(db.get(key)).toBe(raw);
  });
  it('returns recovery for orphan, different-body and damaged journal entries without overwriting them', async () => {
    const pending = prepareStudioSave(changed(), requestId), command = pending.pending!.command;
    await stageStudioCommand(scope, command);
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'recovery', session: null });
    const other = structuredClone(pending); other.edit.site.access = 'easy'; other.pending!.command.edit.site.access = 'easy';
    await persist(other);
    expect((await readStudioWorkingCopy(scope)).state).toBe('recovery');
    const key = studioPendingCommandKey(scope, command); db.set(key, { schemaVersion: 'future' });
    expect((await readStudioWorkingCopy(scope)).state).toBe('recovery');
    expect(db.get(key)).toEqual({ schemaVersion: 'future' });
  });
  it('reports storage failures and never sends a request', async () => {
    mocks.update.mockRejectedValueOnce(Error('quota'));
    expect((await persistStudioWorkingCopy(scope, changed(), null)).state).toBe('unavailable');
    mocks.get.mockRejectedValueOnce(Error('blocked'));
    expect((await readStudioWorkingCopy(scope)).state).toBe('unavailable');
    mocks.keys.mockRejectedValueOnce(Error('blocked'));
    expect((await readStudioWorkingCopy(scope)).state).toBe('unavailable');
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it('rejects unsafe writes without storing private data or inconsistent pending generations', async () => {
    const unsafe = initial(); unsafe.edit.site.privateCost = 123;
    expect((await persistStudioWorkingCopy(scope, unsafe, null)).state).toBe('invalid');
    const pending = prepareStudioSave(changed(), requestId); pending.pending!.generation++;
    expect((await persistStudioWorkingCopy(scope, pending, null)).state).toBe('invalid');
    expect(db.size).toBe(0);
  });
  it.each(['uncertain', 'conflict', 'rejected'] as const)('retains %s status with its exact original command', async status => {
    const pending = prepareStudioSave(changed(), requestId);
    const state = settleStudioSave(pending, requestId, { kind: status });
    await stageStudioCommand(scope, pending.pending!.command);
    await persist(state);
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { status, pending: pending.pending } });
  });
  it('checks owner before and after async work and captures immutable caller data', async () => {
    const token = await persist();
    mocks.owner.mockReturnValue(null);
    expect((await readStudioWorkingCopy(scope)).state).toBe('unavailable');
    expect((await persistStudioWorkingCopy(scope, changed(), token)).state).toBe('unavailable');
    mocks.owner.mockReturnValue(scope.actorId);
    mocks.get.mockImplementationOnce(async key => { mocks.owner.mockReturnValue('another'); return db.get(key); });
    expect((await readStudioWorkingCopy(scope)).state).toBe('unavailable');
    mocks.owner.mockReturnValue(scope.actorId);
    mocks.update.mockImplementationOnce(async (key, fn) => { db.set(key, fn(db.get(key))); mocks.owner.mockReturnValue('another'); });
    expect((await persistStudioWorkingCopy(scope, changed(), token)).state).toBe('unavailable');
    mocks.owner.mockReturnValue(scope.actorId);
    const state = changed(), captured = structuredClone(state), rawScope = { ...scope };
    db.clear(); const saving = persistStudioWorkingCopy(rawScope, state, null); state.edit.site.access = 'easy'; rawScope.actorId = 'other';
    expect((await saving).state).toBe('persisted');
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: captured });
  });
  it('only clears the exact clean copy and never clears dirty, pending or newer work', async () => {
    const token = await persist();
    expect(await clearStudioWorkingCopy(scope, 'stale')).toBe(false);
    const next = await persist(changed(), token);
    expect(await clearStudioWorkingCopy(scope, next)).toBe(false);
    db.clear(); const clean = await persist();
    await stageStudioCommand(scope, prepareStudioSave(changed(), requestId).pending!.command);
    expect(await clearStudioWorkingCopy(scope, clean)).toBe(false);
    db.delete(studioPendingCommandKey(scope, prepareStudioSave(changed(), requestId).pending!.command));
    expect(await clearStudioWorkingCopy(scope, clean)).toBe(true);
    expect((await readStudioWorkingCopy(scope)).state).toBe('absent');
  });
});

function websiteSession() {
  const state = initial();
  state.edit.spatial.pergolas = [{ id: 'p1', label: 'Pergola', family: 'mono', attachmentEdgeId: null, attachmentZoneId: null, side: 'rear', strategy: null }];
  state.edit.objectOptions = [{ objectId: 'p1', values: { websiteDesign: newStudioWebsiteDesign('p1') as unknown as import('./contracts').StudioJsonObject } }];
  state.baselinePergolaIds = ['p1']; state.baselineObjectOptions = structuredClone(state.edit.objectOptions);
  return state;
}
describe('website roof transitions through durable session and save', () => {
  it('persists, saves and reloads mono -> gable -> box -> mono without mixing baseline revisions', async () => {
    let state = websiteSession(), token = await persist(state);
    for (const [index, family] of (['gable', 'box', 'mono'] as const).entries()) {
      const next = structuredClone(state.edit);
      next.spatial.pergolas[0].family = family;
      const website = next.objectOptions[0].values.websiteDesign as unknown as ReturnType<typeof newStudioWebsiteDesign>;
      website.selection.roof.family = family;
      state = changeStudioSaveSession(state, next);
      token = await persist(state, token);
      expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { dirty: true, edit: next } });
      const id = `40000000-0000-4000-8000-00000000000${index + 2}`;
      state = prepareStudioSave(state, id); token = await persist(state, token);
      const command = state.pending!.command;
      const saved = { revision: state.baseRevision + 1, savedAt: `2026-09-24T0${index + 2}:00:00Z`, alreadyExisted: false };
      mocks.api.mockResolvedValueOnce({ receipt: saved, pricing: 'unpriced' });
      const result = await sendStudioCommand(scope, command); expect(result.state).toBe('confirmed');
      state = settleStudioSave(state, id, { kind: 'success', receipt: saved }); token = await persist(state, token);
      expect(await acknowledgeStudioCommand(scope, command, { body: JSON.stringify(command), receipt: saved })).toBe(true);
      const reopened = await readStudioWorkingCopy(scope); expect(reopened).toMatchObject({ state: 'valid', session: { dirty: false, baseRevision: saved.revision, edit: { spatial: { pergolas: [{ family }] } } } });
      if (reopened.state !== 'valid') throw Error('Reload failed'); state = reopened.session;
    }
  });
  it('allows saved baseline rows after deletion and new rows after addition without rebinding them', async () => {
    const state = websiteSession(); state.edit.spatial.pergolas = []; state.edit.objectOptions = [];
    await persist(state); expect((await readStudioWorkingCopy(scope)).state).toBe('valid');
    db.clear(); const added = initial(); added.edit = websiteSession().edit;
    await persist(added); expect((await readStudioWorkingCopy(scope)).state).toBe('valid');
  });
  it.each(['missing-ids', 'foreign-row', 'duplicate-row', 'private-field', 'wrong-namespace', 'incoherent-current', 'incoherent-pending'])('rejects unsafe %s while keeping the prior copy unchanged', async fault => {
    const state = websiteSession(), token = await persist(state), changed = structuredClone(state);
    if (fault === 'missing-ids') delete changed.baselinePergolaIds;
    if (fault === 'foreign-row') changed.baselinePergolaIds = ['other'];
    if (fault === 'duplicate-row') changed.baselineObjectOptions!.push(structuredClone(changed.baselineObjectOptions![0]));
    if (fault === 'private-field') changed.baselineObjectOptions![0].values.privateCost = 42;
    if (fault === 'wrong-namespace') (changed.baselineObjectOptions![0].values.websiteDesign as import('./contracts').StudioJsonObject).objectId = 'other';
    if (fault === 'incoherent-current') changed.edit.spatial.pergolas[0].family = 'gable';
    let candidate = changed;
    if (fault === 'incoherent-pending') { candidate = prepareStudioSave(changeStudioSaveSession(changed, changed.edit), requestId); candidate.pending!.command.edit.spatial.pergolas[0].family = 'gable'; }
    expect((await persistStudioWorkingCopy(scope, candidate, token)).state).toBe('invalid');
    expect(db.get(studioWorkingCopyKey(scope))).toBe(token);
  });
  it('retains legacy sessions with neither baseline snapshot field', async () => {
    const state = websiteSession(); delete state.baselineObjectOptions; delete state.baselinePergolaIds;
    await persist(state); expect((await readStudioWorkingCopy(scope)).state).toBe('valid');
  });
});

function freshAuthoring(state = websiteSession()) {
 const { edit } = state;
 return { authoring: { state: 'ready', nextAction: 'edit', view: { schemaVersion: 'studio_authoring_view.v1', designId: scope.designId, revision: 8, spatial: edit.spatial, site: { access: 'easy' }, objectOptions: edit.objectOptions, pricing: 'unpriced' }, estimate: { id: scope.estimateId, projectId: scope.projectId, updatedAt: '2026-09-28T04:00:00Z', requiresNewRevision: false } } };
}
describe('explicit retained-copy recovery', () => {
 it('preserves and verifies full local work before CAS using saved design, with explicit choices-only restore', async () => {
   const old = websiteSession(); old.edit.site.access = 'hard';
   const website = old.edit.objectOptions[0].values.websiteDesign as unknown as ReturnType<typeof newStudioWebsiteDesign>;
   website.rawDimensions.widthMm = 'bad'; website.selection.roof.sidePanels=[defaultSidePanel('left-1of1','timber')]; website.rawGaps={roof:'bad','left-1of1':'27.5'}; website.selection.roof.family = 'gable'; old.edit.spatial.pergolas[0].family = 'gable'; old.dirty = true;
   const token = await persist(old); mocks.api.mockResolvedValueOnce(freshAuthoring());
   const recovered = await useSavedStudioDesign(scope, token);
   expect(recovered.session).toMatchObject({ dirty: false, baseRevision: 8, edit: { site: { access: 'easy' }, spatial: { pergolas: [{ family: 'mono' }] } } });
   const copies = await listStudioRetainedCopies(scope); expect(copies).toHaveLength(1); expect(copies[0].session).toEqual(old);
   const restored = restoreRetainedWebsiteChoices(recovered.session.edit, copies[0]);
   expect(restored.site.access).toBe('easy'); expect(restored.revision).toBe(8);
   expect(restored.objectOptions[0].values.websiteDesign).toEqual(old.edit.objectOptions[0].values.websiteDesign);
   expect(restored.spatial.pergolas[0].family).toBe('gable');
   expect((await readStudioWorkingCopy(scope))).toMatchObject({ state: 'valid', session: recovered.session });
   expect(mocks.api).toHaveBeenCalledTimes(1); expect(mocks.api.mock.calls[0][0]).toMatch(/\/studio$/);
 });
 it('never replaces the live copy when archive readback fails', async () => {
   const token = await persist(websiteSession());
   mocks.get.mockImplementation(async key => String(key).includes(':retained:') ? undefined : structuredClone(db.get(key)));
   await expect(useSavedStudioDesign(scope, token)).rejects.toThrow('verified');
   expect(db.get(studioWorkingCopyKey(scope))).toBe(token); expect(mocks.api).not.toHaveBeenCalled();
 });
 it('keeps both the archive and concurrent live work when CAS loses', async () => {
   const old = websiteSession(), token = await persist(old); let concurrent!: string;
   mocks.api.mockImplementationOnce(async () => { const next = structuredClone(old.edit); next.site.access = 'hard'; concurrent = await persist(changeStudioSaveSession(old, next), token); return freshAuthoring(); });
   await expect(useSavedStudioDesign(scope, token)).rejects.toThrow();
   expect(db.get(studioWorkingCopyKey(scope))).toBe(concurrent); expect((await listStudioRetainedCopies(scope))[0].session).toEqual(old);
 });
 it.each(['actor', 'project', 'locked', 'design'])('rejects changed %s identity before replacement', async fault => {
   const token = await persist(websiteSession()), result = freshAuthoring();
   if (fault === 'project') result.authoring.estimate.projectId = 'proj_other';
   if (fault === 'design') result.authoring.view.designId = 'other';
   if (fault === 'locked') result.authoring.estimate.requiresNewRevision = true;
   mocks.api.mockImplementationOnce(async () => { if (fault === 'actor') mocks.owner.mockReturnValue('other'); return result; });
   await expect(useSavedStudioDesign(scope, token)).rejects.toThrow();
   expect(db.get(studioWorkingCopyKey(scope))).toBe(token);
 });
 it('does not archive or replay an unresolved pending command', async () => {
   const base = websiteSession(), pending = prepareStudioSave(changeStudioSaveSession(base, base.edit), requestId);
   const token = await persist(pending); await stageStudioCommand(scope, pending.pending!.command);
   await expect(retainStudioWorkingCopy(scope, token)).rejects.toThrow('unresolved');
   expect(mocks.api).not.toHaveBeenCalled(); expect((await listStudioRetainedCopies(scope))).toEqual([]);
 });
});
