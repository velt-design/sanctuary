import {it,expect} from 'vitest';
import {studioCompositionOverview} from './studioCompositionOverview';
it('keeps the house behind the product-facing overview and follows world rotation, not translation',()=>{
 const products=[{x:-4000,y:-3000},{x:-8000,y:-3000}],house=[{x:-6000,y:0},{x:-6000,y:5000}];
 const direction=studioCompositionOverview(products,house)!;expect(direction.y).toBeLessThan(-.9);expect(direction.z).toBeGreaterThan(0);
 const translate=(p:{x:number;y:number})=>({x:p.x+21000,y:p.y-43000});
 expect(studioCompositionOverview(products.map(translate),house.map(translate))).toEqual(direction);
 const rotate=(p:{x:number;y:number})=>({x:-p.y,y:p.x});const rotated=studioCompositionOverview(products.map(rotate),house.map(rotate))!;
 expect(rotated.x).toBeCloseTo(-direction.y);expect(rotated.y).toBeCloseTo(direction.x);expect(rotated.z).toBe(direction.z);
});
it('leaves the existing camera default available without a meaningful house/product direction',()=>{
 expect(studioCompositionOverview([],[])).toBeUndefined();expect(studioCompositionOverview([{x:0,y:0}],[{x:0,y:0}])).toBeUndefined();
});
