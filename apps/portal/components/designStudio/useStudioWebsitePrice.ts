import { useEffect, useState } from 'react';
import type { StudioWebsiteDesign } from '@/lib/designStudio/websiteDesign';
import type { StudioAuthoringEdit } from '@/lib/designStudio/authoringView';
import type { StudioInternalCostSummary } from '@/lib/designStudio/studioInternalCostSummary.server';
export type WebsitePrice = { status: 'priced' | 'unavailable'; amount: number | null; reason?: string; basis?: string; versionNumber?: number; selectionDigest?: string; publicationId?: string; requestKey: string; breakdown?: { label: string; amount: number; detail: string; provisional: boolean }[]; internalCosts?:StudioInternalCostSummary };
export function useStudioWebsitePrice(args: { actorId: string; projectId: string; estimateId: string; designId: string; revision: number; design: StudioWebsiteDesign | null; composition?: StudioAuthoringEdit | null }) {
 const [state, setState] = useState<{ identity: string; price: WebsitePrice | null; error: string | null }>({ identity: '', price: null, error: null });
 const [attempt, retry] = useState(0);
 const payload = { designId: args.designId, revision: args.revision, ...(args.composition ? {composition:args.composition} : {design:args.design}) };
 const requestKey = JSON.stringify(payload);
 const identity = JSON.stringify([args.actorId,args.projectId,args.estimateId,requestKey,attempt]);
 useEffect(() => {
  let live = true; const abort = new AbortController();
  setState({ identity, price: null, error: null });
  if ((!args.design && !args.composition) || !args.actorId) return () => abort.abort();
  const timer = setTimeout(async () => {
   try {
    const response = await fetch(`/api/projects/${encodeURIComponent(args.projectId)}/estimates/${encodeURIComponent(args.estimateId)}/studio-website-price`, { method: 'POST', signal: abort.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, requestKey }) });
    const body = await response.json();
    if (!live) return;
    if (!response.ok) throw Error(body.error || 'Design price unavailable.');
    if (body.requestKey !== requestKey) throw Error('The price does not match these choices.');
    setState({ identity, price: body, error: null });
   } catch (error) { if (live) setState({ identity, price: null, error: error instanceof Error ? error.message : 'Design price unavailable.' }); }
  }, 220);
  return () => { live = false; clearTimeout(timer); abort.abort(); };
 }, [identity]); // The identity includes every request and actor input.
 return { price: state.identity === identity ? state.price : null, error: state.identity === identity ? state.error : null, retry: () => retry(n => n+1) };
}
