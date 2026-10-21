import type { SimpleCoverConnection, SimpleCoverInput } from './simpleCover';
import type { PreviewRoofChoices } from './choices';
import { constrainPreviewConnection } from './model';

export const ATTACHMENT_DESCRIPTIONS: Record<SimpleCoverConnection, string> = {
  fascia: 'Fixes to the fascia board just below your gutter.',
  soffit: 'Brackets connect beneath the eaves, the overhang at the edge of your roof.',
  facade: 'Fixes directly to the house wall, often beneath the upper storey of a two-storey home.',
};

/** Eligibility uses the same public constraint owner; it does not change a draft. */
export function attachmentUnavailable(input: SimpleCoverInput, roof: PreviewRoofChoices, method: SimpleCoverConnection): string | null {
  if(roof.family==='gable'&&roof.orientation==='away'&&method!=='fascia')return 'Gable along the projection uses fascia attachment.';
  if (constrainPreviewConnection({...input, connection: method}, roof.family).connection === method) return null;
  return method === 'fascia' && roof.family === 'box'
    ? 'Fascia attachment is unavailable for Box perimeter.'
    : 'Soffit brackets are available up to 4.0 m projection.';
}
