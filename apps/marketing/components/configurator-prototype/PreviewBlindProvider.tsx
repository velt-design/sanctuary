'use client';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { BlindOpening } from '@sp/geometry';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';
import type { PreviewBlind } from './blindCatalog';
import { previewBlindOpenings } from './blindSelection';
type BlindWorkspace={openings:BlindOpening[];blinds:PreviewBlind[];selected:string;select:(id:string)=>void;editing:boolean;setEditing:(value:boolean)=>void;update:(blinds:PreviewBlind[])=>void};
const Context=createContext<BlindWorkspace|null>(null);
export const usePreviewBlinds=()=>useContext(Context);
export default function PreviewBlindProvider({input,roof,onChange,children}:{input:SimpleCoverInput;roof:PreviewRoofChoices;onChange:(roof:PreviewRoofChoices)=>void;children:ReactNode}) {
  const openings=useMemo(()=>previewBlindOpenings(input,roof),[input,roof]);
  const [selected,setSelected]=useState(''),[editing,setEditing]=useState(false);
  const value:BlindWorkspace={openings,blinds:roof.blinds??[],selected:openings.some(o=>o.id===selected)?selected:openings[0]?.id??'',
    select:id=>{setSelected(id);setEditing(true);},editing,setEditing,update:blinds=>onChange({...roof,blinds})};
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
