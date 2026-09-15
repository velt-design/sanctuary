'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {readDesignContinuation,updateDesignContinuation} from './designContinuation';
import {useLighting} from './LightingProvider';
export type RailSection='structure'|'roof'|'sides'|'lighting'|'personalise'|'review';
const Context=createContext<{section:RailSection;explored:RailSection[];choose:(section:RailSection)=>void}|null>(null);
export const useRail=()=>useContext(Context)!;
export default function RailProvider({children,resume=false}:{children:ReactNode;resume?:boolean}){
 const [explored,setExplored]=useState<RailSection[]>([]);
 const [section,setSection]=useState<RailSection>('structure');const lighting=useLighting()!;
 useEffect(()=>{if(!resume&&new URLSearchParams(window.location.search).get("resume")!=="1")return;const saved=readDesignContinuation().section;setSection(saved);if(saved==='lighting')lighting.open();},[]);
 const active=lighting.editing?'lighting':section==='lighting'?'structure':section;
 return <Context.Provider value={{section:active,explored,choose:next=>{updateDesignContinuation({section:next});setExplored(previous=>previous.includes(next)?previous:[...previous,next]);if(next==='lighting'){if(!lighting.editing)lighting.open();}else if(lighting.editing)lighting.close();setSection(next);}}}>{children}</Context.Provider>;
}
