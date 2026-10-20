import {finiteAxisAlignments, type Point,type Segment} from './finitePlacement';
export type AxisGuide={key:string;axis:'x'|'y';movingEdge:number;moving:Segment;target:Segment;label:string;correction:number;score:number};
export type AlignmentLine=Segment&{id:string;label:string};
export function axisChoices(points:Point[],lines:AlignmentLine[],units:number,held:string=''){
 return lines.flatMap(line=>finiteAxisAlignments(points,line,18*units).flatMap(hit=>{
  const key=`${line.id}:moving:${hit.movingEdge}`,retained=held.split('|').includes(key)||held===line.id;
  if(hit.distance>(retained?18:14)*units)return [];
  return [{key,axis:hit.axis,movingEdge:hit.movingEdge,moving:hit.moving,target:line,label:line.label,correction:hit.correction,score:hit.distance-(retained?3*units:0)}];
 })).sort((a,b)=>a.score-b.score||a.key.localeCompare(b.key));
}
/** Recheck the SAME finite witness after composing independent translations. */
export function validAxisGuide(points:Point[],guide:AxisGuide,units:number){
 return finiteAxisAlignments(points,guide.target,18*units).some(hit=>hit.movingEdge===guide.movingEdge&&hit.axis===guide.axis&&Math.abs(hit.correction)<.001);
}
export function composeAxisAlignment(points:Point[],choices:AxisGuide[],units:number){
 let x=choices.find(c=>c.axis==='x'),y=choices.find(c=>c.axis==='y');
 const moved=()=>points.map(p=>({x:p.x+(x?.correction??0),y:p.y+(y?.correction??0)}));
 // One constraint cannot move the other beyond its finite segment's locality.
 for(let n=0;n<2;n++){
  const next=moved(),badX=x&&!validAxisGuide(next,x,units),badY=y&&!validAxisGuide(next,y,units);
  if(!badX&&!badY)break;
  if(badX&&badY){if(x!.score<=y!.score)y=undefined;else x=undefined;}
  else if(badX)x=undefined;else y=undefined;
 }
 return {points:moved(),dx:x?.correction??0,dy:y?.correction??0,guides:[x,y].filter((g):g is AxisGuide=>!!g)};
}
