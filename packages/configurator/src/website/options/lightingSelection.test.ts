import {describe,expect,it} from 'vitest';
import {pergolaLightSites} from '@sp/geometry';
import {solvePergolaPreview} from '../../geometry/website/solvePreview';
import {DEFAULT_LIGHTING,effectiveLightingLayout,describeLighting,hasLighting} from './lightingSelection';
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


it('recognizes retained ceiling intent without treating disabled individual choices as selected',()=>{
 expect(hasLighting()).toBe(false);expect(hasLighting(DEFAULT_LIGHTING)).toBe(false);
 expect(hasLighting({...DEFAULT_LIGHTING,rafterCount:1})).toBe(true);expect(hasLighting({...DEFAULT_LIGHTING,cedarCount:1})).toBe(true);expect(hasLighting({...DEFAULT_LIGHTING,strips:['retained']})).toBe(true);
 expect(hasLighting({...DEFAULT_LIGHTING,cedarPerSection:4})).toBe(true);
 const individual={...DEFAULT_LIGHTING,cedarPerSection:0 as const,cedarOverrides:{'section-1':{count:4 as const,pattern:'rows2' as const}}};
 expect(hasLighting({...individual,cedarIndividual:false})).toBe(false);expect(hasLighting({...individual,cedarIndividual:true})).toBe(true);
 expect(hasLighting({...individual,cedarIndividual:true,cedarOverrides:{'section-1':{count:0,pattern:'rows2'}}})).toBe(false);
 const stale={...individual,cedarIndividual:true,cedarOverrides:{'section-12':{count:4 as const,pattern:'rows2' as const}}},before=structuredClone(stale);
 expect(hasLighting(stale)).toBe(true);expect(effectiveLightingLayout({rafters:[],cedar:[],strips:[]},stale).selection.cedarCount).toBe(0);expect(stale).toEqual(before);
});

it('describes zero-total retained ceiling choices as intent and preserves exact placed-total wording',()=>{
 const perSection={...DEFAULT_LIGHTING,cedarPerSection:4 as const};
 expect(describeLighting(perSection)).toContain('4 ceiling downlights per section per slope');expect(describeLighting(perSection)).not.toContain('0 ceiling downlights');
 const individual={...DEFAULT_LIGHTING,cedarIndividual:true,cedarOverrides:{'section-1':{count:2 as const,pattern:'rows2' as const}}};
 expect(describeLighting(individual)).toContain('ceiling downlights in selected individual sections');expect(describeLighting(individual)).not.toContain('2 ceiling downlights');
 const combined={...perSection,...individual,cedarPerSection:4 as const};expect(describeLighting(combined)).toContain('4 ceiling downlights per section per slope; ceiling downlights in selected individual sections');
 expect(describeLighting({...individual,cedarIndividual:false})).toContain('0 ceiling downlights (0 per section per slope)');
 expect(describeLighting({...perSection,cedarCount:8})).toContain('8 ceiling downlights (4 per section per slope)');
 expect(describeLighting({...individual,cedarCount:2})).toContain('2 ceiling downlights (individual sections)');
});

it('distinguishes retained raw intent from canonical effective zero for real fitted sections',()=>{
 const intent={...DEFAULT_LIGHTING,cedarPerSection:4 as const,cedarPattern:'rows2' as const},roof={family:'mono' as const,orientation:'parallel' as const,infills:false,finish:{material:'solid' as const,profile:'corrugated' as const,trayWidth:400 as const,ceiling:'cedar-100' as const,layout:'central' as const,acrylicBays:2},lighting:intent};
 const g=solvePergolaPreview({widthMm:5600,projectionMm:3000,connection:'facade',level:'ground'},roof).geometry!,sites=pergolaLightSites(g.assembly,g.covering);
 expect(effectiveLightingLayout(sites,intent).cedar).toHaveLength(4);
 const zeroed={...intent,cedarIndividual:true,cedarOverrides:Object.fromEntries([...new Set(sites.cedar.map(site=>site.cedarSection).filter((section):section is string=>!!section))].map(section=>[section,{count:0 as const,pattern:'rows2' as const}]))};
 const selection=effectiveLightingLayout(sites,zeroed).selection,before=structuredClone(selection);expect(selection.cedarCount).toBe(0);
 expect(describeLighting(selection,'resolved')).toContain('0 ceiling downlights');expect(describeLighting(selection,'resolved')).not.toContain('4 ceiling downlights per section');
 expect(describeLighting(selection)).toContain('4 ceiling downlights per section per slope');expect(selection).toEqual(before);
});
