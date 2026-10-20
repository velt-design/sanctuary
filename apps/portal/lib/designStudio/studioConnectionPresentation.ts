import { previewSupportDatum } from '@sp/configurator/geometry';
import type { websiteComposition } from './websiteComposition';

const studioConnectionMethods = { facade: 'Wall', fascia: 'Fascia', soffit: 'Soffit brackets' } as const;
export const studioMillimetres = (value: number) => `${value.toLocaleString('en-NZ', { maximumFractionDigits: 1 })} mm`;

/** Intent is a design choice. Only a resolved house binding establishes a connection. */
export function studioConnectionPresentation(row: ReturnType<typeof websiteComposition>[number], houseLabel = 'House') {
  const binding = row.studioAttachment;
  if (binding) {
    const support = row.error ? binding.reference.supportDatumMm : row.geometryOptions?.supportDatumMm;
    return {
      state: row.error ? 'Connection needs repair' : 'Connected to house',
      detail: `${studioConnectionMethods[binding.method]} · ${houseLabel} · ${binding.edge} ${binding.kind === 'wall' ? 'wall' : 'roof edge'}`,
      height: support === undefined ? null : `${row.error ? 'Retained reference' : 'Resolved'} support underside: ${studioMillimetres(support)}`,
      next: row.error ? 'Repair the connection or detach at the retained reference.' : 'The pergola follows this house edge. Alignment with another object does not create a connection.',
    };
  }
  const intent = row.value?.selection.roof.attachmentIntent;
  let support: number | null = null;
  if (!row.error && row.design) { try { support = previewSupportDatum(row.geometryOptions); } catch { /* Invalid references remain unavailable. */ } }
  return {
    state: intent === 'freestanding' ? 'Freestanding' : intent === 'unsure' ? 'Support undecided' : 'House connection planned',
    detail: 'No house edge is connected.',
    height: support === null ? null : `Resolved support reference underside: ${studioMillimetres(support)}. This is not a post cut length.`,
    next: intent === 'freestanding' ? 'Independent placement. Use Connect to house to change the support.' : 'Choose a house edge and apply a connection. Visual alignment alone does not connect it.',
  };
}
