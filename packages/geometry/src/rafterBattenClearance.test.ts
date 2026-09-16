import {expect,it} from 'vitest';
import {clearRafterLightPoint} from './rafterBattenClearance';
const a={x:0,y:0,z:0},b={x:0,y:1000,z:0},n={x:0,y:0,z:1};
const batten=(lo:number,hi:number)=>[{x:-100,y:lo,z:0},{x:100,y:lo,z:0},{x:100,y:hi,z:0},{x:-100,y:hi,z:0}];
it('preserves clear ideal positions and moves obstructed fittings with full radius clearance',()=>{
 expect(clearRafterLightPoint(a,b,n,[],.25)).toEqual({x:0,y:250,z:0});
 const p=clearRafterLightPoint(a,b,n,[batten(230,270)],.25)!;
 expect(p.y).toBeCloseTo(209.9);expect(230-p.y).toBeGreaterThan(20);
});
it('does not place a 40 mm fitting in a 39 mm gap',()=>{
 expect(clearRafterLightPoint(a,b,n,[batten(0,480),batten(519,1000)],.5)).toBeNull();
});
