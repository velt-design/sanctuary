import {expect,it} from 'vitest';
import {buildRectangularRoof} from '../../../../packages/geometry/src/house/roofRectangle';
import {studioAttachmentFixture} from '../../../../test/studioAttachmentFixture';
import {studioHouseScene} from '@/lib/designStudio/studioHouseScene';
import {updateStudioHouse} from '@/lib/designStudio/studioHouseCommands';
import {createStudioSceneResolver} from '@/lib/designStudio/interaction/resolvedScene';
import {studioHousePlanPresentation} from './studioHousePlanPresentation';

it.each(['hipped','mono','flat'] as const)('uses actual rotated %s roof planes and bounds illustrative density without changing source',form=>{
 let edit=studioAttachmentFixture(37),house=studioHouseScene(edit.site,edit.spatial)!.houses[0];
 edit=updateStudioHouse(edit,{...house,roof:{...house.roof,form,pitchDeg:form==='flat'?'0':'15'}});
 const geometry=createStudioSceneResolver().resolve(edit).houses[0],before=JSON.stringify(geometry);
 for(const units of [.01,1,15,100,1000,0,NaN,Infinity]){
  const plan=studioHousePlanPresentation(geometry.roof,units);
  expect(plan.faces).toHaveLength(geometry.roof.length);expect(Number.isFinite(plan.spacing)).toBe(true);
  for(const face of plan.faces){
   expect(face.span/plan.spacing).toBeLessThanOrEqual(80);
   if(form==='flat'){expect(face.angle).toBeNull();continue;}
   expect(face.angle).not.toBeNull();
   const highest=face.boundary.reduce((a,b)=>a.z>b.z?a:b),lowest=face.boundary.reduce((a,b)=>a.z<b.z?a:b);
   const angle=(face.angle!+90)*Math.PI/180;
   expect((lowest.x-highest.x)*Math.cos(angle)+(lowest.y-highest.y)*Math.sin(angle)).toBeGreaterThan(0);
  }
  expect(plan.outline).not.toMatch(/NaN|Infinity/);
 }
 expect(JSON.stringify(geometry)).toBe(before);
});

it('follows both actual open-gable roof planes after world rotation',()=>{
 const roof=buildRectangularRoof({minX:0,maxX:8000,minY:0,maxY:4000,eaveHeightMm:2400,roofPitchDeg:25,ridgeAxis:'x',startCap:'open_gable',endCap:'open_gable'});
 const angle=.7,world=roof.roofPlanes.map(face=>face.boundary.map(p=>({...p,x:5000+p.x*Math.cos(angle)-p.y*Math.sin(angle),y:-2000+p.x*Math.sin(angle)+p.y*Math.cos(angle)})));
 const plan=studioHousePlanPresentation(world,15);expect(plan.faces).toHaveLength(2);
 for(const face of plan.faces){expect(face.angle).not.toBeNull();const high=face.boundary.reduce((a,b)=>a.z>b.z?a:b),low=face.boundary.reduce((a,b)=>a.z<b.z?a:b),a=(face.angle!+90)*Math.PI/180;expect((low.x-high.x)*Math.cos(a)+(low.y-high.y)*Math.sin(a)).toBeGreaterThan(0);}
});

it('rotates slope lines with the world roof rather than camera axes and draws a shared edge once',()=>{
 const plane=[{x:0,y:0,z:3000},{x:6000,y:0,z:3000},{x:6000,y:8000,z:2000},{x:0,y:8000,z:2000}];
 const rotate=(p:typeof plane[number])=>({...p,x:5000+p.x*Math.cos(.7)-p.y*Math.sin(.7),y:-2000+p.x*Math.sin(.7)+p.y*Math.cos(.7)});
 const a=studioHousePlanPresentation([plane],15),b=studioHousePlanPresentation([plane.map(rotate)],15);
 expect(b.faces[0].angle!-a.faces[0].angle!).toBeCloseTo(.7*180/Math.PI,8);
 const triangles=[[plane[0],plane[1],plane[2]],[plane[0],plane[2],plane[3]]];
 expect(studioHousePlanPresentation(triangles,15).outline.match(/M /g)).toHaveLength(5);
});

it('keeps flat, collinear, empty and nonfinite faces finite without inventing a fall direction',()=>{
 const flat=[{x:0,y:0,z:5},{x:10,y:0,z:5},{x:10,y:10,z:5}],line=[{x:0,y:0,z:0},{x:1,y:1,z:1},{x:2,y:2,z:2}];
 const plan=studioHousePlanPresentation([flat,line,[],[{x:NaN,y:0,z:0},...flat]],0);
 expect(plan.faces).toHaveLength(2);expect(plan.faces.every(face=>face.angle===null)).toBe(true);
 expect(plan.spacing).toBe(18);expect(plan.outline).not.toMatch(/NaN|Infinity/);
});
