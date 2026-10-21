import {describe,expect,it} from 'vitest';
import {pergolaLightSites} from '@sp/geometry';
import {solvePergolaPreview} from '../../geometry/website/solvePreview';
import {DEFAULT_LIGHTING,effectiveLightingLayout,describeLighting} from './lightingSelection';
describe('effective lighting quantities',()=>{
 it('keeps Low intent while exact dimension changes update rendered, review and charged quantity',()=>{
  const retained={...DEFAULT_LIGHTING,rafterAmount:'low' as const,rafterCount:5};
  for(const [width,count] of [[6000,5],[4825,4]]){
   const g=solvePergolaPreview({widthMm:width,projectionMm:3125,connection:'facade',level:'ground'},{family:'mono',orientation:'parallel',infills:false,lighting:retained}).geometry!;
   const effective=effectiveLightingLayout(pergolaLightSites(g.assembly,g.covering),retained);
   expect(effective.rafters).toHaveLength(count);expect(effective.selection.rafterCount).toBe(count);
   expect(describeLighting(effective.selection)).toContain(`${count} rafter spots (low)`);
  }
  expect(retained.rafterCount).toBe(5);expect(retained.rafterAmount).toBe('low');
 });
 it('keeps unavailable raw channel selections while describing only placed channels',()=>{
  const retained={...DEFAULT_LIGHTING,strips:['unavailable-channel']};
  expect(effectiveLightingLayout({rafters:[],cedar:[],strips:[]},retained).selection.strips).toEqual([]);
  expect(retained.strips).toEqual(['unavailable-channel']);
 });
});
