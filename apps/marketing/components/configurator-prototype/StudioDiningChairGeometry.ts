import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { mergeBufferGeometries, mergeVertices, RoundedBoxGeometry } from 'three-stdlib';

type Section = { x: number; y: number; z: number; width: number; depth: number };

/** A gently bevelled rectangular extrusion through explicit joint sections. */
function upright(sections: Section[]) {
  const positions: number[] = [], indices: number[] = [];
  for (const { x, y, z, width, depth } of sections) {
    const w = width / 2, d = depth / 2, r = 3;
    for (const [dx, dy] of [[-w+r,-d],[w-r,-d],[w,-d+r],[w,d-r],[w-r,d],[-w+r,d],[-w,d-r],[-w,-d+r]]) {
      positions.push(x+dx,y+dy,z);
    }
  }
  for (let ring=0; ring<sections.length-1; ring++) for (let i=0; i<8; i++) {
    const a=ring*8+i, b=ring*8+(i+1)%8, c=b+8, d=a+8;
    indices.push(a,b,d,b,c,d);
  }
  for (let i=1;i<7;i++) {
    indices.push(0,i+1,i);
    const top=(sections.length-1)*8;
    indices.push(top,top+i,top+i+1);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const flat=geometry.toNonIndexed();
  flat.setAttribute('uv',new Float32BufferAttribute(new Float32Array(flat.attributes.position.count*2),2));
  geometry.dispose();
  return flat;
}

function softBox(width:number,depth:number,height:number,radius:number) {
  return new RoundedBoxGeometry(width,depth,height,2,radius);
}

function smoothSurface(geometry:BufferGeometry) {
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  const welded=mergeVertices(geometry,.001);
  welded.computeVertexNormals();
  welded.setAttribute('uv',new Float32BufferAttribute(new Float32Array(welded.attributes.position.count*2),2));
  const surface=welded.toNonIndexed();
  welded.dispose();geometry.dispose();
  surface.computeBoundingBox();surface.computeBoundingSphere();
  return surface;
}

/** Sole geometry owner for this decorative chair; no product/structural geometry. */
export function createDiningChairGeometry() {
  const parts:BufferGeometry[]=[];
  for (const side of [-1,1]) {
    parts.push(upright([
      {x:side*232,y:-229,z:8,width:25,depth:27},
      {x:side*218,y:-198,z:429,width:39,depth:39},
      {x:side*218,y:-198,z:447,width:40,depth:40},
    ]));
    parts.push(upright([
      {x:side*234,y:264,z:8,width:25,depth:29},
      {x:side*210,y:181,z:424,width:39,depth:42},
      {x:side*211,y:188,z:474,width:37,depth:40},
      {x:side*224,y:219,z:635,width:33,depth:36},
      {x:side*236,y:244,z:822,width:31,depth:33},
    ]));
  }
  const seat=softBox(480,448,31,12);
  seat.translate(0,-7,439);
  parts.push(seat);
  // The broad face needs real interior subdivisions: a rounded box alone only
  // subdivides its edge bevel and would leave a flat back between the sides.
  const indexedBack=new BoxGeometry(496,27,183,24,2,8);
  const back=indexedBack.toNonIndexed();
  indexedBack.dispose();
  const backPositions=back.attributes.position;
  for(let i=0;i<backPositions.count;i++) {
    const raw=new Vector3().fromBufferAttribute(backPositions,i);
    const inner=new Vector3(Math.max(-242,Math.min(242,raw.x)),Math.max(-7.5,Math.min(7.5,raw.y)),Math.max(-85.5,Math.min(85.5,raw.z)));
    const rounded=raw.sub(inner).normalize().multiplyScalar(6).add(inner);
    const {x,y,z}=rounded;
    backPositions.setXYZ(i,x,y+284-46*(x/248)**2+z*.12,z+739+8*(1-(x/248)**2));
  }
  back.computeVertexNormals();
  parts.push(smoothSurface(back));
  const frame=mergeBufferGeometries(parts,false)!;
  parts.forEach(part=>part.dispose());
  frame.computeBoundingBox();
  frame.computeBoundingSphere();
  const cushion=softBox(440,406,28,13);
  const p=cushion.attributes.position;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const crown=4*Math.max(0,1-(x/220)**2)*Math.max(0,1-(y/203)**2);
    p.setZ(i,z+(z>0?crown:0));
  }
  cushion.computeVertexNormals();
  cushion.computeBoundingBox();
  cushion.computeBoundingSphere();
  return {frame,cushion:smoothSurface(cushion)};
}
