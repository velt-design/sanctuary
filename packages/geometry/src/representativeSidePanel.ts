import type { BlindOpening } from './representativeBlindOpenings';
export type SidePanelMesh={kind:'frame'|'timber'|'acrylic';positions:number[];indices:number[]};
/** Fixed sides are visual assemblies; support positions are supplied by the owning rules. */
export function buildRepresentativeSidePanel(o:BlindOpening,p:{kind:'acrylic'|'timber'|'aluminium';profile:string;edge:boolean;gap:number;frame:number;battens:boolean;direction?:'horizontal'|'vertical'},supports:number[]):SidePanelMesh[]{
  const meshes:SidePanelMesh[]=[];
  const make=(kind:SidePanelMesh['kind'])=>{const m={kind,positions:[] as number[],indices:[] as number[]};meshes.push(m);return m;};
  const frame=make('frame'),u={x:(o.end.x-o.start.x)/o.width,y:(o.end.y-o.start.y)/o.width};
  const n=o.side==='front'?{x:0,y:1}:o.side==='left'?{x:-1,y:0}:{x:1,y:0};
  const point=(x:number,y:number,z:number)=>[o.start.x+x*u.x+y*n.x,o.start.y+x*u.y+y*n.y,z];
  const quad=(m:SidePanelMesh,pts:number[][])=>{const i=m.positions.length/3;m.positions.push(...pts.flat());m.indices.push(i,i+1,i+2,i,i+2,i+3);};
  const top=(x:number)=>{
    if(!o.headerDepth)return o.top;
    const t=x/o.width*2,i=Math.min(1,Math.floor(t));return o.roofLine[i].z+(o.roofLine[i+1].z-o.roofLine[i].z)*(t-i);
  };
  function prism(m:SidePanelMesh,x1:number,x2:number,y1:number,y2:number,z1:number,z2a:number,z2b=z2a){
    const v=[point(x1,y1,z1),point(x2,y1,z1),point(x2,y2,z1),point(x1,y2,z1),point(x1,y1,z2a),point(x2,y1,z2b),point(x2,y2,z2b),point(x1,y2,z2a)];
    for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])quad(m,f.map(i=>v[i]));
  }
  const acrylic=p.kind==='acrylic',face=50,depth=acrylic?p.frame:50;
  const vertical=!acrylic&&p.direction==='vertical';
  const jambs=vertical?[0,o.width]:supports;
  // Supports behind slats; a 50x50x3 angle forms the standalone perimeter.
  for(const x of jambs){const a=Math.max(0,x-face/2),b=Math.min(o.width,x+face/2),edge=x===0||x===o.width;prism(frame,a,b,!acrylic&&!edge?-75:-depth/2,acrylic?depth/2:!edge?-25:-depth/2+3,25,top(a),top(b));if(!acrylic&&edge)prism(frame,x===0?0:o.width-3,x===0?3:o.width,-25,25,0,top(a),top(b));}
  if(vertical)for(const z of supports.slice(1,-1))for(let segment=0;segment<2;segment++){
    let a=segment*o.width/2,b=(segment+1)*o.width/2;const za=top(a),zb=top(b);
    if(Math.max(za,zb)<z+25)continue;
    if(za<z+25)a+=(b-a)*(z+25-za)/(zb-za);
    else if(zb<z+25)b=a+(b-a)*(za-z-25)/(za-zb);
    if(b>a)prism(frame,a,b,-75,-25,z-25,z+25);
  }
  prism(frame,0,o.width,-depth/2,depth/2,0,acrylic?50:3);
  if(!acrylic)prism(frame,0,o.width,-25,-22,0,50);
  // Top cap follows both segments of a pitched/triangular opening.
  for(let i=0;i<2;i++){
    const a=o.width*i/2,b=o.width*(i+1)/2,zA=top(a),zB=top(b),thickness=acrylic?50:3;
    const v=[point(a,-depth/2,zA-thickness),point(b,-depth/2,zB-thickness),point(b,depth/2,zB-thickness),point(a,depth/2,zA-thickness),point(a,-depth/2,zA),point(b,-depth/2,zB),point(b,depth/2,zB),point(a,depth/2,zA)];
    for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])quad(frame,f.map(j=>v[j]));
  }
  if(acrylic){const glass=make('acrylic');for(let i=1;i<supports.length;i++){
    const a=supports[i-1]+25,b=supports[i]-25;if(b<=a)continue;
    const cuts=[a,...(a<o.width/2&&b>o.width/2?[o.width/2]:[]),b];
    for(let j=1;j<cuts.length;j++)quad(glass,[point(cuts[j-1],0,50),point(cuts[j],0,50),point(cuts[j],0,top(cuts[j])-50),point(cuts[j-1],0,top(cuts[j-1])-50)]);
  }}
  if(!acrylic||p.battens){
    const timber=p.kind!=='aluminium',m=timber?make('timber'):frame;
    const dims=p.profile.split('x').map(Number),height=dims[p.edge?1:0],thick=dims[p.edge?0:1];
    if(vertical){
      const count=Math.max(1,Math.floor((o.width-6+p.gap)/(height+p.gap))),offset=(o.width-(count*height+(count-1)*p.gap))/2;
      for(let i=0;i<count;i++){const a=offset+i*(height+p.gap),b=a+height;prism(m,a,b,-22,-22+thick,3,top(a)-3,top(b)-3);}
      return meshes.filter(m=>m.positions.length);
    }
    const max=Math.max(top(0),top(o.width/2),top(o.width))-50,min=50;
    const count=Math.max(1,Math.floor((max-min+p.gap)/(height+p.gap))),offset=min+(max-min-(count*height+(count-1)*p.gap))/2;
    const y=acrylic?depth/2+2:-22;
    for(let i=0;i<count;i++){
      const z=offset+i*(height+p.gap);
      for(let segment=0;segment<2;segment++){
        let a=segment*o.width/2,b=(segment+1)*o.width/2;const za=top(a)-50,zb=top(b)-50;
        if(Math.max(za,zb)<z+height)continue;
        if(za<z+height)a+=(b-a)*(z+height-za)/(zb-za);
        else if(zb<z+height)b=a+(b-a)*(za-z-height)/(za-zb);
        a=Math.max(3,a);b=Math.min(o.width-3,b);if(b>a)prism(m,a,b,y,y+thick,z,z+height);
      }
    }
  }
  return meshes.filter(m=>m.positions.length);
}
