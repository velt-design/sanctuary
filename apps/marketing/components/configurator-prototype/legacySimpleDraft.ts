import { parseSimpleCoverHandoff } from '../../lib/simpleCoverHandoff';
import { parsePreviewDraft, type PreviewDraft } from './previewDraft';
import { INITIAL_ROOF } from './GableChoices';

/** Migrate selections only. Historical prices/references must be recalculated. */
export function legacySimpleDraft(value: unknown): PreviewDraft | null {
  const handoff = parseSimpleCoverHandoff(value);
  if (!handoff) return null;
  const draft = parsePreviewDraft({version:1,input:handoff.input,roof:INITIAL_ROOF});
  if (!draft || Object.entries(handoff.input).some(([key,value]) => draft.input[key as keyof typeof draft.input] !== value)) return null;
  return draft;
}
