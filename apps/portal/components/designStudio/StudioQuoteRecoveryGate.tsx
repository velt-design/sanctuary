"use client";
import {useEffect,useState,type ReactNode} from 'react';
import {listStudioPendingCommands,type StudioSaveScope} from '@/lib/designStudio/saveTransport';
/** A used-by-quote source can still own an interrupted composite response.
 * Discover only its typed local intent; never infer one from a normal Save. */
export default function StudioQuoteRecoveryGate({scope,children,recovery}:{scope:StudioSaveScope;children:ReactNode;recovery:ReactNode}){
 const [pending,setPending]=useState(false),identity=JSON.stringify(scope);
 useEffect(()=>{let live=true;setPending(false);
  void listStudioPendingCommands(JSON.parse(identity)).then(result=>{
   if(live&&result.state==='available')setPending(result.entries.some(entry=>entry.recovery.state==='valid'&&entry.recovery.operation==='quote_create.v1'));
  });return()=>{live=false;};
 },[identity]);
 return pending?recovery:children;
}
