import {parseWebsiteJoins} from './websiteJoinIntent';
import {websiteProductPhysical} from './websiteProductPhysical';
import {contactWebsiteEdges} from './websiteJoinGeometry';
import {solvePergolaPreview} from '@sp/configurator/geometry';
import {sidePanelSupports} from '@sp/configurator/website';
import {buildRepresentativeBlind,buildRepresentativeSidePanel,representativeBlindOpenings} from '@sp/geometry';
import {transformWebsitePoint,websiteComposition} from './websiteComposition';

/** Conservative temporary eligibility for separated products, never a collision or join certificate. */
export function websiteCompositionPriceEligibility(rows:ReturnType<typeof websiteComposition>,joinValue?:unknown):string|null {
 const validPairs=new Set<string>();
 try{for(const join of joinValue?parseWebsiteJoins(joinValue,new Set(rows.map(r=>r.object.id))).joins:[]){
  const a=rows.find(r=>r.object.id===join.a.objectId)!,b=rows.find(r=>r.object.id===join.b.objectId)!;
  try{if(!a.position||!b.position)throw Error('Placement unavailable.');contactWebsiteEdges(websiteProductPhysical(a),join.a.edge,a.position,websiteProductPhysical(b),join.b.edge,b.position);validPairs.add(JSON.stringify([a.object.id,b.object.id].sort()));}
  catch(error){return `${a.object.label} / ${b.object.label}: ${error instanceof Error?error.message:'Join unavailable.'}`;}
 }}catch(error){return error instanceof Error?error.message:'Invalid joins.';}
 const bounds=[];
 for(const row of rows){
  if(row.error||!row.design||!row.position)return `${row.object.label}: ${row.error??'Design geometry unavailable.'}`;
  const geometry=solvePergolaPreview(row.design.input,row.design.roof,row.geometryOptions).geometry;
  if(!geometry)return `${row.object.label}: design geometry unavailable.`;
  const points:{x:number;y:number;z:number}[]=[];
  function meshPositions(values:unknown[]){
   if(values.length%3 || values.some(v=>typeof v!=='number'||!Number.isFinite(v))){points.push({x:NaN,y:NaN,z:NaN});return;}
   for(let i=0;i<values.length;i+=3)points.push({x:values[i] as number,y:values[i+1] as number,z:values[i+2] as number});
  }
  for(const m of geometry.assembly.members){
   const radius=Math.hypot(m.profile.widthMm,m.profile.depthMm)/2;
   for(const p of [m.centerline.start,m.centerline.end])for(const dx of [-radius,radius])for(const dy of [-radius,radius])points.push({...p,x:p.x+dx,y:p.y+dy});
  }
  // Covering contains actual roof/batten/ceiling boundaries. Including its local
  // vectors is conservative; no point can shrink the physical envelope.
  function collect(value:unknown):void{if(Array.isArray(value)){value.forEach(collect);return;}if(!value||typeof value!=='object')return;const p=value as Record<string,unknown>;if(typeof p.x==='number'&&typeof p.y==='number'&&typeof p.z==='number')points.push({x:p.x,y:p.y,z:p.z});else {if(Array.isArray(p.positions))meshPositions(p.positions);Object.entries(p).filter(([key])=>key!=='positions').forEach(([,child])=>collect(child));}}
  collect(geometry.covering);collect(geometry.assembly.roofPlanes);collect(geometry.assembly.roofCladdingPanels);collect(geometry.assembly.roofFlashings);
  const openings=representativeBlindOpenings(geometry.assembly);
  const meshes=[...(row.design.roof.blinds??[]).flatMap(b=>{const o=openings.find(o=>o.id===b.opening);return o?buildRepresentativeBlind(o,b):[];}),
   ...(row.design.roof.sidePanels??[]).flatMap(p=>{const o=openings.find(o=>o.id===p.opening);return o?buildRepresentativeSidePanel(o,p,sidePanelSupports(o,p)):[];})];
  for(const mesh of meshes)meshPositions(mesh.positions);
  const world=points.map(p=>transformWebsitePoint(p,row.position!));
  if(!world.length||world.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))return `${row.object.label}: physical bounds unavailable.`;
  bounds.push(world.reduce((b,p)=>({...b,minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minY:Math.min(b.minY,p.y),maxY:Math.max(b.maxY,p.y)}),
    {id:row.object.id,name:row.object.label,minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity}));
 }
 for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){const a=bounds[i],b=bounds[j];if(validPairs.has(JSON.stringify([a.id,b.id].sort())))continue;if(a.minX<=b.maxX&&b.minX<=a.maxX&&a.minY<=b.maxY&&b.minY<=a.maxY)return `Cannot price this arrangement yet: ${a.name} and ${b.name} have touching or overlapping conservative bounds. Separate them before calculating; their choices are kept.`;}
 return null;
}
