import { describe, expect, it } from 'vitest';
import { STUDIO_AUTHORING_VIEW_SCHEMA, mergeStudioAuthoringEdit, projectStudioAuthoringView, type StudioAuthoringView } from './authoringView';
import { addWebsitePergola } from './websiteComposition';
import { applyStudioPergolaEdit } from './pergolaEditing';
import { changeStudioSaveSession, createStudioSaveSession, discardRejectedStudioRequest, prepareStudioSave, settleStudioSave, rebaseStudioUndoEdit, reconcileStudioSaveBaseline } from './saveSession';

const scope={actorId:'actor',projectId:'project',estimateId:'estimate',designId:'design'};
const view=():StudioAuthoringView=>({schemaVersion:STUDIO_AUTHORING_VIEW_SCHEMA,designId:'design',revision:3,
  spatial:{houseAssembly:null,decks:[],openings:[],pergolas:[]},site:{access:'normal'},objectOptions:[],pricing:'unpriced'});
const initial=()=>createStudioSaveSession(scope,view(),'2026-09-24T00:00:00Z');
const receipt={revision:4,savedAt:'2026-09-24T01:00:00Z',alreadyExisted:false};
const changed=()=>{const state=initial();state.edit.site.access='hard';return changeStudioSaveSession(initial(),state.edit);};

describe('studio working save session',()=>{
  it('does not save a clean design and rejects injected private fields',()=>{
    expect(prepareStudioSave(initial(),'one').pending).toBeNull();
    const edit=initial().edit;edit.site.privateCost=123;
    expect(()=>changeStudioSaveSession(initial(),edit)).toThrow('Invalid working design');
  });
  it('freezes one request while subsequent local edits continue',()=>{
    const pending=prepareStudioSave(changed(),'one');
    const edit=structuredClone(pending.edit);edit.site.access='easy';
    const later=changeStudioSaveSession(pending,edit);
    expect(prepareStudioSave(later,'two').pending?.command).toEqual(pending.pending?.command);
    const saved=settleStudioSave(later,'one',{kind:'success',receipt});
    expect(saved).toMatchObject({dirty:true,baseRevision:4,pending:null,edit:{revision:4,site:{access:'easy'}}});
    expect(prepareStudioSave(saved,'two').pending?.command).toMatchObject({requestId:'two',expectedRevision:4,expectedUpdatedAt:receipt.savedAt});
  });
  it('keeps exact identity after uncertain response and clears only the matching generation',()=>{
    const pending=prepareStudioSave(changed(),'one');
    const uncertain=settleStudioSave(pending,'one',{kind:'uncertain'});
    expect(prepareStudioSave(uncertain,'two').pending).toEqual(pending.pending);
    expect(()=>discardRejectedStudioRequest(uncertain)).toThrow();
    expect(settleStudioSave(uncertain,'one',{kind:'success',receipt:{...receipt,alreadyExisted:true}})).toMatchObject({dirty:false,pending:null,status:'idle'});
  });
  it('ignores an old unrelated completion and retains work on conflict',()=>{
    const pending=prepareStudioSave(changed(),'one');
    expect(settleStudioSave(pending,'old',{kind:'success',receipt})).toEqual(pending);
    const conflict=settleStudioSave(pending,'one',{kind:'conflict'});
    expect(conflict).toMatchObject({dirty:true,status:'conflict',edit:{site:{access:'hard'}}});
    expect(()=>discardRejectedStudioRequest(conflict)).toThrow();
    expect(()=>prepareStudioSave(conflict,'two')).toThrow();
  });
  it('removes only acknowledged deletion ids before saving later edits',()=>{
    const state=changed();state.edit.deletions=[{scope:'site',collection:'blinds.items',ids:['a']}];
    const pending=prepareStudioSave(state,'one');
    const edit=structuredClone(pending.edit);edit.deletions=[{scope:'site',collection:'blinds.items',ids:['a','b']}];
    const later=changeStudioSaveSession(pending,edit);
    expect(settleStudioSave(later,'one',{kind:'success',receipt}).edit.deletions).toEqual([{scope:'site',collection:'blinds.items',ids:['b']}]);
  });
  it('allows correction only after a definitive rejection and rejects malformed receipts',()=>{
    const pending=prepareStudioSave(changed(),'one');
    expect(discardRejectedStudioRequest(settleStudioSave(pending,'one',{kind:'rejected'}))).toMatchObject({dirty:true,pending:null,status:'idle'});
    expect(settleStudioSave(pending,'one',{kind:'success',receipt:{...receipt,revision:99}}).status).toBe('uncertain');
    expect(settleStudioSave(pending,'one',{kind:'success',receipt:{...receipt,savedAt:'invalid'}}).status).toBe('uncertain');
  });
});

describe('acknowledged full authoring equality', () => {
  it('keeps the verified baseline independent and advances generation even for identical edits and full site revert', () => {
    const source = view(), state = createStudioSaveSession(scope, source, null);
    source.site.access = 'hard';
    const noOp = changeStudioSaveSession(state, structuredClone(state.edit));
    expect(noOp).toMatchObject({ generation: 1, dirty: false });
    const next = structuredClone(noOp.edit); next.site.access = 'hard';
    const dirty = changeStudioSaveSession(noOp, next);
    next.site.access = 'easy';
    expect(dirty.edit.site.access).toBe('hard');
    expect(dirty.acknowledged?.edit.site.access).toBe('normal');
    const reverted = changeStudioSaveSession(dirty, rebaseStudioUndoEdit(state.edit, dirty));
    expect(reverted.edit).toEqual(state.edit);
    expect(reverted).toMatchObject({ generation: 3, dirty: false });
  });
  it('ignores object insertion order and only root transport revision/schema and empty-copy representation', () => {
    const state = initial();
    const edit = { ...state.edit, schemaVersion: 'studio_authoring_edit.v2' as const, duplications: [] };
    edit.site = { travelExGst: '1', access: 'normal' };
    const base = view(); base.site = { access: 'normal', travelExGst: '1' };
    expect(changeStudioSaveSession(createStudioSaveSession(scope, base, null), edit).dirty).toBe(false);
    const dirty = changed();
    const v2 = changeStudioSaveSession(dirty, {...dirty.edit,schemaVersion:'studio_authoring_edit.v2',duplications:[]});
    const ack = settleStudioSave(prepareStudioSave(v2, 'one'), 'one', { kind: 'success', receipt });
    expect(ack.acknowledged!.edit).toMatchObject({schemaVersion:'studio_authoring_edit.v2',duplications:[]});
    const v1 = { ...ack.edit, schemaVersion: 'studio_authoring_edit.v1' as const };
    delete v1.duplications;
    expect(changeStudioSaveSession(ack, v1).dirty).toBe(false);
    expect(ack.acknowledged?.edit.revision).toBe(receipt.revision);
  });
  it('retains raw spelling, meaningful field presence, row order and live tombstones', () => {
    const saved = view(); saved.site = { travelExGst: '1', additionalAluminium: {rows: [
      { id: 'a', profile: 'historical', stockLengthM: '6', quantity: '1' },
      { id: 'b', profile: 'historical', stockLengthM: '6', quantity: '1' },
    ]} };
    const state = createStudioSaveSession(scope, saved, null);
    for (const mutate of [
      (e: typeof state.edit) => { e.site.travelExGst = '1.00'; },
      (e: typeof state.edit) => { e.site.extrasAllowanceExGst = ''; },
      (e: typeof state.edit) => { (e.site.additionalAluminium as {rows: unknown[]}).rows.reverse(); },
      (e: typeof state.edit) => { e.deletions = [{ scope: 'site', collection: 'blinds.items', ids: ['hidden'] }]; },
    ]) {
      const edit = structuredClone(state.edit); mutate(edit);
      expect(changeStudioSaveSession(state, edit).dirty).toBe(true);
    }
  });
  it.each(['return-to-old-base', 'return-to-sent'] as const)('baselines the frozen sent edit after %s, not the current generation', kind => {
    const pending = prepareStudioSave(changed(), 'one');
    const first = changeStudioSaveSession(pending, initial().edit);
    expect(first.dirty).toBe(true);
    const later = kind === 'return-to-sent' ? changeStudioSaveSession(first, pending.pending!.command.edit) : first;
    const frozen = structuredClone(later.pending!.command);
    const ack = settleStudioSave(later, 'one', { kind: 'success', receipt });
    expect(ack.acknowledged?.edit.site.access).toBe('hard');
    expect(ack.dirty).toBe(kind !== 'return-to-sent');
    expect(ack.generation).toBe(later.generation);
    expect(later.pending!.command).toEqual(frozen);
    const afterSaveUndo = changeStudioSaveSession(ack, rebaseStudioUndoEdit(initial().edit, ack));
    expect(afterSaveUndo.dirty).toBe(true);
  });
  it.each(['uncertain', 'conflict', 'rejected'] as const)('retains dirty write authority through %s even when content returns to base', kind => {
    const pending = prepareStudioSave(changed(), 'one');
    const current = changeStudioSaveSession(pending, initial().edit);
    const failed = settleStudioSave(current, 'one', { kind });
    expect(failed).toMatchObject({ status: kind, dirty: true, pending: pending.pending });
    expect(failed.acknowledged).toEqual(pending.acknowledged);
    expect(settleStudioSave(failed, 'old', {kind:'success',receipt})).toEqual(failed);
    expect(settleStudioSave(failed, 'one', {kind:'success',receipt:{...receipt,revision:99}}).acknowledged).toEqual(failed.acknowledged);
    if (kind === 'rejected') expect(discardRejectedStudioRequest(failed)).toMatchObject({ dirty: false, pending: null, status: 'idle' });
  });
  it('seeds legacy metadata only from the matching verified saved view and refuses foreign or inconsistent baselines', () => {
    const state = changed(); delete state.acknowledged;
    const reconciled = reconcileStudioSaveBaseline(state, view(), state.baseUpdatedAt);
    expect(reconciled.dirty).toBe(true);
    expect(reconciled.acknowledged?.edit.site.access).toBe('normal');
    expect(state.acknowledged).toBeUndefined();
    expect(() => reconcileStudioSaveBaseline(state, {...view(),revision:4}, state.baseUpdatedAt)).toThrow();
    expect(() => reconcileStudioSaveBaseline(state, view(), receipt.savedAt)).toThrow();
    const foreign = initial(); foreign.acknowledged!.scope.actorId = 'foreign';
    expect(() => reconcileStudioSaveBaseline(foreign, view(), foreign.baseUpdatedAt)).toThrow();
    const wrong = initial(); wrong.acknowledged!.edit.site.access = 'easy';
    expect(() => reconcileStudioSaveBaseline(wrong, view(), wrong.baseUpdatedAt)).toThrow();
  });
});

describe('complete Undo intent across a frozen or acknowledged save', () => {
  const base = () => {
    const edit = addWebsitePergola(initial().edit, 'source');
    return createStudioSaveSession(scope, {...edit, schemaVersion:STUDIO_AUTHORING_VIEW_SCHEMA, pricing:'unpriced'}, initial().baseUpdatedAt);
  };
  const mergeSaved = (saved: ReturnType<typeof initial>, edit: typeof saved.edit) => {
    const acknowledged = saved.acknowledged!.edit;
    const authored = {schemaVersion:'studio_authored.v1',designId:scope.designId,revision:saved.baseRevision,spatialOutputKey:'drawing_object_first',
      site:{validation:'preserved_unvalidated',values:acknowledged.site},objectOptions:acknowledged.objectOptions.map(row=>({objectId:row.objectId,options:{validation:'preserved_unvalidated',values:row.values}})),
      legacyCommercialAssociations:[],provenance:{sourceEstimateId:null,sourceKind:'authored',sourcePayload:null}};
    const merged = mergeStudioAuthoringEdit({storedAuthored:authored,storedSpatial:acknowledged.spatial,edit});
    expect(merged.ok).toBe(true); if(!merged.ok)throw Error(merged.message);
    const projected = projectStudioAuthoringView({authored:merged.value.authored,spatial:merged.value.spatial});
    expect(projected.ok).toBe(true);if(!projected.ok)throw Error(projected.message);
    return projected.value;
  };
  it.each(['add','duplicate','remove'] as const)('can merge and reopen %s Undo before or after acknowledgement without replaying the frozen command',kind=>{
    for(const timing of ['pending','acknowledged']) {
      const saved=base();
      const changed=kind==='add'?addWebsitePergola(saved.edit,'extra'):applyStudioPergolaEdit(saved.edit,kind==='duplicate'
        ?{kind,pergolaId:'source',id:'extra',rowIds:{flashings:{},infills:{}}}:{kind,pergolaId:'source'},
        {persistedObjectIds:saved.baselinePergolaIds!,baselineObjectOptions:saved.baselineObjectOptions});
      if('ok' in changed&&!changed.ok)throw Error(changed.message);
      const edit='ok' in changed?changed.edit:changed;
      const pending=prepareStudioSave(changeStudioSaveSession(saved,edit),'one'),frozen=structuredClone(pending.pending!.command);
      let current=timing==='pending'?pending:settleStudioSave(pending,'one',{kind:'success',receipt});
      current=changeStudioSaveSession(current,rebaseStudioUndoEdit(saved.edit,current));
      if(timing==='pending') {
        expect(current.pending!.command).toEqual(frozen);
        current=settleStudioSave(current,'one',{kind:'success',receipt});
      }
      expect(current.dirty).toBe(true);
      expect(current.edit.duplications??[]).toEqual([]);
      const reopened=mergeSaved(current,current.edit);
      expect(reopened.spatial).toEqual(saved.edit.spatial);
      expect(reopened.objectOptions).toEqual(saved.edit.objectOptions);
      const again=prepareStudioSave(current,'two'),secondReceipt={...receipt,revision:5};
      const final=settleStudioSave(again,'two',{kind:'success',receipt:secondReceipt});
      expect(final).toMatchObject({dirty:false,pending:null,edit:{deletions:[]}});
      expect(final.acknowledged!.edit.objectOptions).toEqual(saved.edit.objectOptions);
    }
  });
  it.each(['blinds.items','additionalAluminium.rows','standaloneInfills.items','flashings.rows','infills.items','ceilingOption'])('expresses existing explicit removal semantics for newly saved %s intent',field=>{
    const saved=base(),edit=structuredClone(saved.edit);
    const [section,collection]=field.split('.');
    const site=['blinds','additionalAluminium','standaloneInfills'].includes(section);
    const target=site?edit.site:edit.objectOptions[0].values;
    if(collection)target[section]={[collection]:[{id:'added'}]};else target.ceilingOption='cedar-100';
    const pending=prepareStudioSave(changeStudioSaveSession(saved,edit),'one');
    const acknowledged=settleStudioSave(pending,'one',{kind:'success',receipt});
    const undone=changeStudioSaveSession(acknowledged,rebaseStudioUndoEdit(saved.edit,acknowledged));
    const reopened=mergeSaved(undone,undone.edit),restored=site?reopened.site:reopened.objectOptions[0].values;
    if(collection)expect((restored[section] as Record<string,unknown>)[collection]).toEqual([]);
    else expect(restored).not.toHaveProperty('ceilingOption');
  });
  it.each(['ceilingOption','flashings.rows','infills.items'])('removes newly saved %s when the prior valid public view had no options row, before or after acknowledgement',field=>{
    for(const timing of ['pending','acknowledged']) {
      const geometry=base().edit;
      const saved=createStudioSaveSession(scope,{...geometry,schemaVersion:STUDIO_AUTHORING_VIEW_SCHEMA,pricing:'unpriced',objectOptions:[]},initial().baseUpdatedAt);
      const [section,collection]=field.split('.');
      const values=collection?{[section]:{[collection]:[{id:'added'}]}}:{ceilingOption:'cedar-100'};
      const edited={...structuredClone(saved.edit),objectOptions:[{objectId:'source',values}]};
      const pending=prepareStudioSave(changeStudioSaveSession(saved,edited),'one'),frozen=structuredClone(pending.pending!.command);
      let current=timing==='pending'?pending:settleStudioSave(pending,'one',{kind:'success',receipt});
      current=changeStudioSaveSession(current,rebaseStudioUndoEdit(saved.edit,current));
      expect(current.edit.deletions).toContainEqual(collection
        ?{scope:'object',objectId:'source',collection:field,ids:['added']}
        :{scope:'object-option',objectId:'source',field:'ceilingOption'});
      expect(current.edit.deletions.some(d=>d.scope==='object-options')).toBe(false);
      if(timing==='pending') {
        expect(current.pending!.command).toEqual(frozen);
        current=settleStudioSave(current,'one',{kind:'success',receipt});
      }
      const reopened=mergeSaved(current,current.edit);
      expect(reopened.spatial).toEqual(saved.edit.spatial);
      const restored=reopened.objectOptions.find(row=>row.objectId==='source')!.values;
      if(collection)expect((restored[section] as Record<string,unknown>)[collection]).toEqual([]);
      else expect(restored).not.toHaveProperty('ceilingOption');
      const secondPending=prepareStudioSave(current,'two');
      const secondView={...mergeSaved(current,secondPending.pending!.command.edit),revision:5};
      const second=settleStudioSave(secondPending,'two',{kind:'success',receipt:{...receipt,revision:5}});
      expect(()=>reconcileStudioSaveBaseline(second,secondView,receipt.savedAt)).not.toThrow();
      expect(second).toMatchObject({dirty:false,edit:{objectOptions:secondView.objectOptions,deletions:[]}});
    }
  });
  it('uses only supported field removal when an absent public row has retained unknown server metadata',()=>{
    const saved=createStudioSaveSession(scope,{...base().edit,schemaVersion:STUDIO_AUTHORING_VIEW_SCHEMA,pricing:'unpriced',objectOptions:[]},initial().baseUpdatedAt);
    const edit={...structuredClone(saved.edit),objectOptions:[{objectId:'source',values:{ceilingOption:'cedar-100'}}]};
    const current=settleStudioSave(prepareStudioSave(changeStudioSaveSession(saved,edit),'one'),'one',{kind:'success',receipt});
    const undone=rebaseStudioUndoEdit(saved.edit,current),ack=current.acknowledged!.edit;
    const preserved={raw:' 0.00 ',privateValues:['unchanged']};
    const merged=mergeStudioAuthoringEdit({storedAuthored:{schemaVersion:'studio_authored.v1',designId:scope.designId,revision:4,spatialOutputKey:'drawing_object_first',
      site:{validation:'preserved_unvalidated',values:ack.site},objectOptions:[{objectId:'source',options:{validation:'preserved_unvalidated',values:{ceilingOption:'cedar-100',retainedUnknown:preserved}}}],
      legacyCommercialAssociations:[],provenance:{sourceEstimateId:null,sourceKind:'authored',sourcePayload:null}},storedSpatial:ack.spatial,edit:undone});
    expect(merged.ok).toBe(true);if(!merged.ok)throw Error(merged.message);
    expect(merged.value.authored.objectOptions[0].options.values).toEqual({retainedUnknown:preserved});
    expect(undone.objectOptions).toEqual([{objectId:'source',values:{}}]);
  });
});
