'use client';
import type { useStudioEditingSession } from './useStudioEditingSession';
import { parseStudioWebsiteDesign } from '@/lib/designStudio/websiteDesign';
import css from './StudioWebsite.module.css';
type Controller = ReturnType<typeof useStudioEditingSession>;
export default function StudioWebsiteRecovery({ controller,onRetryQuote }: { controller: Controller;onRetryQuote?:()=>void }) {
  const message = controller.message === 'Saved.' ? null : controller.message;
  if (!message && !controller.retainedCopies.length) return null;
  return <div className={css.recovery}>
    {message && <p role="status">{message}</p>}
    {controller.canUseSaved && <button onClick={()=>void controller.useSaved()}>Use saved design</button>}
    {controller.canRetry && <button onClick={()=>void controller.retry()}>Retry save</button>}
    {controller.canRetryQuote && onRetryQuote && <button onClick={onRetryQuote}>Retry quote</button>}
    {controller.retainedCopies.length > 0 && <details><summary>Your previous design choices are kept</summary>
      <p>Restore design choices only. Previous site and commercial work remains in the retained copy and is not applied.</p>
      {controller.retainedCopies.map(copy=>{const row=copy.session.edit.objectOptions.find(row=>row.values.websiteDesign), parsed=parseStudioWebsiteDesign(row?.values.websiteDesign,row?.objectId);return <div className={css.retainedChoice} key={copy.key}><span>{parsed.ok?`${({mono:'Pitched',gable:'Gable',box:'Box perimeter'}[parsed.value.selection.roof.family])} · ${parsed.value.rawDimensions.widthMm} × ${parsed.value.rawDimensions.projectionMm} mm`:'Retained design'} · revision {copy.session.baseRevision}</span><button disabled={!controller.canRestoreChoices} onClick={()=>controller.restoreChoices(copy.key)}>Restore choices</button></div>;})}
      {!controller.canRestoreChoices && <p>Save the current changes before restoring previous choices.</p>}
    </details>}
  </div>;
}
