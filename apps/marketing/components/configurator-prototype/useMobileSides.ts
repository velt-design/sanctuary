'use client';
import { useState } from 'react';
import { usePreviewBlinds } from './PreviewBlindProvider';
import type { PreviewRoofChoices } from './GableChoices';
import { applySideTreatment, sideTreatmentAt, type SideTreatment } from './sideTreatment';

export function useMobileSides(roof: PreviewRoofChoices, onChange: (roof: PreviewRoofChoices) => void) {
  const workspace = usePreviewBlinds()!;
  const [ids,setIds]=useState<string[]>([]);
  const [issues,setIssues]=useState<string[]>([]);
  const selected=ids.filter(id=>workspace.openings.some(o=>o.id===id));
  const kinds=selected.map(id=>sideTreatmentAt(roof,id));
  const kind=kinds.length && kinds.every(k=>k===kinds[0]) ? kinds[0] : null;
  function start(initial:string[]=[]){setIds(initial);setIssues([]);workspace.setEditing(false);}
  function apply(kind:SideTreatment){
    const result=applySideTreatment(roof,workspace.openings,selected,kind);
    setIssues(result.issues);
    if(!result.issues.length)onChange(result.roof);
  }
  return {selected,kind,start,apply,issues,toggle:(id:string)=>{setIssues([]);setIds(value=>value.includes(id)?value.filter(v=>v!==id):[...value,id]);}};
}
