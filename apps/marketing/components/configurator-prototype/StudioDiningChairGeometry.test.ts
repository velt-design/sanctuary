import { describe, expect, it } from 'vitest';
import { Box3, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import { createDiningChairGeometry } from './StudioDiningChairGeometry';

describe('illustrative dining chair geometry',()=>{
  it('stays inside the existing chair envelope and preserves seat height',()=>{
    const {frame,cushion}=createDiningChairGeometry();
    const bounds=frame.boundingBox!;
    expect(bounds.min.x).toBeGreaterThanOrEqual(-270);
    expect(bounds.max.x).toBeLessThanOrEqual(270);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-285);
    expect(bounds.max.y).toBeLessThanOrEqual(315);
    expect(bounds.min.z).toBeGreaterThanOrEqual(0);
    expect(bounds.max.z).toBeLessThanOrEqual(845);
    const seatBounds=cushion.boundingBox!.clone().translate(new Vector3(0,-14,467));
    expect(seatBounds.min.z).toBeGreaterThan(450);
    expect(seatBounds.max.z).toBeLessThan(490);
    expect(new Box3().union(bounds).union(seatBounds).getSize(new Vector3()).z).toBeLessThan(845);
    frame.dispose();cushion.dispose();
  });
  it('has continuous rear uprights through the seat and an open gap beneath the curved back',()=>{
    const {frame,cushion}=createDiningChairGeometry();
    const material=new MeshBasicMaterial();
    const mesh=new Mesh(frame,material);mesh.updateMatrixWorld();
    const hit=(x:number,z:number)=>new Raycaster(new Vector3(x,-1000,z),new Vector3(0,1,0)).intersectObject(mesh);
    for(const side of [-1,1]) for(const height of [440,460,480,500,550,600]) expect(hit(side*213,height).length).toBeGreaterThan(0);
    expect(hit(0,560)).toHaveLength(0);
    const center=hit(0,735)[0].point.y, wing=hit(225,735)[0].point.y;
    expect(center-wing).toBeGreaterThan(25);
    frame.dispose();cushion.dispose();material.dispose();
  });
  it('provides finite positions and outward-wound solid components within a repeated-chair budget',()=>{
    const geometry=createDiningChairGeometry();
    let triangles=0;
    for(const mesh of Object.values(geometry)){
      const p=mesh.attributes.position,n=mesh.attributes.normal;
      let signedVolume=0;
      const edges=new Map<string,{count:number;winding:number}>();
      const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(3)).join(',');
      for(let i=0;i<p.count;i++){
        expect([p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite)).toBe(true);
        expect(new Vector3().fromBufferAttribute(n,i).length()).toBeCloseTo(1,4);
      }
      for(let i=0;i<p.count;i+=3){
        const a=new Vector3().fromBufferAttribute(p,i), b=new Vector3().fromBufferAttribute(p,i+1), c=new Vector3().fromBufferAttribute(p,i+2);
        signedVolume+=a.dot(b.cross(c))/6;
        for(const [start,end] of [[i,i+1],[i+1,i+2],[i+2,i]]){
          const from=key(start),to=key(end),edge=[from,to].sort().join('|');
          const value=edges.get(edge)??{count:0,winding:0};
          value.count++;value.winding+=from<to?1:-1;edges.set(edge,value);
        }
      }
      expect(signedVolume).toBeGreaterThan(0);
      // Each spatial edge belongs to two oppositely wound triangles: no holes or inverted seams.
      expect([...edges.values()].every(edge=>edge.count===2&&edge.winding===0)).toBe(true);
      triangles+=p.count/3;
      mesh.dispose();
    }
    // Prior model: two RoundedBoxes and seven cuboid rails; exclude unchanged contact plane.
    const oldSeat=new RoundedBoxGeometry(500,460,85,3,32),oldBack=new RoundedBoxGeometry(540,95,245,4,36);
    const previous=oldSeat.attributes.position.count/3+oldBack.attributes.position.count/3+7*12;
    expect(triangles).toBeLessThan(previous*1.15);
    expect(triangles*6).toBeLessThan(12000);
    oldSeat.dispose();oldBack.dispose();
  });
});
