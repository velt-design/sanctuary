import {expect,it} from 'vitest';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '../drawings/state/objectFirstWorkbenchModel';
import {addWebsitePergola,positionWebsitePergola} from './websiteComposition';
import {previewWebsiteJoin,removeWebsiteJoin,websiteJoinStates} from './websiteJoins';
import {parseStudioAuthoringEdit,type StudioAuthoringEdit} from './authoringView';
it('joins a clean default pair, survives save/reopen, detects moved contact and removes the join without moving either product',()=>{
 let original:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'join-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
 original=addWebsitePergola(addWebsitePergola(original,'a'),'b');const before=structuredClone(original);
 const result=previewWebsiteJoin(original,{id:'join',a:{objectId:'b',edge:'left'},b:{objectId:'a',edge:'right'},alignment:'centre'});
 expect(original).toEqual(before);expect(result.pose.x).toBe(6000);expect(result.witness.areaMm2).toBeGreaterThan(1);
 const parsed=parseStudioAuthoringEdit(JSON.parse(JSON.stringify(result.edit)));if(!parsed.ok)throw Error(parsed.message);
 expect(websiteJoinStates(parsed.value)[0].error).toBeNull();
 const moved=positionWebsitePergola(parsed.value,'b',{originXMm:'7000'});expect(websiteJoinStates(moved)[0].error).toContain('no longer meet');
 const removed=removeWebsiteJoin(parsed.value,'join');expect(websiteJoinStates(removed)).toEqual([]);expect(removed.spatial).toEqual(parsed.value.spatial);
 expect(original).toEqual(before);
});
