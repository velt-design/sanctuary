import {buildWorkbenchProjectModelFromObjectFirstDraft, type ObjectFirstWorkbenchDraftVNext} from '../drawings/state/objectFirstWorkbenchModel';
import {buildProjectHouseGeometryRegistry} from '../drawings/state/projectHouseGeometryRegistry';
import {deriveRectangleRoofIntent} from '../drawings/state/houseFormCompositionAdapter';
import {buildHouseModel3DFromRawHouseInput,MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG,type Point3,type HouseModel3D} from '@sp/geometry';
import type {StudioHouse,HouseSide} from './studioHouseScene';

export function houseNumber(raw:string,label:string,min?:number):number{
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim()))throw Error(`Enter a valid ${label}. Your input is kept.`);
  const n=Number(raw);if(!Number.isFinite(n)||Math.abs(n)>1e7||min!==undefined&&n<min)throw Error(`Enter a valid ${label}. Your input is kept.`);return n;
}
export type StudioHouseField = 'widthMm'|'depthMm'|'wallHeightMm'|'eaveHeightMm'|'pitchDeg'|'overhangMm'|'xMm'|'yMm'|'rotationDeg';
export function studioHouseFieldErrors(h:StudioHouse):Partial<Record<StudioHouseField,string>>{
 const errors:Partial<Record<StudioHouseField,string>>={};
 const fields:Array<[StudioHouseField,string,string,number?]>=[['widthMm',h.widthMm,'house width',1],['depthMm',h.depthMm,'house depth',1],['wallHeightMm',h.wallHeightMm,'wall height',1],['pitchDeg',h.roof.pitchDeg,'roof pitch',0],['overhangMm',h.roof.overhangMm,'overhang',0],['xMm',h.position.xMm,'house X position'],['yMm',h.position.yMm,'house Y position'],['rotationDeg',h.position.rotationDeg,'house rotation']];
 if(h.eaveHeightMm)fields.push(['eaveHeightMm',h.eaveHeightMm,'eave height',1]);
 for(const [key,raw,label,min] of fields)try{houseNumber(raw,label,min);}catch(e){errors[key]=(e as Error).message;}
 if(!errors.pitchDeg){const pitch=Number(h.roof.pitchDeg);if(pitch>=90)errors.pitchDeg='Roof pitch must be below 90 degrees.';
 else if(h.roof.form==='hipped'&&pitch<MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG)errors.pitchDeg=`Hipped roofs need at least ${MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG} degrees to display this roof. Your input is kept.`;}
 return errors;
}
export function houseWorld(h:StudioHouse,p:Point3):Point3{
  const x=houseNumber(h.position.xMm,'house position'),y=houseNumber(h.position.yMm,'house position'),r=houseNumber(h.position.rotationDeg,'house rotation')*Math.PI/180;
  return {x:x+p.x*Math.cos(r)-p.y*Math.sin(r),y:y+p.x*Math.sin(r)+p.y*Math.cos(r),z:p.z};
}
export type StudioHouseGeometry={house:StudioHouse;model:HouseModel3D;footprint:Point3[];walls:Point3[][];roof:Point3[][];eaves:Point3[][];soffits:Point3[][]};
/** Explicit rectangle into the shared physical solver. No workbench normalizer, registry or scene object pipeline. */
export function solveStudioHouse(h:StudioHouse):StudioHouseGeometry{
  const error=Object.values(studioHouseFieldErrors(h))[0];if(error)throw Error(error);
  const width=houseNumber(h.widthMm,'house width',1),depth=houseNumber(h.depthMm,'house depth',1),height=houseNumber(h.wallHeightMm,'wall height',1),pitch=houseNumber(h.roof.pitchDeg,'roof pitch',0),overhang=houseNumber(h.roof.overhangMm,'overhang',0);
  const footprint=[{x:0,y:0,z:0},{x:width,y:0,z:0},{x:width,y:depth,z:0},{x:0,y:depth,z:0}];
  const fall={front:'negative_y',rear:'positive_y',left:'negative_x',right:'positive_x'} as const;
  const form=structuredClone(h.source);
  const primitive=form.composition.primitives[0];if(primitive.kind!=='axisAlignedRectangle')throw Error('Unsupported house primitive.');
  form.composition.primitives[0]={...primitive,originXMm:0,originYMm:0,widthMm:width,depthMm:depth};
  form.transform={offsetXM:0,offsetYM:0,rotationQuarterTurns:0};delete form.position;
  if(h.eaveHeightMm!==undefined)form.eaveHeightM=h.eaveHeightMm===''?'':String(houseNumber(h.eaveHeightMm,'eave height',1)/1000);
  for(const key of ['soffitDepthMm','fasciaHeightMm','gutterWidthMm','gutterDepthMm','gutterProjectionMm'] as const)if(form[key])houseNumber(form[key]!,key,0);
  form.wallHeightM=String(height/1000);form.eaveOverhangMm=String(overhang);
  form.roofIntent={...form.roofIntent,form:h.roof.form,primaryPitchDeg:h.roof.pitchDeg,primaryFallDirection:fall[h.roof.fall],ridgeAxis:h.roof.ridge==='width'?'x':'y'};
  form.roofIntentAuthored=true;(form.composition.primitives[0] as Extract<typeof primitive,{kind:"axisAlignedRectangle"}>).roofIntent=deriveRectangleRoofIntent({roofIntent:form.roofIntent,widthMm:width,depthMm:depth});
  if(h.roof.fasciaHeightMm!==undefined)form.fasciaHeightMm=h.roof.fasciaHeightMm;
  const spatial={schemaVersion:'object_first_workbench.vnext',houseAssembly:{id:'derived',label:'House',houseForms:[form]},pergolas:[],decks:[],openings:[]} as unknown as ObjectFirstWorkbenchDraftVNext;
  const model=buildProjectHouseGeometryRegistry(buildWorkbenchProjectModelFromObjectFirstDraft(spatial))[0]?.model;
  if(!model||model.metadata?.roofQaStatus!=='valid'||!model.roofPlanes.length)throw Error('This house roof cannot be resolved. Your choices are kept.');
  const world=(polygon:Point3[])=>polygon.map(p=>houseWorld(h,p));
  return {house:h,model,footprint:world(model.footprint),walls:model.wallSegments.map(w=>world(w.boundary)),roof:model.roofPlanes.map(r=>world(r.boundary)),eaves:(model.eave?.fasciaPolygons??[]).map(world),soffits:(model.eave?.soffitPolygons??[]).map(world)};
}
export type StudioHouseTarget={houseId:string;side:HouseSide;kind:'wall'|'eave';label:string;start:Point3;end:Point3;centre:Point3;heightMm:number;error:string|null};
/** Side identity is local geometry, never an index from a regenerated edge array. */
export function studioHouseTargets(h:StudioHouse,method:'facade'|'fascia'|'soffit'='fascia'):StudioHouseTarget[]{
  const solved=solveStudioHouse(h),w=Number(h.widthMm),d=Number(h.depthMm),o=Number(h.roof.overhangMm),out:StudioHouseTarget[]=[];
  for(const side of ['front','right','rear','left'] as const)for(const kind of ['wall','eave'] as const){
    const axis=side==='front'||side==='rear'?'y':'x';
    const polygons=method==='soffit'?solved.model.eave?.soffitPolygons:solved.model.eave?.fasciaPolygons;
    const actual=(polygons??[]).flat().map(p=>p[axis]);
    const plane=kind==='wall'?(side==='front'||side==='left'?0:side==='right'?w:d)
      :side==='front'||side==='left'?Math.min(...actual):Math.max(...actual);
    const atSide=(p:Point3)=>Math.abs(p[axis]-plane)<1e-5;
    const lines=kind==='wall'?solved.model.wallSegments.map(s=>[s.boundary[3],s.boundary[2]]):(polygons??[]).flatMap(polygon=>{
      const edges=polygon.map((p,i)=>[p,polygon[(i+1)%polygon.length]]).filter(l=>l.every(atSide)&&Math.hypot(l[1].x-l[0].x,l[1].y-l[0].y)>1e-5);
      // A fascia has a top and bottom edge on the same vertical face. Select its actual lower boundary.
      // A soffit has one boundary at the outer eave plane; never synthesize an offset from the roof top.
      if(method==='soffit')return edges.length===1?edges:[];
      const ordered=edges.sort((a,b)=>(a[0].z+a[1].z)-(b[0].z+b[1].z));return ordered.length?[ordered[0]]:[];
    });
    const candidates=lines.filter(l=>l.length===2&&l.every(p=>p&&atSide(p)));
    const line=candidates.length===1?candidates[0]:null;
    if(!line)continue;
    const start=houseWorld(h,line[0]),end=houseWorld(h,line[1]);
    out.push({houseId:h.id,side,kind,label:`${h.label} · ${side} ${kind==='wall'?'wall':'roof edge'}`,start,end,centre:houseWorld(h,{x:w/2,y:d/2,z:0}),heightMm:start.z,error:Math.abs(start.z-end.z)>1e-5?'This edge slopes. Choose a level wall or roof edge.':null});
  }
  return out;
}
