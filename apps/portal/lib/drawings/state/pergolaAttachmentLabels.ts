import type {
  PergolaAttachment,
  PergolaAttachmentMethod,
  PergolaAttachmentSpatialKind,
} from './objectFirstWorkbenchModel';

/**
 * Step 9 of the first-class spatial-entities migration. UI labels for the
 * derived pergola attachment inspector. Pure mapping helpers — no React,
 * no styling — so they can be tested in isolation and reused by any
 * inspector surface (panel, status row, diagnostics).
 */

export const PERGOLA_ATTACHMENT_METHOD_OPTIONS: ReadonlyArray<{
  value: PergolaAttachmentMethod;
  label: string;
}> = [
  { value: 'fascia_under_gutter', label: 'Fascia under gutter' },
  { value: 'direct_to_soffit', label: 'Direct to soffit' },
  { value: 'soffit_brackets', label: 'Soffit brackets' },
];

export function labelForPergolaAttachmentSpatialKind(kind: PergolaAttachmentSpatialKind): string {
  switch (kind) {
    case 'wall':
      return 'Wall';
    case 'roof_edge':
      return 'Roof edge';
    case 'pergola_outline':
      return 'Pergola';
    case 'freestanding':
      return 'Freestanding';
  }
}

export function labelForPergolaAttachmentMethod(method: PergolaAttachmentMethod): string {
  switch (method) {
    case 'facade_ledger':
      return 'Facade ledger';
    case 'fascia_under_gutter':
      return 'Fascia under gutter';
    case 'direct_to_soffit':
      return 'Direct to soffit';
    case 'soffit_brackets':
      return 'Soffit brackets';
    case 'none':
      return '—';
  }
}

/**
 * Friendly label for the host edge derived from `attachment.host.edgeId`.
 * The snap engine emits ids of the form `wall-${id}` or `roof-eave-${id}`;
 * this helper translates them to a readable phrase. When `host` is null,
 * returns the "not snapped" sentinel so the inspector can prompt the user
 * to drag.
 */
export function labelForPergolaAttachmentHostEdge(attachment: PergolaAttachment): string {
  if (attachment.spatialKind === 'freestanding') return '—';
  const host = attachment.host;
  if (!host) return 'Not snapped — drag to assign';
  switch (host.edgeKind) {
    case 'wall':
      return 'House wall';
    case 'roof_eave':
      return 'House roof eave';
    case 'pergola_outline':
      return 'Pergola edge';
  }
}

/**
 * Friendly label for the host zone — the "where on the host" descriptor that
 * follows from `host.edgeKind`. Read-only in the inspector since it's fully
 * derived.
 */
export function labelForPergolaAttachmentHostZone(attachment: PergolaAttachment): string {
  switch (attachment.spatialKind) {
    case 'wall':
      return 'Wall facade';
    case 'roof_edge':
      switch (attachment.method) {
        case 'fascia_under_gutter':
          return 'Roof eave fascia';
        case 'direct_to_soffit':
          return 'Roof eave soffit';
        case 'soffit_brackets':
          return 'Roof eave soffit (brackets)';
        default:
          return 'Roof eave';
      }
    case 'pergola_outline':
      return 'Pergola outline';
    case 'freestanding':
      return '—';
  }
}

/**
 * Whether the inspector should show the Attachment Method picker as a
 * writable control. Per the architecture doc, only `roof_edge` exposes a
 * choice; other spatial kinds have a single valid method (derived).
 */
export function pergolaAttachmentMethodIsWritable(attachment: PergolaAttachment): boolean {
  return attachment.spatialKind === 'roof_edge';
}
