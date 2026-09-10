'use client';
import {createContext,useContext,useMemo,useState,type ReactNode} from 'react';
import {pergolaLightSites,type PergolaLighting} from '@sp/geometry';
import {solvePergolaPreview} from './solvePreview';
import {availableRafterSpots,DEFAULT_LIGHTING} from './lightingSelection';
import type {PreviewRoofChoices} from './GableChoices';
import type {SimpleCoverInput} from '../../lib/simpleCoverCalculator';
type Workspace={tool:null|'rafter'|'cedar'|'strip';setTool:(t:null|'rafter'|'cedar'|'strip')=>void;editing:boolean;view:'Plan'|'3D';setView:(v:'Plan'|'3D')=>void;night:boolean;setNight:(n:boolean)=>void;open:()=>void;close:()=>void;value:PergolaLighting;change:(v:PergolaLighting)=>void;toggle:(id:string)=>void;sites:ReturnType<typeof pergolaLightSites>};
const Context=createContext<Workspace|null>(null);
export const useLighting=()=>useContext(Context);
export default function LightingProvider({input,roof,onChange,children}:{input:SimpleCoverInput;roof:PreviewRoofChoices;onChange:(r:PreviewRoofChoices)=>void;children:ReactNode}){
 const [tool,setTool]=useState<null|'rafter'|'cedar'|'strip'>(null);
 const [editing,setEditing]=useState(false),[night,setNight]=useState(false),[view,setView]=useState<'Plan'|'3D'>('3D');
 const sites=useMemo(()=>{const g=solvePergolaPreview(input,roof).geometry;if(!g)return {strips:[],rafters:[],cedar:[]};const sites=pergolaLightSites(g.assembly,g.covering);return {...sites,rafters:availableRafterSpots(sites.rafters,roof.lighting?.strips??[])};},[input,roof]);
 const value=roof.lighting??DEFAULT_LIGHTING,change=(v:PergolaLighting)=>onChange({...roof,lighting:v});
 return <Context.Provider value={{tool,setTool,editing,view,setView:v=>{setView(v);if(editing&&v==='3D')setNight(true);},night:view==='3D'&&night,setNight,open:()=>{setTool(null);setEditing(true);setView('Plan');},close:()=>{setEditing(false);setView('3D');},value,change,sites,toggle:id=>change({...value,strips:value.strips.includes(id)?value.strips.filter(s=>s!==id):[...value.strips,id]})}}>{children}</Context.Provider>;
}
