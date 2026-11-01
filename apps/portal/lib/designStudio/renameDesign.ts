import { apiJson } from '@/lib/repo/apiClient';
import type { EstimateDetail } from '@/lib/estimates/types';
import { getLocalFirstStoreOwner } from '@/lib/localFirst/store';
import { readStudioWorkingCopy } from './workingCopy';
import type { StudioSaveScope } from './saveTransport';
import { prepareStudioNavigation } from './studioSessionLifecycle';
import { navigateStudioDocument } from './studioDocumentNavigation';
import type { StudioAuthoringResponse } from './authoringRequest.server';

export type StudioRenameRecovery = {
  message: string;
  reopen: () => Promise<void>;
  leave: () => Promise<void>;
  retire: () => void;
};

/** Reuse metadata naming, never retime an authored save. Clean caches refresh on
 * the existing fresh-opening path; dirty/pending copies require their own Save. */
export async function renameStudioDesign(scope: StudioSaveScope, internalName: string | null, signal: AbortSignal, onConfirmed?: (internalName: string | null) => void,adoptPreparation?:(preparation:ReturnType<typeof prepareStudioNavigation>)=>(()=>void)): Promise<StudioRenameRecovery> {
  const fence = prepareStudioNavigation(scope.actorId);
  const href = location.pathname + location.search;
  let dispatched = false, retired = false,detach:(()=>void)|undefined;
  const retire = () => { if (retired) return; retired = true; signal.removeEventListener('abort', retire);if(detach)detach();else fence.release(); };
  signal.addEventListener('abort', retire, {once:true});
  if(signal.aborted)retire();
  const valid = () => !retired && fence.valid() && !signal.aborted && getLocalFirstStoreOwner() === scope.actorId;
  async function reopen() {
    if(!valid())throw Error('The signed-in owner changed.');
    const {authoring} = await apiJson<{authoring:StudioAuthoringResponse}>(`/api/projects/${scope.projectId}/estimates/${scope.estimateId}/studio`, {signal,cache:'no-store'});
    if(!valid())throw Error('The signed-in owner changed.');
    if(authoring.state!=='ready'||authoring.estimate.id!==scope.estimateId||authoring.estimate.projectId!==scope.projectId||authoring.view?.designId!==scope.designId||typeof authoring.estimate.updatedAt!=='string'||!Number.isFinite(Date.parse(authoring.estimate.updatedAt)))
      throw Error('The saved design could not be verified. Try reopening it again.');
    if(authoring.identity)onConfirmed?.(authoring.identity.internalName??null);
    await navigateStudioDocument(href,true,undefined,signal,fence);
  }
  const recovery = (message:string):StudioRenameRecovery => ({message,reopen,leave:async()=>{
    if(!valid())throw Error('The signed-in owner changed.');
    await navigateStudioDocument(`/staff/projects/${scope.projectId}`,true,undefined,signal,fence);
  },retire});
  try {
    await fence.ready;
    signal.throwIfAborted();
    if (!valid()) throw Error('The signed-in owner changed.');
    detach=adoptPreparation?.(fence);
    const found = await readStudioWorkingCopy(scope);
    if (!valid()) throw Error('The signed-in owner changed.');
    if (found.state !== 'absent' && !(found.state === 'valid' && !found.session.dirty && !found.session.pending && found.session.status === 'idle' && found.session.acknowledged))
      throw Error('Save the current design and finish any pending recovery before renaming. Your name is kept.');
    // Storage can outlive the presented frame. Revalidate the same owned
    // preparation synchronously after that await, immediately before dispatch.
    if (adoptPreparation) detach = adoptPreparation(fence);
    dispatched = true;
    const {estimate} = await apiJson<{estimate:EstimateDetail}>(`/api/estimates/${scope.estimateId}`, { method: 'PATCH', body: JSON.stringify({internalName}), signal });
    if (!valid()) throw Error('The signed-in owner changed.');
    if (estimate.id !== scope.estimateId || estimate.projectId !== scope.projectId) throw Error('The renamed design could not be verified.');
    onConfirmed?.(estimate.internalName??null);
    await reopen();
    return recovery('Opening the saved design. If navigation did not finish, reopen it here.');
  } catch(error) {
    if(!dispatched||!valid()){retire();throw error;}
    // The server may already have changed updatedAt. Never resume the old
    // authoring baseline or automatically retry PATCH after an uncertain result.
    return recovery('The name may already be saved. Reopen the saved design before continuing. Your entered name and local work are kept.');
  }
}
