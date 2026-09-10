'use client';
import {useRail} from './RailProvider';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { BlindOpening } from '@sp/geometry';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';
import type { PreviewBlind } from './blindCatalog';
import { previewBlindOpenings } from './blindSelection';
import { defaultSidePanel, type SidePanel } from './sidePanelCatalog';
import { defaultBlind } from './blindCatalog';
type BlindWorkspace={openings:BlindOpening[];blinds:PreviewBlind[];panels:SidePanel[];setPanel:(panel:SidePanel)=>void;setKind:(kind:'open'|'blind'|SidePanel['kind'])=>void;selected:string;select:(id:string)=>void;editing:boolean;setEditing:(value:boolean)=>void;update:(blinds:PreviewBlind[])=>void};
const Context=createContext<BlindWorkspace|null>(null);
export const usePreviewBlinds=()=>useContext(Context);
export default function PreviewBlindProvider({input,roof,onChange,children}:{input:SimpleCoverInput;roof:PreviewRoofChoices;onChange:(roof:PreviewRoofChoices)=>void;children:ReactNode}) {
  const rail=useRail();
  const openings=useMemo(()=>previewBlindOpenings(input,roof),[input,roof]);
  const [selected,setSelected]=useState(''),[editing,setEditing]=useState(false);
  const current=openings.some(o=>o.id===selected)?selected:openings[0]?.id??'';
  const value:BlindWorkspace={openings,blinds:roof.blinds??[],panels:roof.sidePanels??[],selected:current,
    setPanel:panel=>onChange({...roof,sidePanels:[...(roof.sidePanels??[]).filter(p=>p.opening!==current),panel]}),
    setKind:kind=>onChange({...roof,blinds:[...(roof.blinds??[]).filter(b=>b.opening!==current),...(kind==='blind'?[defaultBlind(current)]:[])],sidePanels:[...(roof.sidePanels??[]).filter(p=>p.opening!==current),...(['acrylic','timber','aluminium'].includes(kind)?[defaultSidePanel(current,kind as SidePanel['kind'])]:[])]}),
    select:id=>{setSelected(id);setEditing(true);rail.choose('sides');},editing,setEditing,update:blinds=>onChange({...roof,blinds})};
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
