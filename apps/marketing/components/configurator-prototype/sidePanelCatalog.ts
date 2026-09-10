export const TIMBER_PROFILES=['39x39','65x39','90x39'] as const;
export const ALUMINIUM_PROFILES=['50x10','65x16'] as const;
export type SidePanel={opening:string;kind:'acrylic'|'timber'|'aluminium';profile:string;edge:boolean;gap:number;customGap:boolean;frame:50|100;battens:boolean;direction?:'horizontal'|'vertical'};
export const faceWidth=(profile:string,edge:boolean)=>Number(profile.split('x')[edge?1:0]);
export const defaultSideGap=(profile:string,edge:boolean)=>edge&&profile==='65x16'?100:edge&&profile==='65x39'?80:faceWidth(profile,edge);
export const defaultSidePanel=(opening:string,kind:SidePanel['kind']):SidePanel=>({opening,kind,profile:kind==='aluminium'?'50x10':'39x39',edge:false,gap:kind==='aluminium'?50:39,customGap:false,frame:50,battens:false});
export function parseSidePanels(value:unknown):SidePanel[]|null {
  if(!Array.isArray(value)||value.length>16)return null;
  const seen=new Set<string>(),result:SidePanel[]=[];
  for(const p of value){
    if(!p||typeof p!=='object'||!['acrylic','timber','aluminium'].includes(p.kind)||typeof p.opening!=='string'||!/^(front|left|right)-[1-9]of[1-9]$/.test(p.opening)||seen.has(p.opening))return null;
    const profiles:readonly string[]=p.kind==='aluminium'?ALUMINIUM_PROFILES:TIMBER_PROFILES;
    if(p.direction!==undefined&&!['horizontal','vertical'].includes(p.direction))return null;
    if(p.kind==='acrylic'&&p.direction==='vertical')return null;
    if(!profiles.includes(p.profile)||typeof p.edge!=='boolean'||(p.profile==='50x10'&&p.edge)||typeof p.battens!=='boolean'||(p.kind!=='acrylic'&&p.battens)||![50,100].includes(p.frame)||typeof p.customGap!=='boolean'||!Number.isInteger(p.gap)||p.gap<5||p.gap>200)return null;
    seen.add(p.opening);result.push({opening:p.opening,kind:p.kind,profile:p.profile,edge:p.edge,gap:p.customGap?p.gap:defaultSideGap(p.profile,p.edge),customGap:p.customGap,frame:p.frame,battens:p.battens,...(p.direction?{direction:p.direction}:{})});
  }return result;
}
export function describeSidePanels(panels:SidePanel[]=[]){return panels.map(p=>{
  const [side,bay]=p.opening.split('-'),label=side[0].toUpperCase()+side.slice(1)+' '+bay.split('of')[0];
  const slats=`${p.profile.replace('x',' × ')} mm ${p.edge?'on edge':'flat'}, ${p.gap} mm clear gap`;
  return `${label}: ${p.kind==='acrylic'?`full-height acrylic, ${p.frame} × 50 mm framing${p.battens?', horizontal timber battens '+slats:''}`:`${p.direction??'horizontal'} ${p.kind} slats, ${slats}, matching perimeter angle`}`;
}).join('; ');}
