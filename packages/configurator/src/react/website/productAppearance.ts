import type {CustomerAcrylicTintV1} from '../../core';
/** Display colours only. Supplier colour matching remains a physical sample decision. */
export function acrylicAppearance(tint:CustomerAcrylicTintV1|undefined,{enhanced=false,studio=false}:{enhanced?:boolean;studio?:boolean}={}) {
 const clear={color:enhanced?'#e5edf0':studio?'#b6cbd1':'#83aaa6',opacity:enhanced?.09:studio?.2:.38,roughness:enhanced?.035:studio?.09:.16};
 return tint==='opal'?{color:'#f1f0e7',opacity:.82,roughness:.38}:tint==='dark_grey'?{color:'#69747a',opacity:.62,roughness:.13}:tint==='light_grey'?{color:'#9caaae',opacity:.38,roughness:.1}:clear;
}
export const frameAppearance=(finish:'black'|'white'|undefined)=>finish==='white'?'#e8e7df':null;
