'use client';
import {createContext,useContext,useState,type ReactNode} from 'react';
import {useLighting} from './LightingProvider';
export type RailSection='structure'|'roof'|'sides'|'lighting';
const Context=createContext<{section:RailSection;choose:(section:RailSection)=>void}|null>(null);
export const useRail=()=>useContext(Context)!;
export default function RailProvider({children}:{children:ReactNode}){
 const [section,setSection]=useState<RailSection>('structure');const lighting=useLighting()!;
 const active=lighting.editing?'lighting':section==='lighting'?'structure':section;
 return <Context.Provider value={{section:active,choose:next=>{if(next==='lighting'){if(!lighting.editing)lighting.open();}else if(lighting.editing)lighting.close();setSection(next);}}}>{children}</Context.Provider>;
}
