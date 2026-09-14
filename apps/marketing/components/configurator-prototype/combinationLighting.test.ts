import {expect,it} from 'vitest';
import {pergolaLightSites,layoutRafterLights} from '@sp/geometry';
import {solvePergolaPreview} from './solvePreview';
import type {PreviewRoofChoices} from './GableChoices';
import {parsePreviewDraft} from './previewDraft';
import {DEFAULT_LIGHTING} from './lightingSelection';
import {calculateReviewPrice} from '../../lib/configuratorReviewPrice';
const input={widthMm:7300,projectionMm:4000,connection:'facade' as const,level:'ground' as const};
const roof:PreviewRoofChoices={family:'gable',orientation:'parallel',infills:false,finish:{material:'combination',layout:'central',acrylicBays:4,profile:'corrugated',trayWidth:400,ceiling:'thermopine-150'}};
it('removes lights and their charge when batten gaps shrink, without silently restoring them',()=>{
 const lit=parsePreviewDraft({version:1,input,roof:{...roof,roofBattens:{profile:'65x39',edge:false,gap:65,customGap:true},lighting:{...DEFAULT_LIGHTING,rafterAmount:'high'}}})!;
 expect(lit.roof.lighting!.rafterCount).toBe(12);
 const narrow=parsePreviewDraft({...lit,roof:{...lit.roof,roofBattens:{...lit.roof.roofBattens!,gap:39}}})!;
 expect(narrow.roof.lighting).toMatchObject({rafterAmount:'off',rafterCount:0});
 const price=calculateReviewPrice(narrow);expect(price.status).toBe('priced');
 if(price.status==='priced')expect(price.breakdown!.some(l=>l.label.startsWith('Rafter lighting'))).toBe(false);
 const widened=parsePreviewDraft({...narrow,roof:{...narrow.roof,roofBattens:{...narrow.roof.roofBattens!,gap:65}}})!;
 expect(widened.roof.lighting).toMatchObject({rafterAmount:'off',rafterCount:0});
});
for(const orientation of ['parallel','away'] as const)it(`only lights internal acrylic rafters, mirrored for ${orientation} gables`,()=>{
 const g=solvePergolaPreview(input,{...roof,orientation}).geometry!,sites=pergolaLightSites(g.assembly,g.covering);
 // Four acrylic bays have three internal rafters on each slope: 6 rafters,
 // two lights each. The two timber/acrylic boundary rafters are excluded.
 expect(layoutRafterLights(sites.rafters,'high')).toHaveLength(12);
 expect(layoutRafterLights(sites.rafters,'medium')).toHaveLength(8);
 expect(layoutRafterLights(sites.rafters,'low')).toHaveLength(4);
 for(const s of sites.rafters){
  const axis=orientation==='parallel'?'x':'y';
  const band=g.covering!.regions.find(r=>r.material==='acrylic')!;
  const coords=band.boundary.map(p=>p[axis]);
  expect(s.point[axis]).toBeGreaterThan(Math.min(...coords)+26);
  expect(s.point[axis]).toBeLessThan(Math.max(...coords)-26);
 }
});
it('keeps batten-obstructed positions unavailable instead of fitting through timber',()=>{
 const g=solvePergolaPreview(input,{...roof,roofBattens:{profile:'39x39',edge:false,gap:39,customGap:false}}).geometry!;
 const sites=pergolaLightSites(g.assembly,g.covering);
 expect(layoutRafterLights(sites.rafters,'high')).toHaveLength(0);
 const clear=pergolaLightSites(g.assembly,{...g.covering!,battenBoundaries:[]});
 expect(layoutRafterLights(clear.rafters,'high')).toHaveLength(12);
});
for(const orientation of ['parallel','away'] as const)it(`moves lights into batten gaps and mirrors ${orientation} gables`,()=>{
 const g=solvePergolaPreview(input,{...roof,orientation,roofBattens:{profile:'65x39',edge:false,gap:65,customGap:false}}).geometry!;
 const sites=pergolaLightSites(g.assembly,g.covering),lights=layoutRafterLights(sites.rafters,'high');
 expect(lights).toHaveLength(12);
 const axis=orientation==='parallel'?'y':'x',along=axis==='x'?'y':'x';
 const ridge=g.assembly.members.find(m=>m.role==='ridge')!.centerline.start[axis];
 for(const s of lights)expect(lights.some(other=>other!==s&&Math.abs(other.point[axis]-(2*ridge-s.point[axis]))<.1&&Math.abs(other.point[along]-s.point[along])<.1)).toBe(true);
});
