import {layoutCedarLights,type LightSite,type PergolaLighting} from '@sp/geometry';
export const cedarSections=(sites:LightSite[])=>[...new Set(sites.map(s=>s.cedarSection).filter((s):s is string=>!!s))].sort();
export function cedarOptions(sites:LightSite[],section:string){
 const pool=sites.filter(s=>s.cedarSection===section),slopes=pool[0]?.cedarSlopes??1;
 return [2,4,6,9].flatMap(count=>(['rows2','rows3'] as const).filter(pattern=>layoutCedarLights(pool,count,pattern).length===count*slopes).map(pattern=>({count,pattern})));
}
export function sharedCedarOptions(sites:LightSite[]){
 const sections=cedarSections(sites);
 return sections.length?cedarOptions(sites,sections[0]).filter(option=>sections.every(section=>cedarOptions(sites,section).some(o=>o.count===option.count&&o.pattern===option.pattern))):[];
}
export function selectedCedarLights(sites:LightSite[],lighting:PergolaLighting){
 return cedarSections(sites).flatMap(section=>{
  const setting=lighting.cedarIndividual?lighting.cedarOverrides?.[section]:undefined;
  return layoutCedarLights(sites.filter(s=>s.cedarSection===section),setting?.count??lighting.cedarPerSection??0,setting?.pattern??lighting.cedarPattern);
 });
}
export function normalizeCedarLighting(sites:LightSite[],lighting:PergolaLighting):PergolaLighting{
 const sections=cedarSections(sites),slopes=sites[0]?.cedarSlopes??1;
 const desired=lighting.cedarPerSection??(lighting.cedarCount/(Math.max(1,sections.length)*slopes));
 const nearest=(options:ReturnType<typeof cedarOptions>,count:number,pattern?:string)=>count?options.slice().sort((a,b)=>Math.abs(a.count-count)-Math.abs(b.count-count)||Number(b.pattern===pattern)-Number(a.pattern===pattern))[0]:undefined;
 const common=nearest(sharedCedarOptions(sites),desired,lighting.cedarPattern);
 const cedarOverrides=lighting.cedarIndividual?Object.fromEntries(sections.map(section=>{
  const old=lighting.cedarOverrides?.[section],option=nearest(cedarOptions(sites,section),old?.count??desired,old?.pattern??lighting.cedarPattern);
  return [section,option??{count:0,pattern:'rows2' as const}];
 })):undefined;
 const next={...lighting,cedarPerSection:common?.count??0,cedarPattern:common?.pattern??'rows2' as const,cedarIndividual:!!lighting.cedarIndividual,...(cedarOverrides?{cedarOverrides}:{})};
 if(!cedarOverrides)delete next.cedarOverrides;
 return {...next,cedarCount:selectedCedarLights(sites,next).length};
}
