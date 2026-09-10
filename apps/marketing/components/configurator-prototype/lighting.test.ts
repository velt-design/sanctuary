import {it,expect} from 'vitest';
import {pergolaLightSites,layoutCedarLights,layoutRafterLights,layoutLights} from '@sp/geometry';
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
 expect(parseLighting({...DEFAULT_LIGHTING,rafterCount:201})).toBeNull();expect(parseLighting({...DEFAULT_LIGHTING,strips:['<script>']})).toBeNull();
});

it('avoids strip/spot overlap and does not double the front perimeter',()=>{
 const g=solvePergolaPreview(INITIAL_INPUT).geometry!,sites=pergolaLightSites(g.assembly,g.covering);
 expect(sites.strips.filter(s=>s.perimeter&&s.start.y>2800&&s.end.y>2800)).toHaveLength(1);
 const strips=sites.strips.filter(s=>s.rafter).map(s=>s.id);
 const draft=parsePreviewDraft({version:1,input:INITIAL_INPUT,roof:{...INITIAL_ROOF,lighting:{...DEFAULT_LIGHTING,rafterCount:6,strips}}})!;
 expect(draft.roof.lighting!.rafterCount).toBe(0);
});

it('uses fixed centred and quarter-point rafter positions and a balanced alternate pattern',()=>{
 const g=solvePergolaPreview(INITIAL_INPUT).geometry!,sites=pergolaLightSites(g.assembly,g.covering);
 const low=layoutRafterLights(sites.rafters,'low'),medium=layoutRafterLights(sites.rafters,'medium'),high=layoutRafterLights(sites.rafters,'high');
 expect(low.length).toBeGreaterThan(0);expect(medium.length).toBe(low.length*2);expect(high.length).toBeGreaterThan(medium.length);
 for(const [lights,fractions] of [[low,[.5]],[high,[.25,.75]]] as const)for(const site of lights){
  const id=site.id.slice(0,site.id.lastIndexOf('-')),member=g.assembly.members.find(m=>m.id===id)!;
  const a=member.centerline.start,b=member.centerline.end;
  const t=Math.abs(b.y-a.y)>1?(site.point.y-a.y)/(b.y-a.y):(site.point.x-a.x)/(b.x-a.x);
  // Mounting offset follows the roof normal; use suffix to check the exact member parameter.
  expect(fractions).toContain(Number(site.id.split('-').at(-1))/100);expect(t).toBeGreaterThan(.2);expect(t).toBeLessThan(.8);
 }
 const ids=[...new Set(sites.rafters.map(s=>s.id.slice(0,s.id.lastIndexOf('-'))))];
 const selected=new Set(low.map(s=>s.id.slice(0,s.id.lastIndexOf('-'))));
 ids.forEach((id,i)=>expect(selected.has(id)).toBe(selected.has(ids[ids.length-1-i])));
 expect(layoutRafterLights(sites.rafters,'off')).toEqual([]);
});
it('retains amount through sharing and recalculates totals after resizing',()=>{
 const make=(widthMm:number)=>parsePreviewDraft({version:1,input:{...INITIAL_INPUT,widthMm},roof:{...INITIAL_ROOF,lighting:{...DEFAULT_LIGHTING,rafterAmount:'high'}}})!;
 const a=make(3000),b=make(8000);expect(b.roof.lighting!.rafterCount).toBeGreaterThan(a.roof.lighting!.rafterCount);
 expect(parsePreviewDesign(serializePreviewDesign(b))).toEqual(b);
 expect(parseLighting({...DEFAULT_LIGHTING,rafterAmount:'invalid'})).toBeNull();
});

for(const orientation of ['parallel','away'] as const)for(const widthMm of [4200,4800,6000])it(`mirrors gable spot patterns across the ridge: ${orientation} ${widthMm}`,()=>{
 const g=solvePergolaPreview({...INITIAL_INPUT,widthMm},{...INITIAL_ROOF,family:'gable',orientation}).geometry!;
 const sites=pergolaLightSites(g.assembly,g.covering);
 const along=orientation==='parallel'?'x':'y';const members=g.assembly.members.filter(m=>m.role==='rafter');const coords=members.map(m=>m.centerline.start[along]);
 for(const m of members.filter(m=>m.centerline.start[along]===Math.min(...coords)||m.centerline.start[along]===Math.max(...coords)))expect(sites.rafters.some(s=>s.id.startsWith(m.id+'-'))).toBe(false);
 for(const amount of ['low','medium','high'] as const){
  const lights=layoutRafterLights(sites.rafters,amount);expect(lights.length).toBeGreaterThan(0);
  const rows=new Map<number,number>();for(const s of lights)rows.set(s.rafterRow!,(rows.get(s.rafterRow!)??0)+1);
  expect([...rows.values()].every(n=>n===(amount==='low'?2:4))).toBe(true);
  const reflectedAxis=orientation==='parallel'?'y':'x';
  const ridge=g.assembly.members.find(m=>m.role==='ridge')!.centerline.start[reflectedAxis];
  for(const light of lights)expect(lights.some(other=>other!==light&&Math.abs(other.point[reflectedAxis]-(2*ridge-light.point[reflectedAxis]))<1&&Math.abs(other.point[reflectedAxis==='x'?'y':'x']-light.point[reflectedAxis==='x'?'y':'x'])<1)).toBe(true);
 }
});
it('excludes pitched edge rafters from spots but keeps them selectable for LED strips',()=>{
 const g=solvePergolaPreview(INITIAL_INPUT).geometry!,sites=pergolaLightSites(g.assembly,g.covering);
 const rafters=g.assembly.members.filter(m=>m.role==='rafter');const xs=rafters.map(m=>m.centerline.start.x);
 const edges=rafters.filter(m=>m.centerline.start.x===Math.min(...xs)||m.centerline.start.x===Math.max(...xs));
 expect(edges).toHaveLength(2);
 for(const edge of edges){expect(sites.rafters.some(s=>s.id.startsWith(edge.id+'-'))).toBe(false);expect(sites.strips.some(s=>s.id===edge.id)).toBe(true);}
});

for(const orientation of ['parallel','away'] as const)it('cedar gable grids mirror across the ridge: '+orientation,()=>{
 const g=solvePergolaPreview({...INITIAL_INPUT,widthMm:6000,projectionMm:4000},{...INITIAL_ROOF,family:'gable',orientation,finish:{material:'solid',profile:'corrugated',layout:'central',acrylicBays:2,trayWidth:400}}).geometry!;
 const sites=pergolaLightSites(g.assembly,g.covering);const axis=orientation==='parallel'?'y':'x',along=axis==='x'?'y':'x';const ridge=g.assembly.members.find(m=>m.role==='ridge')!.centerline.start[axis];
 for(const count of [2,4,6]){
  const lights=layoutCedarLights(sites.cedar,count);expect(lights).toHaveLength(count);
  for(const light of lights)expect(lights.some(other=>other!==light&&Math.abs(other.point[axis]-(2*ridge-light.point[axis]))<1&&Math.abs(other.point[along]-light.point[along])<1)).toBe(true);
 }
 expect(layoutCedarLights(sites.cedar,9,'rows3')).toEqual([]);
});
it('cedar dice grids use actual bay centres and regular rows',()=>{
 const g=solvePergolaPreview({...INITIAL_INPUT,widthMm:8000,projectionMm:4000},{...INITIAL_ROOF,finish:{material:'solid',profile:'corrugated',layout:'central',acrylicBays:2,trayWidth:400}}).geometry!;
 const sites=pergolaLightSites(g.assembly,g.covering),stations=[...new Set(g.assembly.members.filter(m=>m.role==='rafter').map(m=>Math.round(m.centerline.start.x)))].sort((a,b)=>a-b),centres=stations.slice(1).map((s,i)=>(s+stations[i])/2);
 for(const [count,pattern,columns,rows] of [[2,'rows2',2,1],[4,'rows2',2,2],[6,'rows2',2,3],[6,'rows3',3,2],[9,'rows3',3,3]] as const){
  const lights=layoutCedarLights(sites.cedar,count,pattern);expect(lights).toHaveLength(count);
  const xs=[...new Set(lights.map(s=>s.point.x))],ys=[...new Set(lights.map(s=>s.point.y))].sort((a,b)=>a-b);
  expect(xs).toHaveLength(columns);expect(ys).toHaveLength(rows);
  expect(xs.every(x=>centres.some(c=>Math.abs(x-c)<1))).toBe(true);
  if(rows===3)expect(ys[1]-ys[0]).toBeCloseTo(ys[2]-ys[1],3);
 }
});
it('cedar grids avoid acrylic and preserve selection through share links',()=>{
 const roof={...INITIAL_ROOF,finish:{material:'combination' as const,profile:'corrugated' as const,layout:'central' as const,acrylicBays:2,trayWidth:400 as const}};
 const g=solvePergolaPreview(INITIAL_INPUT,roof).geometry!,sites=pergolaLightSites(g.assembly,g.covering);
 for(const site of sites.cedar)for(const region of g.covering!.regions.filter(r=>r.material==='acrylic')){
  const xs=region.boundary.map(p=>p.x);expect(site.point.x<Math.min(...xs)||site.point.x>Math.max(...xs)).toBe(true);
 }
 const draft=parsePreviewDraft({version:1,input:INITIAL_INPUT,roof:{...roof,lighting:{...DEFAULT_LIGHTING,cedarCount:4,cedarPattern:'rows2'}}})!;
 expect(draft.roof.lighting!.cedarCount).toBe(4);expect(parsePreviewDesign(serializePreviewDesign(draft))).toEqual(draft);
 expect(parseLighting({...DEFAULT_LIGHTING,cedarPattern:'random'})).toBeNull();
});
