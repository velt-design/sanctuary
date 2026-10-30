import { useEffect, useMemo, useRef, useState } from 'react';
import type { StudioWebsiteDesign } from '@/lib/designStudio/websiteDesign';
import type { StudioAuthoringEdit } from '@/lib/designStudio/authoringView';
import {studioWebsitePricePayload,type WebsitePrice,type StudioOpeningPrice} from '@/lib/designStudio/studioOpening';
export type {WebsitePrice} from '@/lib/designStudio/studioOpening';
export function useStudioWebsitePrice(args: { actorId: string; projectId: string; estimateId: string; designId: string; revision: number; design: StudioWebsiteDesign | null; composition?: StudioAuthoringEdit | null;openingPrice?:StudioOpeningPrice;openingState?:'waiting'|'eligible'|'ineligible' }) {
 const [state, setState] = useState<{ identity: string; price: WebsitePrice | null; error: string | null }>({ identity: '', price: null, error: null });
 const [attempt, retry] = useState(0);
 const scopeIdentity = useMemo(() => JSON.stringify([args.actorId,args.projectId,args.estimateId,args.designId]), [args.actorId,args.projectId,args.estimateId,args.designId]);
 const schedule = useRef<{scope:string;started:boolean;attempt:number}|null>(null);
 const openingOwner=useRef({});
 // Authoring owners replace immutable snapshots; transient placement overlays do
 // not change their price input. Equal restored clones still produce the same key.
 const { payload, requestKey } = useMemo(() => {
  return studioWebsitePricePayload(args);
 }, [args.designId, args.revision, args.composition, args.design]);
 const identity = useMemo(() => JSON.stringify([args.actorId,args.projectId,args.estimateId,requestKey,attempt]), [args.actorId,args.projectId,args.estimateId,requestKey,attempt]);
 useEffect(() => {
  let live = true; const abort = new AbortController();
  setState({ identity, price: null, error: null });
  if (schedule.current?.scope !== scopeIdentity) schedule.current = {scope:scopeIdentity,started:false,attempt};
  if(args.openingPrice&&args.openingState==='waiting')return()=>{live=false;abort.abort();};
  if ((!args.design && !args.composition) || !args.actorId) { args.openingPrice?.retire(); return () => abort.abort(); }
  const currentSchedule = schedule.current;
  if(attempt||args.openingState==='ineligible')args.openingPrice?.retire();
  const initial=!attempt?args.openingPrice?.acquire(openingOwner.current,{actorId:args.actorId,projectId:args.projectId,estimateId:args.estimateId,designId:args.designId,revision:args.revision,requestKey}):null;
  if(initial){
   currentSchedule.started=true;currentSchedule.attempt=attempt;
   void initial.result.then(result=>{if(!live)return;setState(result.ok&&result.price.requestKey===requestKey?{identity,price:result.price,error:null}:{identity,price:null,error:result.ok?'The price does not match these choices.':result.error});});
   const owner=openingOwner.current;
   return()=>{live=false;abort.abort();args.openingPrice?.release(owner,initial.lease);};
  }
  const delay = !currentSchedule.started || currentSchedule.attempt !== attempt ? 0 : 220;
  const timer = setTimeout(async () => {
   if (!live || abort.signal.aborted) return;
   // Consume the first-request/retry turn only when the request actually starts.
   currentSchedule.started = true; currentSchedule.attempt = attempt;
   try {
    const response = await fetch(`/api/projects/${encodeURIComponent(args.projectId)}/estimates/${encodeURIComponent(args.estimateId)}/studio-website-price`, { method: 'POST', signal: abort.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, requestKey }) });
    const body = await response.json();
    if (!live) return;
    if (!response.ok) throw Error(body.error || 'Design price unavailable.');
    if (body.requestKey !== requestKey) throw Error('The price does not match these choices.');
    setState({ identity, price: body, error: null });
   } catch (error) { if (live) setState({ identity, price: null, error: error instanceof Error ? error.message : 'Design price unavailable.' }); }
  }, delay);
  return () => { live = false; clearTimeout(timer); abort.abort(); };
 }, [identity,args.openingPrice,args.openingState]); // Identity includes every request and actor input; optional opening is one-shot.
 return { price: state.identity === identity ? state.price : null, error: state.identity === identity ? state.error : null, retry: () => retry(n => n+1) };
}
