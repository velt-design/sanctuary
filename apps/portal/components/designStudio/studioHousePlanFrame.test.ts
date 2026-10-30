import {expect,it} from 'vitest';
import {initialStudioPlanCamera,studioPlanViewBox} from './studioHousePlanFrame';
it.each([{width:448,height:600},{width:700,height:317},{width:960,height:600}])('fits the actual translated arrangement into $width x $height with readable pixel clearance',viewport=>{
 const points=[{x:10000,y:1000},{x:30000,y:9000}],camera=initialStudioPlanCamera(points,viewport),frame=studioPlanViewBox(camera,viewport).split(' ').map(Number);
 for(const point of points){const x=(point.x-frame[0])/camera.units,y=(-point.y-frame[1])/camera.units;expect(x).toBeGreaterThanOrEqual(24);expect(x).toBeLessThanOrEqual(viewport.width-24);expect(y).toBeGreaterThanOrEqual(24);expect(y).toBeLessThanOrEqual(viewport.height-24);}
 expect(20000/camera.units/viewport.width).toBeGreaterThan(.7);
 expect(camera.x).toBe(20000);expect(camera.y).toBe(-5000);
});

it('contains and reverses a persisted manual Plan frame on layout resize without changing its camera',()=>{
 const points=[{x:10000,y:1000},{x:30000,y:9000}],full={width:960,height:600},split={width:448,height:600},camera=initialStudioPlanCamera(points,full),raw=JSON.stringify(camera),original=studioPlanViewBox(camera,full);
 const frame=studioPlanViewBox(camera,split).split(' ').map(Number);
 expect(frame[0]).toBeLessThan(10000);expect(frame[0]+frame[2]).toBeGreaterThan(30000);expect(frame[1]).toBeLessThan(-9000);expect(frame[1]+frame[3]).toBeGreaterThan(-1000);
 expect(studioPlanViewBox(JSON.parse(raw),full)).toBe(original);expect(JSON.stringify(camera)).toBe(raw);
});
