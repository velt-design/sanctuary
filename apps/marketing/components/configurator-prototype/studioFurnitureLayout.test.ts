import { describe, expect, it } from 'vitest';
import { studioFurnitureLayout, FURNITURE_AISLE } from './studioFurnitureLayout';
import { furnitureCatalog } from './studioFurnitureCatalog';
const area=(w:number,d:number)=>({minX:0,minY:0,maxX:w,maxY:d});
const seats=(w:number,d:number)=>studioFurnitureLayout(area(w,d)).reduce((n,p)=>n+furnitureCatalog[p.kind].seats,0);
describe('illustrative furniture capacity and circulation',()=>{
  it('demonstrates useful capacity in the previously undersold families',()=>{
    expect(seats(6000,3000)).toBeGreaterThanOrEqual(6);
    expect(seats(6000,2500)).toBeGreaterThanOrEqual(4);
    expect(seats(6000,2000)).toBeGreaterThanOrEqual(4);
    expect(seats(10000,2000)).toBeGreaterThanOrEqual(8);
    // A little more depth can trade casual benches for two real sofas.
    expect(seats(10000,2100)).toBeGreaterThanOrEqual(6);
    expect(seats(8600,2400)).toBeGreaterThanOrEqual(5);
    expect(studioFurnitureLayout(area(2700,4700)).some(p=>furnitureCatalog[p.kind].use==='lounge')).toBe(true);
    expect(seats(3700,2700)).toBeGreaterThanOrEqual(3);
    expect(seats(6000,4000)).toBeGreaterThanOrEqual(7);
    expect(seats(8000,5000)).toBeGreaterThanOrEqual(10);
    for(const [w,d] of [[3000,6000],[4000,6000]]) expect(studioFurnitureLayout(area(w,d))).toHaveLength(2);
  });
  it('keeps both 6x3 prototypes realistic and available for comparison',()=>{
    const social=studioFurnitureLayout(area(6000,3000),[],'social');
    expect(social.map(p=>p.kind)).toEqual(['social']);
    expect(studioFurnitureLayout(area(6000,3000),[],'mixed')).toHaveLength(2);
  });
  it('leaves genuinely tight footprints clear',()=>{
    expect(studioFurnitureLayout(area(1500,1500))).toEqual([]);
  });
  it('faces rotated lounge settings toward the connected aisle',()=>{
    for(const [w,d] of [[2800,4500],[3000,6000],[4400,3900]]){
      const layout=studioFurnitureLayout(area(w,d));
      for(const p of layout.filter(p=>p.rotation&&furnitureCatalog[p.kind].use==='lounge')){
        const other=layout.find(item=>item!==p);
        const aisleOnRight=other&&other.bounds.minX>=p.bounds.maxX
          ? true : other&&other.bounds.maxX<=p.bounds.minX
            ? false : w-150-p.bounds.maxX>=p.bounds.minX-150;
        expect(Math.sign(-Math.sin(p.rotation))).toBe(aisleOnRight?1:-1);
      }
    }
  });
  it('preserves envelopes, post clearance and connected routes at every100mm size',()=>{
    for(let w=1500;w<=10000;w+=100)for(let d=1500;d<=6000;d+=100){
      const posts=[{x:0,y:0,radius:75},{x:w,y:0,radius:75},{x:0,y:d,radius:75},{x:w,y:d,radius:75},{x:w/2,y:d,radius:75}];
      const layout=studioFurnitureLayout(area(w,d),posts);
      expect(layout.length).toBeLessThanOrEqual(2);
      for(const p of layout){
        const b=p.bounds,[cw,cd]=furnitureCatalog[p.kind].size;
        expect(b.maxX-b.minX).toBe(p.rotation?cd:cw);
        expect(b.maxY-b.minY).toBe(p.rotation?cw:cd);
        expect(b.minX).toBeGreaterThanOrEqual(150);
        expect(b.maxX).toBeLessThanOrEqual(w-150);
        expect(b.minY).toBeGreaterThanOrEqual(FURNITURE_AISLE);
        expect(b.maxY).toBeLessThanOrEqual(d-150);
        for(const post of posts)expect(post.x+post.radius+100>b.minX&&post.x-post.radius-100<b.maxX&&post.y+post.radius+100>b.minY&&post.y-post.radius-100<b.maxY).toBe(false);
      }
      if(layout.length===1){const b=layout[0].bounds;expect(Math.max(b.minX-150,w-150-b.maxX)).toBeGreaterThanOrEqual(FURNITURE_AISLE);}
      if(layout.length===2){
        const [a,b]=layout.map(p=>p.bounds);
        const gapX=Math.max(b.minX-a.maxX,a.minX-b.maxX),gapY=Math.max(b.minY-a.maxY,a.minY-b.maxY);
        expect(Math.max(gapX,gapY)).toBeGreaterThanOrEqual(FURNITURE_AISLE);
        if(gapY>=FURNITURE_AISLE)expect(Math.max(Math.min(a.minX,b.minX)-150,w-150-Math.max(a.maxX,b.maxX))).toBeGreaterThanOrEqual(FURNITURE_AISLE);
      }
    }
  });
  it('respects shifted origins and real obstructions rather than scaling sets',()=>{
    const extents={minX:1000,minY:-500,maxX:7000,maxY:2500};
    const posts=[{x:4000,y:1500,radius:600}];
    for(const p of studioFurnitureLayout(extents,posts)){
      expect(p.bounds.minX).toBeGreaterThanOrEqual(1150);
      expect(p.bounds.minY).toBeGreaterThanOrEqual(150);
      expect(p.bounds.maxX<3300||p.bounds.minX>4700||p.bounds.maxY<800||p.bounds.minY>2200).toBe(true);
    }
  });
});
