import { keys } from 'idb-keyval';
import { readStudioWorkingCopy, studioWorkingCopyKey } from './workingCopy';
import { readStudioPendingCommand, studioPendingCommandKey } from './saveTransport';
import { readStudioPendingCreation, studioPendingCreationKey } from './createTransport';
import { readPriceSave, priceSaveKey } from './priceSaveTransport';
import { readQuoteReviewSave, quoteReviewSaveKey } from './quoteReviewSaveTransport';
import { readQuoteDraftSave, quoteDraftSaveKey } from './quoteDraftSaveTransport';

import {prepareStudioLifecycleSignOut,type StudioRetentionSummary} from './studioSessionLifecycle';
export {invalidateStudioLifecycle,registerStudioLifecycle,registerStudioPresentation,prepareStudioNavigation} from './studioSessionLifecycle';
export type {StudioLifecycleRegistration,StudioRetentionSummary,StudioSignOutPreparation} from './studioSessionLifecycle';

/** Read only the captured actor's namespaces; existing owners validate every stored schema. */
export async function inventoryStudioRetention(actorId: string, stillCurrent: () => boolean): Promise<StudioRetentionSummary> {
  const summary = { records: 0, dirty: 0, requests: 0, confirmations: 0, recovery: 0 };
  const allKeys = await keys();
  if (!stillCurrent()) throw Error('Session changed');
  for (const key of allKeys) {
    if (typeof key !== 'string') continue;
    const raw = key.split(':');
    if (!['sanctuary-studio-working-copy', 'sanctuary-studio-pending', 'sanctuary-studio-creation-pending', 'sanctuary-studio-price-pending', 'sanctuary-studio-quote-review-pending', 'sanctuary-studio-quote-draft-pending'].includes(raw[0])) continue;
    let parts: string[];
    try { parts = raw.map(decodeURIComponent); } catch {
      if (raw[2] === encodeURIComponent(actorId)) { summary.records++; summary.recovery++; }
      continue;
    }
    if (parts[2] !== actorId) continue;
    summary.records++;
    if (parts[1] !== 'v1') { summary.recovery++; continue; }
    if (!stillCurrent()) throw Error('Session changed');
    try {
      if (parts[0] === 'sanctuary-studio-working-copy') {
        const scope = { actorId, projectId: parts[3], estimateId: parts[4], designId: parts[5] };
        if (parts.length !== 6 || studioWorkingCopyKey(scope) !== key) { summary.recovery++; continue; }
        const result = await readStudioWorkingCopy(scope);
        if (result.state === 'unavailable') throw Error('Storage unavailable');
        if (result.state === 'valid') { if (result.session.dirty || result.session.pending) summary.dirty++; }
        else if (result.state !== 'absent') summary.recovery++;
      } else if (parts[0] === 'sanctuary-studio-pending') {
        const scope = { actorId, projectId: parts[3], estimateId: parts[4], designId: parts[5] };
        const ref = { expectedRevision: Number(parts[6]), requestId: parts[7] };
        if (parts.length !== 8 || studioPendingCommandKey(scope, ref) !== key) { summary.recovery++; continue; }
        const result = await readStudioPendingCommand(scope, ref);
        if (result.state === 'unavailable') throw Error('Storage unavailable');
        if (result.state === 'valid') { if (result.receipt) summary.confirmations++; else summary.requests++; }
        else if (result.state !== 'absent') summary.recovery++;
      } else if (parts[0] === 'sanctuary-studio-quote-draft-pending') {
        const scope = { actorId, projectId: parts[3], estimateId: parts[4] };
        if (parts.length !== 5 || quoteDraftSaveKey(scope) !== key) { summary.recovery++; continue; }
        const result = await readQuoteDraftSave(scope);
        if (result.state === 'unavailable') throw Error('Storage unavailable');
        if (result.state === 'valid') { if (result.receipt) summary.confirmations++; else summary.requests++; }
        else if (result.state !== 'absent') summary.recovery++;
      } else if (parts[0] === 'sanctuary-studio-quote-review-pending') {
        const scope = { actorId, projectId: parts[3], estimateId: parts[4] };
        if (parts.length !== 5 || quoteReviewSaveKey(scope) !== key) { summary.recovery++; continue; }
        const result = await readQuoteReviewSave(scope);
        if (result.state === 'unavailable') throw Error('Storage unavailable');
        if (result.state === 'valid') { if (result.receipt) summary.confirmations++; else summary.requests++; }
        else if (result.state !== 'absent') summary.recovery++;
      } else if (parts[0] === 'sanctuary-studio-price-pending') {
        const scope = { actorId, projectId: parts[3], estimateId: parts[4], designId: parts[5] };
        if (parts.length !== 6 || priceSaveKey(scope) !== key) { summary.recovery++; continue; }
        const result = await readPriceSave(scope);
        if (result.state === 'unavailable') throw Error('Storage unavailable');
        if (result.state === 'valid') { if (result.receipt) summary.confirmations++; else summary.requests++; }
        else if (result.state !== 'absent') summary.recovery++;
      } else {
        const scope = { actorId, projectId: parts[3] }, ref = { requestId: parts[4] };
        if (parts.length !== 5 || studioPendingCreationKey(scope, ref) !== key) { summary.recovery++; continue; }
        const result = await readStudioPendingCreation(scope, ref);
        if (result.state === 'unavailable') throw Error('Storage unavailable');
        if (result.state === 'valid') { if (result.receipt) summary.confirmations++; else summary.requests++; }
        else if (result.state !== 'absent') summary.recovery++;
      }
    } catch (error) {
      // Invalid key identities remain recovery evidence. Read failures cannot be called an empty inventory.
      if (error instanceof Error && error.message === 'Storage unavailable') throw error;
      summary.recovery++;
    }
    if (!stillCurrent()) throw Error('Session changed');
  }
  return summary;
}


/** Compatibility retention/sign-out adapter. The shared lifetime registry and
 * fences stay with the lightweight session owner; journal readers load only here. */
export function prepareStudioSignOut(actorId:string,sessionCurrent:()=>boolean){
 return prepareStudioLifecycleSignOut(actorId,sessionCurrent,inventoryStudioRetention);
}
