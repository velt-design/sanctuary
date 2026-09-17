import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';

/** Describe customer intent before the retained attached-mode settings. */
export function designAttachmentDescription({ input, roof }: PreviewDraft): string {
  if (roof.attachmentIntent === 'freestanding') return 'Freestanding, no house connection';
  if (roof.attachmentIntent === 'unsure') return 'House connection not sure; estimate uses the lowest-priced available attachment, subject to site confirmation';
  if (roof.family === 'gable' && roof.orientation === 'away') return 'Dutch-gable fascia attachment';
  return input.connection === 'soffit' ? 'Soffit brackets' : `${input.connection === 'facade' ? 'Facade' : 'Fascia'} attachment`;
}

export function designRidgeDescription({ roof }: PreviewDraft): string {
  if (roof.attachmentIntent === 'freestanding') return roof.orientation === 'parallel' ? 'Ridge across width' : 'Ridge along projection';
  if (roof.attachmentIntent === 'unsure') return roof.orientation === 'parallel' ? 'Ridge across width' : 'Ridge along projection';
  return roof.orientation === 'parallel' ? 'Ridge parallel to house' : 'Ridge away from house';
}
