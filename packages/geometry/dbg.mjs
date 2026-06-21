import fs from "node:fs";
import { composeRoofFromComposition } from "./src/house/composition/composeRoofFromComposition.ts";
const fx = JSON.parse(fs.readFileSync("src/house/__fixtures__/composition-corpus/08-h-3rect-jess-oratia.json","utf8"));
const r = composeRoofFromComposition({ composition: fx.composition, eaveHeightMm: fx.eaveHeightMm, compositeRoofIntent: fx.compositeRoofIntent });
console.log("solver:", r.metadata.roofTopologySolver, "planes:", r.roofPlanes.length);
function planeFrom(a,b,c){ // normal via cross product
  const u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z}, v={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z};
  const n={x:u.y*v.z-u.z*v.y, y:u.z*v.x-u.x*v.z, z:u.x*v.y-u.y*v.x};
  const len=Math.hypot(n.x,n.y,n.z)||1; return {nx:n.x/len,ny:n.y/len,nz:n.z/len,d:(n.x*a.x+n.y*a.y+n.z*a.z)/len};
}
r.roofPlanes.forEach((p,i)=>{
  const b=p.boundary;
  // find first 3 non-collinear
  const pl=planeFrom(b[0],b[1],b[2]);
  let maxOff=0;
  for(const pt of b){ const off=Math.abs(pl.nx*pt.x+pl.ny*pt.y+pl.nz*pt.z-pl.d); maxOff=Math.max(maxOff,off); }
  const zs=b.map(pt=>Math.round(pt.z));
  console.log(`plane[${i}] ${p.id} pts=${b.length} maxOffPlane=${maxOff.toFixed(1)}mm ${maxOff>1?"<-- NON-PLANAR":""} z=[${zs.join(",")}]`);
});
