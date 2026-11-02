import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { computeSceneBoundsFromPoints } from '@sp/geometry-viewer';
import { isLegacyStudioOverview, perspectiveFitDistance } from './perspectiveFit';

it('recognizes only the exact old automatic overview, preserving unknown manual orbit, pan, zoom and Fit intent records',()=>{
  const points=[{x:-3000,y:-9000,z:0},{x:9000,y:3000,z:4000}],bounds=computeSceneBoundsFromPoints(points),direction={x:1,y:2,z:.65},size={width:900,height:600};
  const camera=new PerspectiveCamera(24,1.5),centre=new Vector3(bounds.center.x,bounds.center.y,bounds.center.z),normal=new Vector3(1,2,.65).normalize();
  camera.up.set(0,0,1);camera.position.copy(centre).addScaledVector(normal,bounds.size*3);camera.lookAt(centre);camera.updateMatrixWorld();
  const distance=perspectiveFitDistance(camera,points,bounds.size*3,.97,(560/600)*.9,.76);
  camera.position.copy(centre).addScaledVector(normal,distance);
  const saved={position:camera.position.toArray(),target:centre.toArray(),fov:24,zoom:1,viewport:{aspect:1.5,zoom:1}},opening={policy:'test',overviewBounds:bounds,overviewPoints:points};
  const old=(value:typeof saved)=>isLegacyStudioOverview(value,opening,direction,size,.76,true);
  expect(old(saved)).toBe(true);
  expect(old({...saved,position:saved.position.map(v=>v+100)})).toBe(false);
  expect(old({...saved,target:saved.target.map(v=>v+100)})).toBe(false);
  expect(old({...saved,zoom:1.2})).toBe(false);
  expect(old({...saved,viewport:{aspect:1,zoom:1}})).toBe(false);
  expect(old({...saved,position:centre.clone().addScaledVector(normal,distance*.8).toArray()})).toBe(false);
});
