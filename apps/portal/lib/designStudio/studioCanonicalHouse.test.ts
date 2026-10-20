import {buildStudioHouseGeometryRegistry} from './canonicalHouseGeometry';
import {describe,it,expect} from 'vitest';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT,buildWorkbenchProjectModelFromObjectFirstDraft} from '../drawings/state/objectFirstWorkbenchModel';
import {buildProjectHouseGeometryRegistry} from '../drawings/state/projectHouseGeometryRegistry';
import {applyStudioHouseEdit} from './houseEditing';
import {addWebsitePergola,websiteComposition} from './websiteComposition';
import {studioHouseScene,parseWebsiteAttachments} from './studioHouseScene';
import {solveStudioHouse,studioHouseTargets} from './studioHouseGeometry';
import {previewStudioAttachment,detachStudioPergola,updateStudioHouse} from './studioHouseCommands';
import {parseStudioAuthoringEdit,type StudioAuthoringEdit} from './authoringView';
import {studioWebsiteBrackets} from './studioHouseWebsiteBrackets';
import {boxedHouseSoffits} from './studioHouseWebsiteContact';
import {solvePergolaPreview} from '@sp/configurator/geometry';
import {connectionView} from '../../components/designStudio/directDemo/connectionView';
import {localDemoClearance} from './demoContactClearance';
function fixture(){let edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'canonical-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};const h=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'house'});if(!h.ok)throw Error(h.message);edit.spatial=h.spatial;const house=edit.spatial.houseAssembly!.houseForms[0];house.wallHeightM='3.6';house.eaveHeightM='3.8';house.fasciaHeightMm='350';house.eaveOverhangMm='500';house.soffitDepthMm='500';house.gutterWidthMm='140';house.gutterDepthMm='140';house.gutterProjectionMm='140';house.position={originXMm:'410',originYMm:'-720',rotationDeg:'37'};house.roofIntent.primaryPitchDeg='15';const p=house.composition.primitives[0];if(p.kind!=='axisAlignedRectangle')throw Error();p.originXMm=225;p.originYMm=-6220;p.widthMm=8000;p.depthMm=6500;edit=addWebsitePergola(edit,'p1');const v=edit.objectOptions[0].values.websiteDesign as any;v.selection.input.widthMm=3000;v.rawDimensions.widthMm='3000';return edit;}
function sorted(points:{x:number;y:number;z:number}[]){return points.map(p=>[p.x,p.y,p.z].map(n=>Math.round(n*1e5)/1e5).join(',')).sort();}
describe('saved canonical house and approved movement adapter',()=>{
 it('derives the exact canonical solids with distinct wall/eave height and arbitrary rotated primitive origin',()=>{const edit=fixture(),h=studioHouseScene(edit.site,edit.spatial)!.houses[0],actual=solveStudioHouse(h),canonical=buildStudioHouseGeometryRegistry(edit.spatial)[0].model;expect(sorted(actual.walls.flat())).toEqual(sorted(canonical.wallSegments.flatMap(w=>w.boundary)));expect(sorted(actual.roof.flat())).toEqual(sorted(canonical.roofPlanes.flatMap(r=>r.boundary)));expect(sorted(actual.soffits.flat())).toEqual(sorted(canonical.eave?.soffitPolygons?.flat()??[]));expect(actual.model.eave?.gutterWidthMm).toBe(140);});
 it('saves one house authority, follows its movement and exactly detaches through reload',()=>{let edit=fixture();edit=previewStudioAttachment(edit,{objectId:'p1',houseId:'house',edge:'front',kind:'wall',method:'facade',contactBasis:'canonical-house.v1'});expect(edit.site.studioHouseScene).toBeUndefined();expect(edit.spatial.pergolas[0].attachment?.host?.objectId).toBe('house');const before=websiteComposition(edit)[0];expect(before.error).toBeNull();const house=studioHouseScene(edit.site,edit.spatial)!.houses[0];edit=updateStudioHouse(edit,{...house,position:{...house.position,xMm:String(Number(house.position.xMm)+300)}});const moved=websiteComposition(edit)[0];expect(moved.error).toBeNull();expect(moved.position!.x-before.position!.x).toBeCloseTo(300,5);const parsed=parseStudioAuthoringEdit(JSON.parse(JSON.stringify(edit)));expect(parsed.ok).toBe(true);if(!parsed.ok)throw Error(parsed.message);expect(websiteComposition(parsed.value)[0].position).toEqual(moved.position);const detached=detachStudioPergola(parsed.value,'p1');expect(detached.spatial.pergolas[0].attachment?.host).toBeNull();expect(websiteComposition(detached)[0].position).toEqual(moved.position);expect(websiteComposition(detached)[0].geometryOptions?.supportDatumMm).toBe(moved.geometryOptions?.supportDatumMm);});
 it('retains malformed exact pose for repair without falling back to legacy transform',()=>{const edit=fixture();edit.spatial.houseAssembly!.houseForms[0].position!.rotationDeg='wrong';expect(buildStudioHouseGeometryRegistry(edit.spatial)).toEqual([]);expect(parseStudioAuthoringEdit(edit).ok).toBe(true);expect(()=>solveStudioHouse(studioHouseScene(edit.site,edit.spatial)!.houses[0])).toThrow(/house/);});
 it('rejects incompatible companion authority and retains original multi-primitive houses',()=>{let edit=fixture();const original=JSON.stringify(edit);edit.spatial.houseAssembly!.houseForms[0].composition.primitives.push(structuredClone(edit.spatial.houseAssembly!.houseForms[0].composition.primitives[0]));expect(()=>studioHouseScene(edit.site,edit.spatial)).toThrow(/simple rectangle/);expect(edit.spatial.houseAssembly!.houseForms[0].composition.primitives).toHaveLength(2);expect(()=>parseWebsiteAttachments({schemaVersion:'website_attachments.v1',attachments:[{objectId:'p1',houseId:'house',edge:'front',kind:'wall',method:'soffit',reference:{position:{x:0,y:0,rotation:0},supportDatumMm:2400},contactBasis:'canonical-house.v1'}]})).toThrow(/method/);expect(original).toContain('canonical-proof');});
});


describe('ordinary factory house commands', () => {
 function factory() {
   let edit: StudioAuthoringEdit = {schemaVersion:'studio_authoring_edit.v1',designId:'factory-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
   const result=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'factory-house'});
   if (!result.ok) throw Error(result.message);
   edit.spatial=result.spatial;
   return addWebsitePergola(edit,'factory-pergola');
 }
 it('changes width alone, preserving absent optional fields and the complete saved result', () => {
   const edit=factory(), house=studioHouseScene(edit.site,edit.spatial)!.houses[0];
   const changed=updateStudioHouse(edit,{...house,widthMm:'7000'});
   const form=changed.spatial.houseAssembly!.houseForms[0];
   expect(form.composition.primitives[0]).toMatchObject({widthMm:7000});
   expect(Object.hasOwn(form,'gutterWidthMm')).toBe(false);
   const restored=parseStudioAuthoringEdit(JSON.parse(JSON.stringify(changed)));
   expect(restored.ok).toBe(true);
   if (!restored.ok) throw Error(restored.message);
   expect(solveStudioHouse(studioHouseScene(restored.value.site,restored.value.spatial)!.houses[0]).roof).toEqual(solveStudioHouse(studioHouseScene(changed.site,changed.spatial)!.houses[0]).roof);
 });
 it('exposes actual eave surfaces and accepts a UI-shaped connection with command-owned basis', () => {
   const edit=factory(), house=studioHouseScene(edit.site,edit.spatial)!.houses[0];
   expect(studioHouseTargets(house,'soffit').some(t=>t.kind==='eave')).toBe(true);
   const bound=previewStudioAttachment(edit,{objectId:'factory-pergola',houseId:'factory-house',edge:'rear',kind:'eave',method:'soffit'});
   const restored=parseStudioAuthoringEdit(JSON.parse(JSON.stringify(bound)));
   expect(restored.ok).toBe(true);
   expect(websiteComposition(bound)[0].error).toBeNull();
   expect(bound.site.websiteAttachments).toMatchObject({attachments:[{contactBasis:'canonical-house.v1'}]});
   // The untouched default wall is physically too low for this pergola. Do not alter house height to make it fit.
   expect(()=>previewStudioAttachment(edit,{objectId:'factory-pergola',houseId:'factory-house',edge:'rear',kind:'wall',method:'facade'})).toThrow(/support at.*2000–5000/);
   expect(edit.spatial.houseAssembly!.houseForms[0].wallHeightM).toBeUndefined();
   expect(studioHouseScene(edit.site,edit.spatial)!.houses[0].wallHeightMm).toBe('2400');
 });
 it('renders the exact factory and resized Soffit proposal, including the previously missing front edge',()=>{
   for(const widthMm of ['6000','7000'])for(const edge of ['front','rear'] as const){
     let edit=factory();edit=updateStudioHouse(edit,{...studioHouseScene(edit.site,edit.spatial)!.houses[0],widthMm});
     const house=studioHouseScene(edit.site,edit.spatial)!.houses[0];
     expect(studioHouseTargets(house,'soffit').filter(t=>t.kind==='eave')).toHaveLength(4);
     expect(boxedHouseSoffits(solveStudioHouse(house)).filter(s=>s.side===edge)).toHaveLength(1);
     const proposed=previewStudioAttachment(edit,{objectId:'factory-pergola',houseId:'factory-house',edge,kind:'eave',method:'soffit'});
     const parsed=parseStudioAuthoringEdit(JSON.parse(JSON.stringify(proposed)));if(!parsed.ok)throw Error(parsed.message);
     const row=websiteComposition(parsed.value)[0],assembly=solvePergolaPreview(row.design!.input,row.design!.roof,row.geometryOptions).geometry!.assembly;
     const brackets=studioWebsiteBrackets(house,edge,assembly,row.position!,row.design!.input.widthMm);
     expect(brackets).toHaveLength(5);
     expect(brackets[0].section[5].z).toBe(2220);
     expect(brackets[0].section[2].z).toBe(2250);
     expect(()=>connectionView(house,edge,assembly,row.position!,row.design!.input.widthMm)).not.toThrow();
     expect(row.position!.x).toBe(edge==='rear'?0:Number(widthMm));
     expect(detachStudioPergola(parsed.value,'factory-pergola').spatial.pergolas[0].attachment?.host).toBeNull();
   }
 });
 it('uses authored fascia depth and refuses impossible bracket datums before publishing a preview',()=>{
   const edit=factory(),house=studioHouseScene(edit.site,edit.spatial)!.houses[0];
   const deep=updateStudioHouse(edit,{...house,roof:{...house.roof,fasciaHeightMm:'260'}});
   const deeper=studioHouseScene(deep.site,deep.spatial)!.houses[0];
   expect(boxedHouseSoffits(solveStudioHouse(deeper)).flatMap(s=>s.local).every(p=>p.z===2140)).toBe(true);
   expect(()=>previewStudioAttachment(deep,{objectId:'factory-pergola',houseId:'factory-house',edge:'rear',kind:'eave',method:'soffit'})).not.toThrow();
   const shallow=updateStudioHouse(edit,{...house,roof:{...house.roof,fasciaHeightMm:'100'}});
   expect(()=>previewStudioAttachment(shallow,{objectId:'factory-pergola',houseId:'factory-house',edge:'rear',kind:'eave',method:'soffit'})).toThrow(/ledger underside.*soffit/);
   expect(shallow.site.websiteAttachments).toMatchObject({attachments:[]});
 });
 it('fits the actual quantized Gable geometry while preserving the required gutter clearance',()=>{
   let edit=factory();edit=updateStudioHouse(edit,{...studioHouseScene(edit.site,edit.spatial)!.houses[0],widthMm:'7000'});
   const design=edit.objectOptions[0].values.websiteDesign as any;design.selection.roof.family='gable';design.selection.roof.orientation='parallel';edit.spatial.pergolas[0].family='gable';
   expect(()=>previewStudioAttachment(edit,{objectId:'factory-pergola',houseId:'factory-house',edge:'rear',kind:'eave',method:'fascia'})).toThrow(/fascia is too short/);
   const authoredHouse=studioHouseScene(edit.site,edit.spatial)!.houses[0];
   edit=updateStudioHouse(edit,{...authoredHouse,roof:{...authoredHouse.roof,fasciaHeightMm:'350'}});
   const proposed=previewStudioAttachment(edit,{objectId:'factory-pergola',houseId:'factory-house',edge:'rear',kind:'eave',method:'fascia'});
   const row=websiteComposition(proposed)[0],house=studioHouseScene(proposed.site,proposed.spatial)!.houses[0];
   expect(row.error).toBeNull();expect(row.geometryOptions!.supportDatumMm).toBe(2107);
   expect(localDemoClearance(house,'rear',row,row.position!).gapMm).toBeGreaterThanOrEqual(5);
   const restored=parseStudioAuthoringEdit(JSON.parse(JSON.stringify(proposed)));if(!restored.ok)throw Error(restored.message);
   expect(websiteComposition(restored.value)[0].position).toEqual(row.position);
   expect(websiteComposition(restored.value)[0].geometryOptions).toEqual(row.geometryOptions);
 });
});
