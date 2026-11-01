import { expect, it } from 'vitest';
import { solvePergolaPreview, roofFinishDescription, constrainRoofFinish, type PreviewRoofChoices } from '@sp/configurator/geometry';
import { studioRoofPanelOptions, representativeBlindOpenings } from '@sp/geometry';
import { parseWebsiteSubmittedDesign } from '@sp/configurator/website/contract';
import { serializeWebsiteSubmittedDesign } from '@sp/configurator/website';
import { buildReviewSiteInputs } from '@sp/configurator/server';

const input = { widthMm: 6000, projectionMm: 3000, level: 'ground' as const, connection: 'facade' as const };
const finish = { material: 'combination' as const, layout: 'central' as const, acrylicBays: 2, profile: 'corrugated' as const, trayWidth: 400 as const, ceiling: 'thermopine-150' as const };
it.each([['mono','parallel'],['gable','parallel'],['gable','away'],['box','parallel']] as const)('builds the exact TOTAL across actual %s/%s roof planes and projects identical commercial counts', (family, orientation) => {
 const roof:PreviewRoofChoices={family,orientation,infills:false,attachmentIntent:'freestanding',finish};
 const legacy=solvePergolaPreview(input,roof).geometry!;expect(legacy).toBeTruthy();
 const options=studioRoofPanelOptions(legacy.assembly.roofPlanes);
 for(const side of options.sides)for(const count of [1,2,options.limits[side]]) {
  const selected={...roof,finish:{...finish,studioPanels:{version:1 as const,count,side}}};
  const result=solvePergolaPreview(input,selected);expect(result.geometry,result.messages.map(m=>m.message).join(',')).toBeTruthy();
  const panels=result.geometry!.assembly.roofCladdingPanels.filter(p=>p.id.startsWith('finish-acrylic-'));
  expect(panels).toHaveLength(count);expect(result.geometry!.covering!.acrylicBays).toBe(count);
  const commercial=buildReviewSiteInputs({version:1,input,roof:selected});
  expect(Object.values(commercial.pergolas[0].modules[0].mixed_roof!.acrylic_bays_by_plane!).reduce((a,b)=>a+b,0)).toBe(count);
  const wire={version:1 as const,input,roof:selected};const parsed=parseWebsiteSubmittedDesign(wire);expect(parsed.ok).toBe(true);
  expect(JSON.parse(decodeURIComponent(serializeWebsiteSubmittedDesign(wire).slice(2)))).toEqual(wire);
  expect(roofFinishDescription(selected)).toContain(`${count} acrylic panel`);
  expect(constrainRoofFinish(selected,input).finish!.studioPanels).toEqual(selected.finish.studioPanels);
 }
 expect(solvePergolaPreview(input,roof).geometry).toEqual(legacy);
});
it('keeps local side meaning and refuses unavailable full-length placement or count without substituting an old band',()=>{
 const roof:PreviewRoofChoices={family:'mono',orientation:'parallel',infills:false,finish};
 const selected=(side:'left'|'right'|'front',count=2)=>({...roof,finish:{...finish,studioPanels:{version:1 as const,count,side}}});
 const left=solvePergolaPreview(input,selected('left')).geometry!,right=solvePergolaPreview(input,selected('right')).geometry!;
 const centre=(g:typeof left)=>{const points=g.assembly.roofCladdingPanels.flatMap(p=>p.boundary);return points.reduce((sum,p)=>sum+p.x,0)/points.length;};
 expect(centre(left)).toBeLessThan(centre(right));
 expect(solvePergolaPreview(input,selected('front')).geometry).toBeUndefined();
 expect(solvePergolaPreview(input,selected('left',32)).geometry).toBeUndefined();
 const old=roofFinishDescription(roof);expect(old).toContain('equal thirds');
 for(const bad of [{version:2,count:2,side:'left'},{version:1,count:2.5,side:'left'},{version:1,count:2,side:'north'},{version:1,count:2,side:'left',extra:true}])
  expect(parseWebsiteSubmittedDesign({version:1,input,roof:{...roof,finish:{...finish,studioPanels:bad}}}).ok).toBe(false);
});
it('matches the established product Front opening at +Y and keeps all Front panels on that gable face',()=>{
 const roof:PreviewRoofChoices={family:'gable',orientation:'parallel',infills:false,attachmentIntent:'freestanding',finish};
 const result=(side:'front'|'back')=>solvePergolaPreview(input,{...roof,finish:{...finish,studioPanels:{version:1,count:2,side}}}).geometry!;
 const front=result('front'),back=result('back'),openings=representativeBlindOpenings(front.assembly,{rearOpenings:true});
 const frontOpening=openings.find(o=>o.side==='front'||o.id.startsWith('front'))!;
 expect(frontOpening).toBeTruthy();
 expect(frontOpening.start.y).toBeGreaterThan(input.projectionMm/2);
 const panels=(g:typeof front)=>g.assembly.roofCladdingPanels.filter(p=>p.id.startsWith('finish-acrylic-')).flatMap(p=>p.boundary);
 expect(Math.min(...panels(front).map(p=>p.y))).toBeGreaterThanOrEqual(input.projectionMm/2-1e-6);
 expect(Math.max(...panels(back).map(p=>p.y))).toBeLessThanOrEqual(input.projectionMm/2+1e-6);
});
