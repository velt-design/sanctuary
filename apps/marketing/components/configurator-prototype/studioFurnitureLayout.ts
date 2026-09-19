import { furnitureCatalog, type FurnitureKind } from './studioFurnitureCatalog';
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
export type FurniturePlacement = { kind: FurnitureKind; x: number; y: number; rotation: number; bounds: Bounds };
type Post = { x: number; y: number; radius: number };
export const FURNITURE_AISLE = 650;
const edge = 150;
const kinds = Object.keys(furnitureCatalog) as FurnitureKind[];
function footprint(kind: FurnitureKind, rotated: boolean) {
  const [w,d] = furnitureCatalog[kind].size;
  return rotated ? [d,w] : [w,d];
}
function place(kind: FurnitureKind, x: number, y: number, rotated: boolean, facesRight = false): FurniturePlacement {
  const [w,d] = footprint(kind,rotated);
  return {kind,x,y,rotation:rotated?(facesRight?-1:1)*Math.PI/2:0,bounds:{minX:x-w/2,maxX:x+w/2,minY:y-d/2,maxY:y+d/2}};
}
/** Rear access strip plus connected side/central aisle; furniture is never scaled. */
export function studioFurnitureLayout(extents: Bounds, posts: Post[] = [], preference?: 'social' | 'mixed'): FurniturePlacement[] {
  const inner={minX:extents.minX+edge,maxX:extents.maxX-edge,minY:extents.minY+FURNITURE_AISLE,maxY:extents.maxY-edge};
  const w=inner.maxX-inner.minX,d=inner.maxY-inner.minY;
  const candidates: {items:FurniturePlacement[];score:number}[]=[];
  const fits=({bounds:b}:FurniturePlacement)=>b.minX>=inner.minX-.001&&b.maxX<=inner.maxX+.001&&b.minY>=inner.minY-.001&&b.maxY<=inner.maxY+.001&&!posts.some(p=>p.x+p.radius+100>b.minX&&p.x-p.radius-100<b.maxX&&p.y+p.radius+100>b.minY&&p.y-p.radius-100<b.maxY);
  const add=(items:FurniturePlacement[])=>{
    if(!items.every(fits))return;
    // A casual bench place is useful, but should not displace more comfortable
    // lounge/dining arrangements simply to maximise the illustrated headcount.
    const capacity=items.reduce((sum,p)=>sum+furnitureCatalog[p.kind].seats*(furnitureCatalog[p.kind].use==='bench'?7:10),0);
    const mixed=new Set(items.map(p=>furnitureCatalog[p.kind].use)).size>1;
    const quality=items.reduce((sum,p)=>sum+furnitureCatalog[p.kind].quality,0);
    const comfortable=items.some(p=>furnitureCatalog[p.kind].use!=='bench');
    const occupied=items.reduce((sum,p)=>sum+(p.bounds.maxX-p.bounds.minX)*(p.bounds.maxY-p.bounds.minY),0)/(w*d);
    const score=capacity+quality+(comfortable?50:0)+(mixed?12:0)+occupied*5+(preference==='mixed'&&mixed?100:0)+(preference==='social'&&items.length===1&&items[0].kind==='social'?100:0);
    candidates.push({items,score});
  };
  for(const kind of kinds)for(const rotated of [false,true]){
    const [a,b]=footprint(kind,rotated);
    if(a+FURNITURE_AISLE>w||b>d)continue;
    for(const side of [0,1])for(const fraction of [0,.5,1]){
      const x=inner.minX+(w-FURNITURE_AISLE)/2+side*FURNITURE_AISLE;
      add([place(kind,x,inner.minY+b/2+(d-b)*fraction,rotated,side===0)]);
    }
  }
  const lounges=kinds.filter(k=>furnitureCatalog[k].use==='lounge');
  const dining=kinds.filter(k=>furnitureCatalog[k].use==='dining');
  const pairs= lounges.flatMap(left=>dining.map(right=>[left,right] as const));
  pairs.push(['sofa-nook','sofa-nook']);
  // Casual groups cover very shallow terraces. Ranking favours comfortable
  // lounge/dining as it fits, without an abrupt depth cutoff removing capacity.
  for(const left of ['bench','bench-social'] as const)for(const right of ['bench','bench-social'] as const)pairs.push([left,right]);
  for(const [left,right] of pairs)for(const r1 of [false,true])for(const r2 of [false,true]){
    const [a,b]=footprint(left,r1),[c,e]=footprint(right,r2);
    // Side-by-side: the middle route connects both open edges.
    if(a+c+FURNITURE_AISLE<=w&&Math.max(b,e)<=d){
      const start=inner.minX+(w-a-c-FURNITURE_AISLE)/2;
      for(const mirror of [false,true]){
        const first=mirror?right:left,second=mirror?left:right;
        const fw=mirror?c:a,sw=mirror?a:c,fd=mirror?e:b,sd=mirror?b:e;
        add([place(first,start+fw/2,inner.minY+fd/2,mirror?r2:r1,true),place(second,start+fw+FURNITURE_AISLE+sw/2,inner.minY+sd/2,mirror?r1:r2)]);
      }
    }
    // In sequence: side route alongside both settings plus cross aisle.
    if(Math.max(a,c)+FURNITURE_AISLE<=w&&b+e+FURNITURE_AISLE<=d){
      const x=inner.minX+(w-FURNITURE_AISLE)/2;
      add([place(left,x,inner.minY+b/2,r1,true),place(right,x,inner.minY+b+FURNITURE_AISLE+e/2,r2,true)]);
    }
  }
  return candidates.sort((a,b)=>b.score-a.score)[0]?.items??[];
}
