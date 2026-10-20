import type {RepresentativeRoofBattens} from '@sp/geometry';
import {TIMBER_PROFILES,defaultSideGap} from './sidePanelCatalog';
export const DEFAULT_ROOF_BATTENS:RepresentativeRoofBattens={species:'thermopine',profile:'90x39',edge:false,gap:90,customGap:false};
export function parseRoofBattens(value:unknown):RepresentativeRoofBattens|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const p=value as Record<string,unknown>;
  if(!TIMBER_PROFILES.includes(p.profile as RepresentativeRoofBattens['profile'])||typeof p.edge!=='boolean'||typeof p.customGap!=='boolean'||!Number.isInteger(p.gap)||Number(p.gap)<5||Number(p.gap)>200)return null;
  if(p.species!==undefined&&p.species!=='cedar'&&p.species!=='thermopine')return null;
  const profile=p.profile as RepresentativeRoofBattens['profile'],edge=profile==='39x39'?false:p.edge;
  return {...(p.species?{species:p.species as 'cedar'|'thermopine'}:{}),profile,edge,customGap:p.customGap,gap:p.customGap?Number(p.gap):defaultSideGap(profile,edge)};
}
export const describeRoofBattens=(p:RepresentativeRoofBattens)=>'Under-rafter timber battens: '+p.profile.replace('x',' × ')+' mm '+(p.species==='thermopine'?'ThermoPine':'cedar')+', '+(p.edge?'on edge':'flat')+', '+p.gap+' mm clear gap, acrylic roof sections only';
