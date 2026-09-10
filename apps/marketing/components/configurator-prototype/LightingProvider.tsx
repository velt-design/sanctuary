'use client';
import {createContext,useContext,useMemo,useState,type ReactNode} from 'react';
import {pergolaLightSites,type PergolaLighting} from '@sp/geometry';
import {solvePergolaPreview} from './solvePreview';
import {availableRafterSpots,DEFAULT_LIGHTING} from './lightingSelection';
import type {PreviewRoofChoices} from './GableChoices';
import type {SimpleCoverInput} from '../../lib/simpleCoverCalculator';
type Workspace={editing:boolean;night:boolean;setNight:(n:boolean)=>void;open:()=>void;close:()=>void;value:PergolaLighting;change:(v:PergolaLighting)=>void;toggle:(id:string)=>void;sites:ReturnType<typeof pergolaLightSites>};
const Context=createContext<Workspace|null>(null);
export const useLighting=()=>useContext(Context);
export default function LightingProvider({input,roof,onChange,children}:{input:SimpleCoverInput;roof:PreviewRoofChoices;onChange:(r:PreviewRoofChoices)=>void;children:ReactNode}){
 const [editing,setEditing]=useState(false),[night,setNight]=useState(false);
 const sites=useMemo(()=>{const g=solvePergolaPreview(input,roof).geometry;if(!g)return {strips:[],rafters:[],cedar:[]};const sites=pergolaLightSites(g.assembly,g.covering);return {...sites,rafters:availableRafterSpots(sites.rafters,roof.lighting?.strips??[])};},[input,roof]);
 const value=roof.lighting??DEFAULT_LIGHTING,change=(v:PergolaLighting)=>onChange({...roof,lighting:v});
 return <Context.Provider value={{editing,night,setNight,open:()=>{setEditing(true);setNight(true);},close:()=>{setEditing(false);setNight(false);},value,change,sites,toggle:id=>change({...value,strips:value.strips.includes(id)?value.strips.filter(s=>s!==id):[...value.strips,id]})}}>{children}</Context.Provider>;
}
