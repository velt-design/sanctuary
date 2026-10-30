'use client';
/** Painted edge and label share a forgiving hit area without changing geometry. */
export function JoinPlanTarget({target,onChoose,unitsPerPixel}:{target:{label:string;start:{x:number;y:number};end:{x:number;y:number}};onChoose:()=>void;unitsPerPixel?:number}){
 const size=unitsPerPixel?13*unitsPerPixel:130,labelHeight=unitsPerPixel?28*unitsPerPixel:280;
 const labelWidth=Math.max(size*2,target.label.length*size*.62);
 const x=(target.start.x+target.end.x)/2,y=(target.start.y+target.end.y)/2;
 return <g role="button" tabIndex={0} aria-label={`Join target ${target.label}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onChoose();}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onChoose();}}}>
  <line x1={target.start.x} y1={target.start.y} x2={target.end.x} y2={target.end.y} stroke="transparent" strokeWidth={24} vectorEffect="non-scaling-stroke" pointerEvents="stroke"/>
  <rect x={unitsPerPixel?x-labelWidth/2:x} y={y-labelHeight} width={labelWidth} height={labelHeight} fill="transparent" pointerEvents="all"/>
  <line x1={target.start.x} y1={target.start.y} x2={target.end.x} y2={target.end.y} stroke="#826344" strokeWidth={60} pointerEvents="none"/>
  <text textAnchor={unitsPerPixel?'middle':undefined} x={x} y={y-size*.85} fontSize={size} pointerEvents="none">{target.label}</text>
 </g>;
}
