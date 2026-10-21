import { describe, expect, it } from 'vitest';
import { STUDIO_AUTHORING_VIEW_SCHEMA, type StudioAuthoringView } from './authoringView';
import { changeStudioSaveSession, createStudioSaveSession, discardRejectedStudioRequest, prepareStudioSave, settleStudioSave } from './saveSession';

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
