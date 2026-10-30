import { ApiError } from '@/lib/repo/apiClient';
import {defaultSidePanel} from '@sp/configurator/website';
import { retainStudioWorkingCopy, listStudioRetainedCopies } from './workingCopy';
import { useSavedStudioDesign, restoreRetainedWebsiteChoices } from './workingCopyRecovery';
import { newStudioWebsiteDesign } from './websiteDesign';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStudioSaveSession, changeStudioSaveSession, prepareStudioSave, settleStudioSave } from './saveSession';
import { stageStudioCommand, sendStudioCommand, acknowledgeStudioCommand, retireRejectedStudioCommand, studioPendingCommandKey } from './saveTransport';
import { clearStudioWorkingCopy, persistStudioWorkingCopy, readStudioWorkingCopy, studioWorkingCopyKey } from './workingCopy';
import {parseStudioAuthoringEdit, mergeStudioAuthoringEdit} from './authoringView';
import {readStudioRequestBody} from './readRequestBody.server';

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
function capacitySession(length=1_800_000) {
  const base=initial();
  return createStudioSaveSession(scope,{...base.edit,schemaVersion:'studio_authoring_view.v1',pricing:'unpriced',
    site:{access:'normal',travelExGst:'0'.repeat(length)}},base.baseUpdatedAt);
}

describe('studio durable working copy', () => {
  it.each(['stale','foreign','malformed','oversized'] as const)('retires optional %s history without rejecting current recovery or altering its token',async fault=>{
    const state=changed(), token=await persist(state), raw=JSON.parse(token);
    raw.session.history={generation:state.generation,revision:state.baseRevision,past:[{edit:structuredClone(state.edit)}],future:[]};
    if(fault==='stale')raw.session.history.generation=-1;
    if(fault==='foreign')raw.session.history.past[0].edit.designId='foreign';
    if(fault==='malformed')raw.session.history.past[0].edit.site.privateCost=100;
    if(fault==='oversized')raw.session.history.past[0].edit.site.travelExGst='0'.repeat(1_100_000);
    const retained=JSON.stringify(raw);db.set(studioWorkingCopyKey(scope),retained);
    const read=await readStudioWorkingCopy(scope);expect(read.state).toBe('valid');if(read.state!=='valid')throw Error();
    expect(read.session.history).toBeUndefined();expect(read.session.edit).toEqual(state.edit);expect(read.token).toBe(retained);
    expect(db.get(studioWorkingCopyKey(scope))).toBe(retained);expect(mocks.api).not.toHaveBeenCalled();
  });
  it('yields history capacity before the acknowledged baseline, retaining exact current and frozen sent work',async()=>{
    const base=capacitySession(1_500_000),edit=structuredClone(base.edit);edit.site.access='hard';
    const pending=prepareStudioSave(changeStudioSaveSession(base,edit),requestId);
    const prior=structuredClone(base.edit);prior.site.travelExGst='0'.repeat(900_000);
    pending.history={generation:pending.generation,revision:pending.baseRevision,past:[{edit:prior}],future:[]};
    expect(new TextEncoder().encode(JSON.stringify(pending)).length).toBeGreaterThan(5*1024*1024);
    const original=structuredClone(pending),token=await persist(pending),saved=JSON.parse(token).session;
    expect(saved).not.toHaveProperty('history');expect(saved.acknowledged).toEqual(original.acknowledged);
    expect(saved.edit).toEqual(original.edit);expect(saved.pending).toEqual(original.pending);expect(pending).toEqual(original);
    expect((await stageStudioCommand(scope,pending.pending!.command)).state).toBe('valid');
    expect((await readStudioWorkingCopy(scope)).state).toBe('valid');
  });
  it.each(['foreign-baseline','private-baseline','inconsistent-clean'] as const)('validates oversized %s before any metadata omission', async fault => {
    const base=capacitySession(),edit=structuredClone(base.edit);edit.site.access='hard';
    const dirty=changeStudioSaveSession(base,edit),token=await persist(dirty);
    const pending=prepareStudioSave(dirty,requestId);
    if(fault==='foreign-baseline')pending.acknowledged!.scope.actorId='foreign';
    if(fault==='private-baseline')pending.acknowledged!.edit.site.privateCost=100;
    if(fault==='inconsistent-clean')pending.dirty=false;
    expect(new TextEncoder().encode(JSON.stringify(pending)).length).toBeGreaterThan(5*1024*1024);
    expect((await persistStudioWorkingCopy(scope,pending,token)).state).toBe('invalid');
    expect(db.get(studioWorkingCopyKey(scope))).toBe(token);
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it.each(['cas','quota','owner'] as const)('preserves fallback persistence and ownership fences through %s failure', async fault=>{
    const base=capacitySession(),edit=structuredClone(base.edit);edit.site.access='hard';
    const dirty=changeStudioSaveSession(base,edit),token=await persist(dirty),pending=prepareStudioSave(dirty,requestId);
    const key=studioWorkingCopyKey(scope);
    if(fault==='cas'){const replacement=JSON.parse(token);replacement.session.generation=99;db.set(key,JSON.stringify(replacement));}
    if(fault==='quota')mocks.update.mockRejectedValueOnce(Error('quota'));
    if(fault==='owner')mocks.owner.mockReturnValue(null);
    const retained=db.get(key),baseline=structuredClone(pending.acknowledged);
    expect((await persistStudioWorkingCopy(scope,pending,token)).state).toBe(fault==='cas'?'conflict':'unavailable');
    expect(db.get(key)).toBe(retained);expect(pending.acknowledged).toEqual(baseline);
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it('retains an oversized pending refusal while allowing the existing large local copy and archive to remain readable',async()=>{
    // The wire body here exceeds 2MiB and is deliberately NOT a supported-save
    // claim. Its existing local copy may still open so the raw work can be reduced.
    const base=capacitySession(3_100_000),edit=structuredClone(base.edit);edit.site.access='hard';
    const dirty=changeStudioSaveSession(base,edit),token=await persist(dirty);
    expect(JSON.parse(token).session).not.toHaveProperty('acknowledged');
    const pending=prepareStudioSave(dirty,requestId),wire=JSON.stringify(pending.pending!.command);
    await expect(readStudioRequestBody(new Request('http://localhost/studio',{method:'POST',body:wire}),2*1024*1024)).rejects.toThrow('Oversized request');
    expect((await persistStudioWorkingCopy(scope,pending,token))).toMatchObject({state:'invalid',message:'The working copy exceeds the supported size.'});
    expect(db.get(studioWorkingCopyKey(scope))).toBe(token);
    expect(await readStudioWorkingCopy(scope)).toMatchObject({state:'valid',token,session:{edit:dirty.edit,dirty:true}});
    await retainStudioWorkingCopy(scope,token);
    expect((await listStudioRetainedCopies(scope))[0].session.edit).toEqual(dirty.edit);
    expect(pending.acknowledged).toEqual(dirty.acknowledged);
  });
  it('preserves supported raw-command capacity through pending persistence and real journal staging', async () => {
    const base=initial();
    const view={...base.edit,schemaVersion:'studio_authoring_view.v1' as const,pricing:'unpriced' as const,
      site:{access:'normal',travelExGst:'0'.repeat(1_800_000)}};
    const saved=createStudioSaveSession(scope,view,base.baseUpdatedAt);
    const edit=structuredClone(saved.edit);edit.site.access='hard';
    const dirty=changeStudioSaveSession(saved,edit),first=await persist(dirty);
    const pending=prepareStudioSave(dirty,requestId),original=structuredClone(pending);
    const command=pending.pending!.command,wire=JSON.stringify(command);
    expect(new TextEncoder().encode(wire).length).toBeLessThan(2*1024*1024);
    expect(await readStudioRequestBody(new Request('http://localhost/api/estimates/example/studio',{method:'POST',body:wire}),2*1024*1024)).toEqual(command);
    expect(parseStudioAuthoringEdit(command.edit).ok).toBe(true);
    const stored={schemaVersion:'studio_authored.v1',designId:view.designId,revision:view.revision,spatialOutputKey:'drawing_object_first',site:{validation:'preserved_unvalidated',values:view.site},objectOptions:[],legacyCommercialAssociations:[],provenance:{sourceEstimateId:null,sourceKind:'authored',sourcePayload:null}};
    expect(mergeStudioAuthoringEdit({storedAuthored:stored,storedSpatial:view.spatial,edit:command.edit}).ok).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify({schemaVersion:'studio_working_copy.v1',session:pending})).length).toBeGreaterThan(5*1024*1024);
    const result=await persistStudioWorkingCopy(scope,pending,first);
    expect(result.state).toBe('persisted');if(result.state!=='persisted')throw Error('Supported pending copy refused');
    const serialized=JSON.parse(result.token);
    expect(new TextEncoder().encode(result.token).length).toBeLessThanOrEqual(5*1024*1024);
    expect(serialized.session).not.toHaveProperty('acknowledged');
    const {acknowledged,history,...withoutOptional}=original;
    expect(serialized.session).toEqual(withoutOptional);
    expect(acknowledged).toEqual(pending.acknowledged);
    expect(history).toEqual(pending.history);
    expect(history?.past).toHaveLength(1);
    expect(pending).toEqual(original);
    expect((await stageStudioCommand(scope,command)).state).toBe('valid');
    expect(await readStudioWorkingCopy(scope)).toMatchObject({state:'valid',token:result.token,session:withoutOptional});
    expect(db.get(studioWorkingCopyKey(scope))).toBe(result.token);
  });
  it('roundtrips the independent acknowledged authoring baseline and permits legacy absence without certifying it', async () => {
    const state = changed(), token = await persist(state);
    const found = await readStudioWorkingCopy(scope);
    expect(found).toMatchObject({state:'valid',session:{acknowledged:initial().acknowledged,dirty:true}});
    expect(state.acknowledged?.edit.site.access).toBe('normal');
    const legacy = JSON.parse(token); delete legacy.session.acknowledged;
    const raw = JSON.stringify(legacy); db.set(studioWorkingCopyKey(scope), raw);
    expect(await readStudioWorkingCopy(scope)).toMatchObject({state:'valid',session:{dirty:true,edit:{site:{access:'hard'}}}});
    expect(db.get(studioWorkingCopyKey(scope))).toBe(raw);
  });
  it.each(['foreign-scope','revision','timestamp','private-field','live-delete','live-copy','false-clean','unknown-field'] as const)('retains malformed/inconsistent acknowledged metadata: %s', async fault => {
    const token = await persist(), stored = JSON.parse(token), state = stored.session;
    if (fault === 'foreign-scope') state.acknowledged.scope.actorId = 'foreign';
    if (fault === 'revision') state.acknowledged.edit.revision++;
    if (fault === 'timestamp') state.acknowledged.updatedAt = receipt.savedAt;
    if (fault === 'private-field') state.acknowledged.edit.site.privateCost = 100;
    if (fault === 'live-delete') state.acknowledged.edit.deletions = [{scope:'site',collection:'blinds.items',ids:['a']}];
    if (fault === 'live-copy') { state.acknowledged.edit.schemaVersion='studio_authoring_edit.v2'; state.acknowledged.edit.duplications=[{targetId:'unknown'}]; }
    if (fault === 'false-clean') state.acknowledged.edit.site.access = 'hard';
    if (fault === 'unknown-field') state.acknowledged.cost = 100;
    const raw = JSON.stringify(stored); db.set(studioWorkingCopyKey(scope),raw);
    expect(await readStudioWorkingCopy(scope)).toMatchObject({state:'corrupt'});
    expect(db.get(studioWorkingCopyKey(scope))).toBe(raw);
    expect((await persistStudioWorkingCopy(scope, initial(),raw)).state).toBe('conflict');
  });
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
  // This fixture represents a saved product, not an unaccepted mutation of a
  // clean empty view. Seed every acknowledged baseline from that saved view.
  return createStudioSaveSession(scope, {...state.edit, schemaVersion:'studio_authoring_view.v1', pricing:'unpriced'}, state.baseUpdatedAt);
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
    await persist(changeStudioSaveSession(state, state.edit)); expect((await readStudioWorkingCopy(scope)).state).toBe('valid');
    db.clear(); const added = initial(); added.edit = websiteSession().edit;
    await persist(changeStudioSaveSession(added, added.edit)); expect((await readStudioWorkingCopy(scope)).state).toBe('valid');
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
    if (fault === 'incoherent-pending') { const edit=structuredClone(changed.edit); edit.site.access='hard'; candidate = prepareStudioSave(changeStudioSaveSession(changed, edit), requestId); expect(candidate.pending).not.toBeNull(); candidate.pending!.command.edit.spatial.pergolas[0].family = 'gable'; }
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
   const base = websiteSession(), edit = structuredClone(base.edit); edit.site.access='hard';
   const pending = prepareStudioSave(changeStudioSaveSession(base, edit), requestId); expect(pending.pending).not.toBeNull();
   const token = await persist(pending); await stageStudioCommand(scope, pending.pending!.command);
   await expect(retainStudioWorkingCopy(scope, token)).rejects.toThrow('unresolved');
   expect(mocks.api).not.toHaveBeenCalled(); expect((await listStudioRetainedCopies(scope))).toEqual([]);
 });
});


describe('definitively rejected journal recovery fences',()=>{
 it.each([401,403,404,500])('never treats %s access or transport failure as permission to use saved',async status=>{
  const pending=prepareStudioSave(changed(),requestId),token=await persist(pending);
  mocks.api.mockRejectedValueOnce(new ApiError('unconfirmed',{status,body:{}}));
  await sendStudioCommand(scope,pending.pending!.command);const before=structuredClone([...db]);mocks.api.mockClear();
  await expect(useSavedStudioDesign(scope,token,pending)).rejects.toThrow('unresolved');
  expect([...db]).toEqual(before);expect(mocks.api).not.toHaveBeenCalled();
 });
 it.each(['body','receipt','status','owner','lifecycle'] as const)('conditionally refuses retirement when %s changes at its atomic update',async fault=>{
  const pending=prepareStudioSave(changed(),requestId);await persist(pending);
  mocks.api.mockRejectedValueOnce(new ApiError('stale',{status:409,body:{}}));await sendStudioCommand(scope,pending.pending!.command);
  const key=studioPendingCommandKey(scope,pending.pending!.command),discovered=await readStudioWorkingCopy(scope);
  if(discovered.state!=='recovery'||discovered.journal.entries[0].recovery.state!=='valid')throw Error();
  const expected=discovered.journal.entries[0].recovery,update=mocks.update.getMockImplementation()!;let allowed=true;
  mocks.update.mockImplementationOnce((name,fn)=>{
   const row=structuredClone(db.get(key)) as any;
   if(fault==='body'){const body=JSON.parse(row.body);body.edit.site.access='easy';row.body=JSON.stringify(body);}
   if(fault==='receipt'){row.receipt=receipt;row.rejectedStatus=null;}
   if(fault==='status')row.rejectedStatus=null;
   if(fault==='owner')mocks.owner.mockReturnValue('other');
   if(fault==='lifecycle')allowed=false;
   db.set(key,row);return update(name,fn);
  });
  expect(await retireRejectedStudioCommand(scope,expected,()=>allowed)).toBe(false);
  expect(db.get(key)).toBeDefined();expect(db.get(key)).not.toBeUndefined();
 });
 it('leaves rejected bytes intact when recovery loses its lifecycle while loading the fresh saved design',async()=>{
  const pending=prepareStudioSave(changed(),requestId),token=await persist(pending);
  mocks.api.mockRejectedValueOnce(new ApiError('stale',{status:409,body:{}}));await sendStudioCommand(scope,pending.pending!.command);
  const key=studioWorkingCopyKey(scope),journalKey=studioPendingCommandKey(scope,pending.pending!.command),journal=structuredClone(db.get(journalKey));let allowed=true;
  mocks.api.mockImplementationOnce(async()=>{allowed=false;return freshAuthoring();});
  await expect(useSavedStudioDesign(scope,token,pending,()=>allowed)).rejects.toThrow('verified');
  expect(db.get(key)).toBe(token);expect(db.get(journalKey)).toEqual(journal);expect((await listStudioRetainedCopies(scope))[0].session).toEqual(pending);
 });
 it('handles all known rejected remnants but refuses an additional unresolved command',async()=>{
  const first=prepareStudioSave(changed(),requestId),token=await persist(first);
  mocks.api.mockRejectedValueOnce(new ApiError('stale',{status:409,body:{}}));await sendStudioCommand(scope,first.pending!.command);
  const second={...first.pending!.command,requestId:'40000000-0000-4000-8000-000000000002'};
  await stageStudioCommand(scope,second);const before=structuredClone([...db]);
  await expect(useSavedStudioDesign(scope,token)).rejects.toThrow('unresolved');expect([...db]).toEqual(before);
  mocks.api.mockRejectedValueOnce(new ApiError('invalid',{status:422,body:{}}));await sendStudioCommand(scope,second);
  mocks.api.mockResolvedValueOnce(freshAuthoring());const recovered=await useSavedStudioDesign(scope,token);
  expect(recovered.retained.session).toEqual(first);expect((await readStudioWorkingCopy(scope)).state).toBe('valid');
  expect(recovered.session.baseRevision).toBe(8);
 });
});

describe('explicit recovery preserves raw storage and late journals',()=>{
 it('preserves the original durable token even when optional history is ignored during reading',async()=>{
  const state=changed(),token=await persist(state),raw=JSON.parse(token);
  raw.session.history={generation:-1,revision:state.baseRevision,past:[],future:[]};
  const original=JSON.stringify(raw);db.set(studioWorkingCopyKey(scope),original);
  const retained=await retainStudioWorkingCopy(scope,original);
  expect(JSON.parse(db.get(retained.key) as string).workingCopyToken).toBe(original);
  expect(retained.session.edit).toEqual(state.edit);
 });
 it('does not claim ready recovery if another unresolved journal arrives without changing the working-copy token',async()=>{
  const old=changed(),token=await persist(old),command=prepareStudioSave(old,requestId).pending!.command;
  mocks.api.mockImplementationOnce(async()=>{await stageStudioCommand(scope,command);return freshAuthoring();});
  await expect(useSavedStudioDesign(scope,token)).rejects.toThrow('reconciliation');
  const recovered=await readStudioWorkingCopy(scope);
  expect(recovered).toMatchObject({state:'recovery',session:{baseRevision:8,pending:null},journal:{entries:[{recovery:{command,receipt:null,rejectedStatus:null}}]}});
  expect((await listStudioRetainedCopies(scope))[0].session).toEqual(old);
 });
 it.each([401,403,404])('preserves historical recorded %s access evidence as unresolved',async status=>{
  const pending=prepareStudioSave(changed(),requestId),token=await persist(pending);
  await stageStudioCommand(scope,pending.pending!.command);
  const key=studioPendingCommandKey(scope,pending.pending!.command),row=structuredClone(db.get(key)) as Record<string,unknown>;
  row.rejectedStatus=status;db.set(key,row);const before=structuredClone([...db]);
  await expect(useSavedStudioDesign(scope,token)).rejects.toThrow('unresolved');
  expect([...db]).toEqual(before);expect(mocks.api).not.toHaveBeenCalled();
 });
});
