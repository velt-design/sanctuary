import {it,expect} from 'vitest';
import {pergolaLightSites,layoutLights} from '@sp/geometry';
import {solvePergolaPreview} from './solvePreview';
import {INITIAL_INPUT} from './model';
import {INITIAL_ROOF} from './GableChoices';
import {DEFAULT_LIGHTING,parseLighting} from './lightingSelection';
import {parsePreviewDraft} from './previewDraft';
import {serializePreviewDesign,parsePreviewDesign} from './previewShare';
import {hasSimpleRoofPrice} from './roofFinish';
for(const family of ['mono','gable','box'] as const)for(const material of ['acrylic','solid','combination'] as const)it(family+' '+material+' lighting uses valid mounting surfaces',()=>{
 const roof={...INITIAL_ROOF,family,finish:{material,profile:'corrugated' as const,layout:'central' as const,acrylicBays:2,trayWidth:400 as const}};
 const g=solvePergolaPreview({...INITIAL_INPUT,connection:'facade',projectionMm:3000},roof).geometry!,sites=pergolaLightSites(g.assembly,g.covering);
 expect(sites.strips.length).toBeGreaterThan(0);expect(sites.cedar.length>0).toBe(material!=='acrylic');
 for(const s of sites.strips){const m=g.assembly.members.find(m=>m.id===s.id)!;expect(Math.hypot(s.end.x-s.start.x,s.end.y-s.start.y,s.end.z-s.start.z)).toBeCloseTo(Math.hypot(m.centerline.end.x-m.centerline.start.x,m.centerline.end.y-m.centerline.start.y,m.centerline.end.z-m.centerline.start.z));if(s.perimeter)expect(m.role).not.toBe('ledger');}
 for(const pool of [sites.rafters,sites.cedar])for(const layout of ['even','central','perimeter'] as const){const spots=layoutLights(pool,6,layout);expect(spots.length).toBe(Math.min(6,pool.length));expect(new Set(spots.map(s=>s.id)).size).toBe(spots.length);expect(spots.every(s=>Object.values(s.point).every(Number.isFinite))).toBe(true);}
 expect(sites.rafters.every(s=>s.diameter===40)).toBe(true);expect(sites.cedar.every(s=>s.diameter===110)).toBe(true);
});
it('preserves lighting in links, rejects invalid values and excludes it from simple pricing',()=>{
 const g=solvePergolaPreview(INITIAL_INPUT,INITIAL_ROOF).geometry!,id=pergolaLightSites(g.assembly,g.covering).strips[0].id;
 const draft=parsePreviewDraft({version:1,input:INITIAL_INPUT,roof:{...INITIAL_ROOF,lighting:{...DEFAULT_LIGHTING,rafterCount:6,strips:[id,'missing-member']}}})!;
 expect(draft.roof.lighting!.strips).toEqual([id]);expect(parsePreviewDesign(serializePreviewDesign(draft))).toEqual(draft);expect(hasSimpleRoofPrice(draft.roof)).toBe(false);
 expect(parseLighting({...DEFAULT_LIGHTING,rafterCount:25})).toBeNull();expect(parseLighting({...DEFAULT_LIGHTING,strips:['<script>']})).toBeNull();
});

it('avoids strip/spot overlap and does not double the front perimeter',()=>{
 const g=solvePergolaPreview(INITIAL_INPUT).geometry!,sites=pergolaLightSites(g.assembly,g.covering);
 expect(sites.strips.filter(s=>s.perimeter&&s.start.y>2800&&s.end.y>2800)).toHaveLength(1);
 const strips=sites.strips.filter(s=>s.rafter).map(s=>s.id);
 const draft=parsePreviewDraft({version:1,input:INITIAL_INPUT,roof:{...INITIAL_ROOF,lighting:{...DEFAULT_LIGHTING,rafterCount:6,strips}}})!;
 expect(draft.roof.lighting!.rafterCount).toBe(0);
});
