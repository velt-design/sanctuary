import 'server-only';
import {STUDIO_DOCUMENT_RENDERER_VERSION,STUDIO_DOCUMENT_SOURCE_SCHEMA,isApprovedStudioDocumentLayout,approvedStudioDocumentPages,type StudioClientDocumentSource,type StudioDocumentMesh} from '@sp/studio-documents/contract';
import {buildRepresentativeBlind,buildRepresentativeSidePanel,representativeBlindOpenings,pergolaLightSites,type Point3} from '@sp/geometry';
import {sidePanelSupports,effectiveLightingLayout,describeRoofBattens,describeSidePanels,describeBlinds,describeLighting} from '@sp/configurator/website';
import {roofFinishDescription} from '@sp/configurator/geometry';
import type {StudioAuthoringEdit} from './authoringView';
import {createStudioSceneResolver} from './interaction/resolvedScene';

/** Frozen drawing projection of the same complete scene used by Studio. There
 * is no alternate layout, section schedule, pricing solve, or survey inference. */
export function projectStudioClientDocument(edit:StudioAuthoringEdit,identity:{snapshotId:string;contentHash:string;designVersionLabel:string;projectName:string;siteAddress:string;issuedDate:string;issuedAt?:string;layoutVersion?:StudioClientDocumentSource['layoutVersion']}):StudioClientDocumentSource{
 const scene=createStudioSceneResolver().resolve(edit);
 if(scene.arrangementEligibility||scene.products.some(p=>p.error||!p.geometry||!p.position||!p.design))throw Error('The saved design cannot yet produce complete drawings.');
 const products=scene.products.map((p,index)=>{
  const geometry=p.geometry!,design=p.design!,roof=design.roof;
  const accessories:StudioDocumentMesh[]=[],openings=representativeBlindOpenings(geometry.assembly,p.geometryOptions);
  for(const blind of roof.blinds??[]){const opening=openings.find(o=>o.id===blind.opening);if(!opening)throw Error('A selected blind opening is unavailable.');
   for(const [i,m] of buildRepresentativeBlind(opening,blind).entries())accessories.push({id:`${blind.opening}:blind:${i}`,kind:m.kind==='fabric'?'fabric':m.kind==='infill'?'acrylic':'frame',positions:m.positions,indices:m.indices});}
  for(const side of roof.sidePanels??[]){const opening=openings.find(o=>o.id===side.opening);if(!opening)throw Error('A selected side panel is unavailable.');
   for(const [i,m] of buildRepresentativeSidePanel(opening,side,sidePanelSupports(opening,side)).entries())accessories.push({id:`${side.opening}:panel:${i}`,kind:m.kind,positions:m.positions,indices:m.indices});}
  const lights=roof.lighting?effectiveLightingLayout(pergolaLightSites(geometry.assembly,geometry.covering),roof.lighting):null;
  // Drawn light locations use the canonical selected layout. These small markers
  // are document symbols, not a new fixture/dimension or electrical specification.
  for(const light of [...lights?.rafters??[],...lights?.cedar??[]])accessories.push(lightMarker(light.id,light.point,light.diameter));
  for(const strip of lights?.strips??[])accessories.push({id:strip.id,kind:'light',positions:[strip.start.x,strip.start.y,strip.start.z,strip.end.x,strip.end.y,strip.end.z],indices:[]});
  return{id:p.object.id,label:p.object.label,code:`P${String(index+1).padStart(2,'0')}`,pose:p.position!,widthMm:design.input.widthMm,projectionMm:design.input.projectionMm,
   roofLabel:roof.family==='mono'?'Pitched':roof.family==='gable'?'Gable':'Box perimeter',roofMaterial:[roofFinishDescription(roof),...(roof.roofBattens?[describeRoofBattens(roof.roofBattens)]:[])].join('; '),frameFinish:roof.frameFinish==='white'?'White' as const:'Black' as const,
   selectedDetails:[roofFinishDescription(roof),...(roof.roofBattens?[describeRoofBattens(roof.roofBattens)]:[]),...(roof.sidePanels?.length?[describeSidePanels(roof.sidePanels)]:[]),...(roof.blinds?.length?[describeBlinds(roof.blinds)]:[]),...(lights?[describeLighting(lights.selection,'resolved')]:[])],
   extras:{infills:roof.sidePanels?.length?[describeSidePanels(roof.sidePanels)]:[],blinds:roof.blinds?.length?[describeBlinds(roof.blinds)]:[],lights:lights?[describeLighting(lights.selection,'resolved')]:[]},
   assembly:geometry.assembly,plan:geometry.plan,viewerScene:geometry.viewerScene,...(geometry.covering?{covering:geometry.covering}:{}),accessories,
   ...(isApprovedStudioDocumentLayout(identity.layoutVersion)?{drawingDetails:{finish:roof.finish??{material:'acrylic'},lights:lights?{rafters:lights.rafters,cedar:lights.cedar,strips:lights.strips}:{rafters:[],cedar:[],strips:[]},blinds:(roof.blinds??[]).map(blind=>({opening:openings.find(o=>o.id===blind.opening)!,lowered:blind.lowered,description:describeBlinds([blind]),cover:blind.cover}))}}:{})};
 });
 const source:StudioClientDocumentSource={schemaVersion:STUDIO_DOCUMENT_SOURCE_SCHEMA,rendererVersion:STUDIO_DOCUMENT_RENDERER_VERSION,...identity,issuedAt:identity.issuedAt??new Date().toISOString(),designId:edit.designId,revision:edit.revision,products,
  houses:scene.houses.map(h=>({id:h.house.id,label:h.house.label,footprint:h.footprint,roof:h.roof,walls:h.walls,model:h.model,appearance:h.house.source.appearance??null,pose:h.house.position})),
  joins:scene.joins.map(j=>{if(j.error)throw Error(j.error);const witness=j.witness;
   return{id:j.join.id,objectIds:[j.join.a.objectId,j.join.b.objectId],label:j.label,polygons:witness?[witness.contact.map(point=>({x:witness.normal.x*witness.plane-witness.normal.y*point.x,y:witness.normal.y*witness.plane+witness.normal.x*point.x,z:point.y}))]:[]};})};
 if(isApprovedStudioDocumentLayout(identity.layoutVersion))source.pageManifest=approvedStudioDocumentPages(source);
 // Only serializable immutable owned drawing data crosses the durable boundary.
 return JSON.parse(JSON.stringify(source)) as StudioClientDocumentSource;
}
function lightMarker(id:string,p:Point3,diameter:number):StudioDocumentMesh{
 const r=diameter/2,positions:number[]=[];for(let i=0;i<16;i++){const a=i*Math.PI/8;positions.push(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,p.z);}
 return{id,kind:'light',positions,indices:Array.from({length:14},(_,i)=>[0,i+1,i+2]).flat()};
}
