import type {LightSite,PergolaLighting} from '@sp/geometry';
export const DEFAULT_LIGHTING:PergolaLighting={rafterCount:0,cedarCount:0,rafterLayout:'even',cedarLayout:'even',strips:[]};
export function parseLighting(value:unknown):PergolaLighting|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as PergolaLighting;
 if(![v.rafterCount,v.cedarCount].every(n=>Number.isInteger(n)&&n>=0&&n<=200)||![v.rafterLayout,v.cedarLayout].every(s=>['even','central','perimeter'].includes(s))||!Array.isArray(v.strips)||v.strips.length>150||!v.strips.every(id=>typeof id==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(id)))return null;
 if(v.cedarPattern!==undefined&&!['rows2','rows3'].includes(v.cedarPattern))return null;

 if(v.rafterAmount!==undefined&&!['off','low','medium','high'].includes(v.rafterAmount))return null;
 if(v.cedarPerSection!==undefined&&![0,2,4,6,9].includes(v.cedarPerSection))return null;
 if(v.cedarIndividual!==undefined&&typeof v.cedarIndividual!=='boolean')return null;
 if(v.cedarOverrides!==undefined&&(!v.cedarOverrides||typeof v.cedarOverrides!=='object'||Array.isArray(v.cedarOverrides)||Object.keys(v.cedarOverrides).length>12||Object.entries(v.cedarOverrides).some(([key,o])=>!/^section-[1-9][0-9]?$/.test(key)||!o||![0,2,4,6,9].includes(o.count)||!['rows2','rows3'].includes(o.pattern))))return null;
 return {...(v.cedarPerSection!==undefined?{cedarPerSection:v.cedarPerSection}:{}),...(v.cedarIndividual!==undefined?{cedarIndividual:v.cedarIndividual}:{}),...(v.cedarOverrides?{cedarOverrides:v.cedarOverrides}:{}),...(v.cedarPattern?{cedarPattern:v.cedarPattern}:{}),...(v.rafterAmount?{rafterAmount:v.rafterAmount}:{}),rafterCount:v.rafterCount,cedarCount:v.cedarCount,rafterLayout:v.rafterLayout,cedarLayout:v.cedarLayout,strips:[...new Set(v.strips)]};
}
export const hasLighting=(v?:PergolaLighting)=>!!v&&(v.rafterCount>0||v.cedarCount>0||v.strips.length>0);
export const describeLighting=(v:PergolaLighting)=>'Warm-white lighting: '+v.rafterCount+' rafter spots ('+(v.rafterAmount??v.rafterLayout)+'), '+v.cedarCount+' cedar downlights ('+(v.cedarIndividual?'individual sections':String(v.cedarPerSection??v.cedarCount)+' per section per slope')+'), '+v.strips.length+' full-length LED channels';

export const availableRafterSpots=(sites:LightSite[],strips:string[])=>sites.filter(s=>!strips.includes(s.id.slice(0,s.id.lastIndexOf('-'))));
