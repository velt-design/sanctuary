'use client';
import type { PreviewGeometryOptions } from '../../geometry';
import {createContext,useContext,useMemo,useState,type ReactNode} from 'react';
import {pergolaLightSites,type PergolaLighting} from '@sp/geometry';
import {solvePergolaPreview} from '../../geometry';
import {availableRafterSpots,DEFAULT_LIGHTING} from '../../website';
import type {PreviewRoofChoices} from '../../geometry';
import type {SimpleCoverInput} from '../../geometry';
type Workspace={roof:PreviewRoofChoices;tool:null|'rafter'|'cedar'|'strip';setTool:(t:null|'rafter'|'cedar'|'strip')=>void;editing:boolean;view:'Plan'|'3D';setView:(v:'Plan'|'3D')=>void;night:boolean;setNight:(n:boolean)=>void;open:()=>void;close:()=>void;value:PergolaLighting;change:(v:PergolaLighting)=>void;toggle:(id:string)=>void;sites:ReturnType<typeof pergolaLightSites> & {allRafters:ReturnType<typeof pergolaLightSites>['rafters']};rafterUnavailableReason:string};
const Context=createContext<Workspace|null>(null);
export const useLighting=()=>useContext(Context);
export default function LightingProvider({input,roof,geometryOptions,onChange,children}:{input:SimpleCoverInput;roof:PreviewRoofChoices;geometryOptions?:PreviewGeometryOptions;onChange:(r:PreviewRoofChoices)=>void;children:ReactNode}){
 const [tool,setTool]=useState<null|'rafter'|'cedar'|'strip'>(null);
 const [editing,setEditing]=useState(false),[night,setNight]=useState(false),[view,setView]=useState<'Plan'|'3D'>('3D');
 const sites=useMemo(()=>{const g=solvePergolaPreview(input,roof,geometryOptions).geometry;if(!g)return {strips:[],rafters:[],cedar:[],allRafters:[]};const sites=pergolaLightSites(g.assembly,g.covering);return {...sites,allRafters:sites.rafters,rafters:availableRafterSpots(sites.rafters,roof.lighting?.strips??[])};},[input,roof,geometryOptions]);
 const rafterUnavailableReason=roof.roofBattens
  ? 'No batten gaps are wide enough for the 40 mm rafter lights. Increase the clear gap to at least 41 mm in Roof & ceiling.'
  : roof.lighting?.strips.length
  ? 'No clear rafter-light positions remain. Remove LED strips from rafters to make those members available for spotlights.'
  : 'No exposed internal rafters are available for this roof. Choose ceiling downlights for the lined areas, or change the acrylic coverage in Roof & ceiling.';
 const value=roof.lighting??DEFAULT_LIGHTING,change=(v:PergolaLighting)=>onChange({...roof,lighting:v});
 return <Context.Provider value={{roof,tool,setTool,editing,view,setView:v=>{setView(v);if(editing&&v==='3D')setNight(true);},night:view==='3D'&&night,setNight,open:()=>{setTool(null);setEditing(true);},close:()=>{setEditing(false);setNight(false);},value,change,sites,rafterUnavailableReason,toggle:id=>change({...value,strips:value.strips.includes(id)?value.strips.filter(s=>s!==id):[...value.strips,id]})}}>{children}</Context.Provider>;
}
