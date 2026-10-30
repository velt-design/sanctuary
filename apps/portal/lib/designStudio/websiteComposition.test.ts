import {describe,it,expect} from 'vitest';
import {newStudioWebsiteDesign} from './websiteDesign';
import {addWebsitePergola,positionWebsitePergola,websiteComposition,transformWebsitePoint} from './websiteComposition';
import {applyStudioPergolaEdit} from './pergolaEditing';
import {createStudioAuthoringEdit,projectStudioAuthoringView,mergeStudioAuthoringEdit} from './authoringView';
import {STUDIO_AUTHORED_SCHEMA,STUDIO_SPATIAL_OUTPUT_KEY,type StudioAuthoredV1,type StudioJsonObject} from './contracts';
function fixture(){const value=newStudioWebsiteDesign('p1');value.rawDimensions.widthMm='4825';value.selection.input.widthMm=4825;value.rawGaps={roof:'bad'};
 const spatial={houseAssembly:null,decks:[],openings:[],pergolas:[{id:'p1',label:'Pergola 1',family:'mono' as const,attachmentEdgeId:null,attachmentZoneId:null,side:'rear' as const,strategy:null}]};
 const authored:StudioAuthoredV1={schemaVersion:STUDIO_AUTHORED_SCHEMA,designId:'design',revision:1,spatialOutputKey:STUDIO_SPATIAL_OUTPUT_KEY,site:{validation:'preserved_unvalidated',values:{privateSite:'PRIVATE'}},objectOptions:[{objectId:'p1',options:{validation:'preserved_unvalidated',values:{websiteDesign:value as unknown as StudioJsonObject,privateField:'PRIVATE'}}}],legacyCommercialAssociations:[],provenance:{sourceEstimateId:null,sourceKind:'authored',sourcePayload:{}}};
 const projected=projectStudioAuthoringView({authored,spatial});if(!projected.ok)throw Error(projected.message);return {authored,spatial,view:projected.value,edit:createStudioAuthoringEdit(projected.value)};
}
describe('website composition identity and placement',()=>{
 it('duplicates exact raw/dormant intent with a rebound namespace and safe server private merge',()=>{const f=fixture(),r=applyStudioPergolaEdit(f.edit,{kind:'duplicate',pergolaId:'p1',id:'p2',rowIds:{flashings:{},infills:{}}},{persistedObjectIds:['p1'],baselineObjectOptions:f.view.objectOptions});expect(r.ok).toBe(true);if(!r.ok)return;expect(JSON.stringify(r.edit)).not.toContain('PRIVATE');expect(websiteComposition(r.edit)[1].value).toMatchObject({objectId:'p2',rawGaps:{roof:'bad'},rawDimensions:{widthMm:'4825'}});const merged=mergeStudioAuthoringEdit({storedAuthored:f.authored,storedSpatial:f.spatial,edit:r.edit});expect(merged.ok).toBe(true);if(merged.ok)expect(merged.value.authored.objectOptions[1].options.values).toMatchObject({privateField:'PRIVATE',websiteDesign:{objectId:'p2'}});});
 it('adds independent defaults and retains malformed position without substituting origin',()=>{let edit=addWebsitePergola(fixture().edit,'p2');edit=positionWebsitePergola(edit,'p2',{originXMm:'bad'});const rows=websiteComposition(edit);expect(rows[0].position?.x).toBe(0);expect(rows[1].position).toBeNull();expect(edit.spatial.pergolas[1].position?.originXMm).toBe('bad');});
 it('keeps millimetres through rotated world projection',()=>{expect(transformWebsitePoint({x:4825,y:3125,z:2400},{x:100,y:200,rotation:90})).toEqual({x:expect.closeTo(-3025),y:expect.closeTo(5025),z:2400});});
});
import {snapWebsiteEdges} from './websiteComposition';
it('snaps only parallel overlapping edges and never treats proximity as a join',()=>{const square=[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}];expect(snapWebsiteEdges(square,[{id:'wall',label:'House wall',start:{x:0,y:-100},end:{x:1000,y:-100}}])).toMatchObject({dx:0,dy:-100,targetId:'wall'});expect(snapWebsiteEdges(square,[{id:'far',label:'Far',start:{x:2000,y:-100},end:{x:3000,y:-100}}])).toBeNull();});

import {applyStudioHouseEdit} from './houseEditing';
it('keeps an empty or house-only composition authorable after removing the last pergola',()=>{
 const f=fixture(),house=applyStudioHouseEdit(f.edit.spatial,{kind:'add',id:'house'});expect(house.ok).toBe(true);if(!house.ok)return;
 const removed=applyStudioPergolaEdit({...f.edit,spatial:house.spatial},{kind:'remove',pergolaId:'p1'},{persistedObjectIds:['p1']});expect(removed.ok).toBe(true);if(!removed.ok)return;
 expect(websiteComposition(removed.edit)).toEqual([]);expect(removed.edit.spatial.houseAssembly?.houseForms[0].id).toBe('house');
 const merged=mergeStudioAuthoringEdit({storedAuthored:f.authored,storedSpatial:f.spatial,edit:removed.edit});expect(merged.ok).toBe(true);
 const added=addWebsitePergola(removed.edit,'replacement');expect(websiteComposition(added)[0].value?.objectId).toBe('replacement');expect(added.spatial.houseAssembly?.houseForms[0].id).toBe('house');
});
