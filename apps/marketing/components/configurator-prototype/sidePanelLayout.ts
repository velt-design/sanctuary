import { calculateInfillsTakeoffV1 } from '@sp/costing';
import type { BlindOpening } from '@sp/geometry';
import type { SidePanel } from './sidePanelCatalog';

/** Reuse the portal's canonical infill subdivision, without exposing a price. */
export function sidePanelSupports(opening:BlindOpening,panel:SidePanel):number[] {
  if(panel.kind!=='acrylic'){
    const bays=Math.ceil(opening.width/(panel.kind==='timber'?1200:600));
    return Array.from({length:bays+1},(_,i)=>opening.width*i/bays);
  }
  const height=opening.headerDepth?Math.max(...opening.roofLine.map(p=>p.z)):opening.top;
  for(const source of ['sheet_panels','strip_620'] as const){
    const result=calculateInfillsTakeoffV1([{id:'preview-side',qty:1,location:'side',acrylic_source:source,panel_orientation:'vertical',width_mode:'target_width',
      support:{has_top:true,has_bottom:true,has_left:true,has_right:true,internal_support_mode:'none'},
      shape:{type:'rect',width_m:opening.width/1000,height_m:height/1000}}]);
    const item=result.items[0];
    if(result.status==='blocked'||!item?.panels.length)continue;
    return [...new Set(item.panels.flatMap(p=>p.points.map(v=>Math.round(v.x_m*1000000)/1000)))].sort((a,b)=>a-b);
  }
  return [];
}
