import {buildStudioHouseGeometryRegistry} from './canonicalHouseGeometry';
import {describe,it,expect,vi} from 'vitest';
import * as registryOwner from '../drawings/state/projectHouseGeometryRegistry';
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
import {solvePergolaPreview,previewBlindOpenings} from '@sp/configurator/geometry';
import {connectionView} from '../../components/designStudio/directDemo/connectionView';
import {localDemoClearance} from './demoContactClearance';
import {buildDefaultHouseFormDraft} from '../drawings/state/houseFormDraftFactory';
import {normalizeObjectFirstWorkbenchDraftVNext} from '../drawings/state/objectFirstWorkbenchModel';
function fixture(){let edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'canonical-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};const h=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'house'});if(!h.ok)throw Error(h.message);edit.spatial=h.spatial;const house=edit.spatial.houseAssembly!.houseForms[0];house.wallHeightM='3.6';house.eaveHeightM='3.8';house.fasciaHeightMm='350';house.eaveOverhangMm='500';house.soffitDepthMm='500';house.gutterWidthMm='140';house.gutterDepthMm='140';house.gutterProjectionMm='140';house.position={originXMm:'410',originYMm:'-720',rotationDeg:'37'};house.roofIntent.primaryPitchDeg='15';const p=house.composition.primitives[0];if(p.kind!=='axisAlignedRectangle')throw Error();p.originXMm=225;p.originYMm=-6220;p.widthMm=8000;p.depthMm=6500;edit=addWebsitePergola(edit,'p1');const v=edit.objectOptions[0].values.websiteDesign as any;v.selection.input.widthMm=3000;v.rawDimensions.widthMm='3000';return edit;}
function sorted(points:{x:number;y:number;z:number}[]){return points.map(p=>[p.x,p.y,p.z].map(n=>Math.round(n*1e5)/1e5).join(',')).sort();}

it('reuses only the exact resolved house geometry for identical rotated targets without another registry build',()=>{
 const edit=fixture(),house=studioHouseScene(edit.site,edit.spatial)!.houses[0],geometry=solveStudioHouse(house);
 const methods=['facade','fascia','soffit'] as const,expected=methods.map(method=>studioHouseTargets(house,method));
 const registry=vi.spyOn(registryOwner,'buildProjectHouseGeometryRegistry');
 try{
  expect(methods.map(method=>studioHouseTargets(house,method,geometry))).toEqual(expected);expect(registry).not.toHaveBeenCalled();
  const changed={...house,widthMm:'7000'};expect(studioHouseTargets(changed,'facade',geometry)).toEqual(studioHouseTargets(changed,'facade'));expect(registry).toHaveBeenCalledTimes(2);
 }finally{registry.mockRestore();}
});
describe('saved canonical house and approved movement adapter',()=>{
 it('creates a regular new Studio house with matching saved composition and Hipped15 geometry, preserving old and shared defaults',()=>{
  const shared=buildDefaultHouseFormDraft({id:'old',label:'Old house'}),before=structuredClone(shared);
  expect(shared.roofIntent.primaryPitchDeg).toBe('5');
  const empty=structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT);
  const added=applyStudioHouseEdit(empty,{kind:'add',id:'new'});if(!added.ok)throw Error(added.message);
  const house=added.spatial.houseAssembly!.houseForms[0];
  expect(house.roofIntent).toMatchObject({form:'hipped',primaryPitchDeg:'15'});
  const primitive=house.composition.primitives[0];if(primitive.kind!=='axisAlignedRectangle')throw Error('Expected canonical rectangle.');
  expect(primitive).toMatchObject({widthMm:12000,depthMm:8000});
  expect(house).toMatchObject({wallHeightM:'2.7',eaveHeightM:'2.7'});
  const restored=parseStudioAuthoringEdit({schemaVersion:'studio_authoring_edit.v1',designId:'regular-house-proof',revision:1,spatial:JSON.parse(JSON.stringify(added.spatial)),site:{},objectOptions:[],deletions:[]});
  expect(restored.ok).toBe(true);if(restored.ok)expect(restored.value.spatial).toEqual(added.spatial);
  expect(primitive.roofIntent).toMatchObject({form:'hipped',pitchDeg:15});
  const solved=solveStudioHouse(studioHouseScene({},added.spatial)!.houses[0]);
  expect(solved.model.roofPlanes).toHaveLength(4);
  for(const roof of solved.model.roofPlanes){const n=roof.plane.normal;expect(Math.acos(Math.abs(n.z)/Math.hypot(n.x,n.y,n.z))*180/Math.PI).toBeCloseTo(15,8);}
  const spatial={...empty,houseAssembly:{id:'assembly',label:'Houses',houseForms:[shared]}};
  const duplicate=applyStudioHouseEdit(spatial,{kind:'duplicate',houseFormId:'old',id:'copy'});if(!duplicate.ok)throw Error(duplicate.message);
  expect(duplicate.spatial.houseAssembly!.houseForms[1].roofIntent.primaryPitchDeg).toBe('5');
  expect(duplicate.spatial.houseAssembly!.houseForms[1].composition).toEqual(before.composition);
  expect(Object.hasOwn(duplicate.spatial.houseAssembly!.houseForms[1],'wallHeightM')).toBe(false);
  expect(Object.hasOwn(duplicate.spatial.houseAssembly!.houseForms[1],'eaveHeightM')).toBe(false);
  expect(shared).toEqual(before);
  expect(Object.hasOwn(house,'appearance')).toBe(false);
 });
 it('preserves optional authored house materials through strict parsing and shared normalization without changing shape',()=>{
  const edit=fixture(),before=structuredClone(edit);
  const appearance={wallMaterial:'weatherboard',roofProfile:'tray',roofTrayWidth:300,roofColour:'#506070'};
  const result=applyStudioHouseEdit(edit.spatial,{kind:'appearance',houseFormId:'house',patch:appearance} as any);
  expect(result.ok).toBe(true);if(!result.ok)throw Error(result.message);
  expect(result.spatial.houseAssembly!.houseForms[0]).toEqual({...before.spatial.houseAssembly!.houseForms[0],appearance});
  expect(parseStudioAuthoringEdit({...edit,spatial:result.spatial}).ok).toBe(true);
  expect((normalizeObjectFirstWorkbenchDraftVNext(result.spatial).houseAssembly!.houseForms[0] as any).appearance).toEqual(appearance);
  expect(edit).toEqual(before);
  const malformed=structuredClone(result.spatial);(malformed.houseAssembly!.houseForms[0] as any).appearance.roofColour='red';
  expect(parseStudioAuthoringEdit({...edit,spatial:malformed}).ok).toBe(false);
  expect(normalizeObjectFirstWorkbenchDraftVNext(before.spatial).houseAssembly!.houseForms[0]).not.toHaveProperty('appearance');
 });
 it.each([{roofColour:'red'},{roofColour:'#12345'},{roofProfile:'unknown'},{roofTrayWidth:250},{wallMaterial:'supplier-stock'},{privatePrice:100}])('refuses malformed or unsupported house appearance without losing source: %j',patch=>{
  const edit=fixture(),before=structuredClone(edit);
  expect(applyStudioHouseEdit(edit.spatial,{kind:'appearance',houseFormId:'house',patch} as any).ok).toBe(false);
  expect(edit).toEqual(before);
 });
 it.each([0,37])('advertises only the real rear soffit for a Flat5 roof at %s degrees',rotation=>{
  let edit=fixture();const source=studioHouseScene(edit.site,edit.spatial)!.houses[0];edit=updateStudioHouse(edit,{...source,roof:{...source.roof,form:'flat',pitchDeg:'5',fall:'rear'},position:{...source.position,rotationDeg:String(rotation)}});
  const house=studioHouseScene(edit.site,edit.spatial)!.houses[0],geometry=solveStudioHouse(house);
  expect(boxedHouseSoffits(geometry).map(s=>s.side)).toEqual(['rear']);
  const targets=studioHouseTargets(house,'soffit').filter(t=>t.kind==='eave');
  expect(targets.map(t=>t.side)).toEqual(['rear']);
  const r=-rotation*Math.PI/180,localY=(p:{x:number;y:number})=>(p.x-Number(house.position.xMm))*Math.sin(r)+(p.y-Number(house.position.yMm))*Math.cos(r);
  expect(localY(targets[0].start)).toBeCloseTo(Number(house.depthMm)+Number(house.roof.overhangMm),7);expect(localY(targets[0].end)).toBeCloseTo(Number(house.depthMm)+Number(house.roof.overhangMm),7);
  expect(studioHouseTargets(house,'facade').filter(t=>t.kind==='wall')).toHaveLength(4);
 });
 it.each(['flat','mono','hipped'] as const)('names only actual %s fascia and soffit side surfaces across fall and rotation',form=>{
  for(const rotation of [0,37])for(const fall of ['front','right','rear','left'] as const){
   let edit=fixture();const old=studioHouseScene(edit.site,edit.spatial)!.houses[0];edit=updateStudioHouse(edit,{...old,roof:{...old.roof,form,pitchDeg:'5',fall},position:{...old.position,rotationDeg:String(rotation)}});
   const house=studioHouseScene(edit.site,edit.spatial)!.houses[0],actual=boxedHouseSoffits(solveStudioHouse(house)).map(s=>s.side).sort();
   expect(actual).toEqual(form==='hipped'?['front','left','rear','right']:form==='flat'?['rear']:[fall]);
   for(const method of ['fascia','soffit'] as const)expect(studioHouseTargets(house,method).filter(t=>t.kind==='eave').map(t=>t.side).sort()).toEqual(actual);
  }
 });
 it('uses actual binding truth for rear availability and restores all independent bays after detach',()=>{
  const bound=previewStudioAttachment(fixture(),{objectId:'p1',houseId:'house',edge:'front',kind:'wall',method:'facade',contactBasis:'canonical-house.v1'});
  for(const canonicalOnly of [false,true]){
   const edit=structuredClone(bound);if(canonicalOnly)delete edit.site.websiteAttachments;
   const row=websiteComposition(edit)[0];if(canonicalOnly)expect(row.object.attachment?.host?.objectId).toBe('house');else expect(row.studioAttachment).not.toBeNull();expect(row.geometryOptions?.rearOpenings).not.toBe(true);
   expect(previewBlindOpenings(row.design!.input,row.design!.roof,row.geometryOptions).some(o=>o.side==='rear')).toBe(false);
  }
  const detached=detachStudioPergola(bound,'p1'),row=websiteComposition(detached)[0];expect(row.studioAttachment).toBeNull();expect(row.geometryOptions?.rearOpenings).toBe(true);
  expect(new Set(previewBlindOpenings(row.design!.input,row.design!.roof,row.geometryOptions).map(o=>o.side))).toEqual(new Set(['front','left','right','rear']));
  const original=structuredClone(bound);(bound.objectOptions[0].values.websiteDesign as any).selection.roof.attachmentIntent='freestanding';
  const conflicting=websiteComposition(bound)[0];expect(conflicting.error).toMatch(/disagree/);expect(conflicting.geometryOptions?.rearOpenings).not.toBe(true);expect(bound.spatial).toEqual(original.spatial);
 });
 it('derives the exact canonical solids with distinct wall/eave height and arbitrary rotated primitive origin',()=>{const edit=fixture(),h=studioHouseScene(edit.site,edit.spatial)!.houses[0],actual=solveStudioHouse(h),canonical=buildStudioHouseGeometryRegistry(edit.spatial)[0].model;expect(sorted(actual.walls.flat())).toEqual(sorted(canonical.wallSegments.flatMap(w=>w.boundary)));expect(sorted(actual.roof.flat())).toEqual(sorted(canonical.roofPlanes.flatMap(r=>r.boundary)));expect(sorted(actual.soffits.flat())).toEqual(sorted(canonical.eave?.soffitPolygons?.flat()??[]));expect(actual.model.eave?.gutterWidthMm).toBe(140);});
 it('saves one house authority, follows its movement and exactly detaches through reload',()=>{let edit=fixture();edit=previewStudioAttachment(edit,{objectId:'p1',houseId:'house',edge:'front',kind:'wall',method:'facade',contactBasis:'canonical-house.v1'});expect(edit.site.studioHouseScene).toBeUndefined();expect(edit.spatial.pergolas[0].attachment?.host?.objectId).toBe('house');const before=websiteComposition(edit)[0];expect(before.error).toBeNull();const house=studioHouseScene(edit.site,edit.spatial)!.houses[0];edit=updateStudioHouse(edit,{...house,position:{...house.position,xMm:String(Number(house.position.xMm)+300)}});const moved=websiteComposition(edit)[0];expect(moved.error).toBeNull();expect(moved.position!.x-before.position!.x).toBeCloseTo(300,5);const parsed=parseStudioAuthoringEdit(JSON.parse(JSON.stringify(edit)));expect(parsed.ok).toBe(true);if(!parsed.ok)throw Error(parsed.message);expect(websiteComposition(parsed.value)[0].position).toEqual(moved.position);const detached=detachStudioPergola(parsed.value,'p1');expect(detached.spatial.pergolas[0].attachment?.host).toBeNull();expect(websiteComposition(detached)[0].position).toEqual(moved.position);expect(websiteComposition(detached)[0].geometryOptions?.supportDatumMm).toBe(moved.geometryOptions?.supportDatumMm);});
 it('retains malformed exact pose for repair without falling back to legacy transform',()=>{const edit=fixture();edit.spatial.houseAssembly!.houseForms[0].position!.rotationDeg='wrong';expect(buildStudioHouseGeometryRegistry(edit.spatial)).toEqual([]);expect(parseStudioAuthoringEdit(edit).ok).toBe(true);expect(()=>solveStudioHouse(studioHouseScene(edit.site,edit.spatial)!.houses[0])).toThrow(/house/);});
 it('rejects incompatible companion authority and retains original multi-primitive houses',()=>{let edit=fixture();const original=JSON.stringify(edit);edit.spatial.houseAssembly!.houseForms[0].composition.primitives.push(structuredClone(edit.spatial.houseAssembly!.houseForms[0].composition.primitives[0]));expect(()=>studioHouseScene(edit.site,edit.spatial)).toThrow(/simple rectangle/);expect(edit.spatial.houseAssembly!.houseForms[0].composition.primitives).toHaveLength(2);expect(()=>parseWebsiteAttachments({schemaVersion:'website_attachments.v1',attachments:[{objectId:'p1',houseId:'house',edge:'front',kind:'wall',method:'soffit',reference:{position:{x:0,y:0,rotation:0},supportDatumMm:2400},contactBasis:'canonical-house.v1'}]})).toThrow(/method/);expect(original).toContain('canonical-proof');});
});


describe('retained historical Studio house commands', () => {
 function factory() {
   let edit: StudioAuthoringEdit = {schemaVersion:'studio_authoring_edit.v1',designId:'factory-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
   const result=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'factory-house'});
   if (!result.ok) throw Error(result.message);
   edit.spatial=result.spatial;
   // Retain the old persisted 6x4/absent-height source for these exact physical regression cases.
   const historical=edit.spatial.houseAssembly!.houseForms[0];delete historical.wallHeightM;delete historical.eaveHeightM;
   const rectangle=historical.composition.primitives[0];if(rectangle.kind!=='axisAlignedRectangle')throw Error();rectangle.widthMm=6000;rectangle.depthMm=4000;
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
