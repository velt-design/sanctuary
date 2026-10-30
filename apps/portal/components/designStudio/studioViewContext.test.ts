import {readStudioSideBookmark,restoreStudioSideBookmark} from './studioViewContext';
import {newStudioWebsiteDesign} from '../../lib/designStudio/websiteDesign';
import {defaultSidePanel} from '@sp/configurator/website';
import { readWebsiteViewContext } from './studioViewContext';
import {describe,it,expect} from 'vitest';
import {readStudioViewContext,studioViewContextKey} from './studioViewContext';
const selectedRef={family:'pergolas' as const,objectId:'lounge'};
describe('scoped editor navigation context',()=>{
  it('retains the selected object, section and plan without design inputs',()=>{
    expect(readStudioViewContext(JSON.stringify({selectedRef,tab:'Position',mode:'plan',privatePayload:'ignored'}),[selectedRef])).toEqual({selectedRef,tab:'Position',mode:'plan'});
  });
  it.each([null,'bad',JSON.stringify({selectedRef,tab:'Unknown',mode:'plan'}),JSON.stringify({selectedRef,tab:'Position',mode:'unknown'})])('rejects malformed or unknown context %s',raw=>expect(readStudioViewContext(raw,[selectedRef])).toBeNull());
  it('rejects removed or other-family object identities',()=>{
    const raw=JSON.stringify({selectedRef,tab:'Position',mode:'plan'});
    expect(readStudioViewContext(raw,[])).toBeNull();
    expect(readStudioViewContext(raw,[{family:'house_forms',objectId:'lounge'}])).toBeNull();
  });
  it('isolates every ownership dimension and escapes separator collisions',()=>{
    const scope={actorId:'a',projectId:'p',estimateId:'e',designId:'d'};
    for(const key of Object.keys(scope) as (keyof typeof scope)[]) expect(studioViewContextKey({...scope,[key]:'other'})).not.toBe(studioViewContextKey(scope));
    expect(studioViewContextKey({...scope,actorId:'a:p',projectId:'x'})).not.toBe(studioViewContextKey({...scope,actorId:'a',projectId:'p:x'}));
  });
});

it.each([['Design','Shape'],['Structure','Shape'],['Options','Finish']])('migrates old %s tab to %s without losing selection', (oldTab,newTab)=>{ expect(readStudioViewContext(JSON.stringify({selectedRef,tab:oldTab,mode:'plan'}),[selectedRef])).toEqual({selectedRef,tab:newTab,mode:'plan'}); });

it('retains website section/night and rejects stale opening or malformed navigation',()=>{
 expect(readWebsiteViewContext(JSON.stringify({section:'Lighting',night:true,opening:''}),['Front1'])).toEqual({section:'Lighting',night:true,opening:'',view:'3D',tool:null});
 expect(readWebsiteViewContext(JSON.stringify({section:'Sides',night:false,opening:'missing'}),['Front1'])?.opening).toBe('');
 expect(readWebsiteViewContext(JSON.stringify({section:'Secret',night:true,opening:''}),[])).toBeNull();
});

it('retains Plan and selected lighting tool on review return',()=>expect(readWebsiteViewContext(JSON.stringify({section:'Lighting',night:false,opening:'',view:'Plan',tool:'strip'}),[])).toMatchObject({view:'Plan',tool:'strip'}));

it('restores comparison choices and raw intent after section/review remount without restoring unrelated roof inputs',()=>{const saved=newStudioWebsiteDesign('p1');saved.selection.roof.sidePanels=[defaultSidePanel('left-1of1','timber')];saved.rawGaps={'left-1of1':'bad',roof:'old'};const raw=JSON.stringify({version:1,openingScope:'same',design:saved});const reloaded=readStudioSideBookmark(raw,'p1','same');expect(reloaded).not.toBeNull();const current=newStudioWebsiteDesign('p1');current.rawDimensions.widthMm='4825';current.rawGaps={roof:'27'};const restored=restoreStudioSideBookmark(current,reloaded!);expect(restored.rawDimensions.widthMm).toBe('4825');expect(restored.rawGaps).toEqual({roof:'27','left-1of1':'bad'});expect(restored.selection.roof.sidePanels).toEqual(saved.selection.roof.sidePanels);expect(readStudioSideBookmark(raw,'other','same')).toBeNull();expect(readStudioSideBookmark(raw,'p1','changed geometry')).toBeNull();expect(readStudioSideBookmark(JSON.stringify({version:1,openingScope:'same',design:{...saved,privateCost:42}}),'p1','same')).toBeNull();});
