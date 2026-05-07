import type { ConnectionType } from '@sp/geometry';
import type {
  PergolaAttachment,
  PergolaAttachmentHost,
  PergolaAttachmentMethod,
  PergolaAttachmentSpatialKind,
} from './objectFirstWorkbenchModel';

/**
 * Step 8 of the first-class spatial-entities migration. Helpers for the
 * snap-derived `PergolaAttachment` shape:
 *
 * - `pergolaAttachmentFromSnap(...)` — given a snap engine result, build the
 *   canonical attachment (host + spatialKind + method).
 * - `connectionTypeFromAttachment(...)` — collapse the new shape to the
 *   legacy `ConnectionType` enum so cost-engine reads stay unchanged.
 *
 * No dependency on the snap engine module — the input is a plain object so
 * this helper is testable without pulling viewport plumbing.
 */

export type AttachmentSnapInput = {
  hostObjectFamily: 'house_forms' | 'pergolas';
  hostObjectId: string;
  hostEdgeKind: 'wall' | 'roof_eave' | 'pergola_outline';
  hostEdgeId: string;
  myEdgeIndex: number;
  /**
   * Method picked by the user when the user-facing inspector exposed one.
   * Only meaningful when `hostEdgeKind === 'roof_eave'`. Ignored otherwise.
   */
  methodPreference?: PergolaAttachmentMethod | null;
};

function spatialKindFromEdgeKind(
  edgeKind: PergolaAttachmentHost['edgeKind'],
): PergolaAttachmentSpatialKind {
  switch (edgeKind) {
    case 'wall':
      return 'wall';
    case 'roof_eave':
      return 'roof_edge';
    case 'pergola_outline':
      return 'pergola_outline';
  }
}

function defaultMethodForSpatialKind(
  spatialKind: PergolaAttachmentSpatialKind,
  preference?: PergolaAttachmentMethod | null,
): PergolaAttachmentMethod {
  switch (spatialKind) {
    case 'freestanding':
      return 'none';
    case 'wall':
      return 'facade_ledger';
    case 'pergola_outline':
      return 'none';
    case 'roof_edge': {
      const validRoofEdgeMethods: PergolaAttachmentMethod[] = [
        'fascia_under_gutter',
        'direct_to_soffit',
        'soffit_brackets',
      ];
      if (preference && validRoofEdgeMethods.includes(preference)) return preference;
      return 'fascia_under_gutter';
    }
  }
}

/**
 * Build a `PergolaAttachment` from a resolved snap target. The snap engine
 * surfaces target info; this helper packages it into the canonical
 * persisted shape.
 */
export function pergolaAttachmentFromSnap(input: AttachmentSnapInput): PergolaAttachment {
  const spatialKind = spatialKindFromEdgeKind(input.hostEdgeKind);
  const method = defaultMethodForSpatialKind(spatialKind, input.methodPreference ?? null);
  return {
    spatialKind,
    host: {
      objectFamily: input.hostObjectFamily,
      objectId: input.hostObjectId,
      edgeKind: input.hostEdgeKind,
      edgeId: input.hostEdgeId,
      myEdgeIndex: input.myEdgeIndex,
    },
    method,
  };
}

/** Build a freestanding attachment (no host). */
export function freestandingPergolaAttachment(): PergolaAttachment {
  return {
    spatialKind: 'freestanding',
    host: null,
    method: 'none',
  };
}

/**
 * Project the snap-derived attachment onto the legacy `ConnectionType` enum
 * the geometry/cost pipeline reads. The mapping is deterministic:
 *
 * - `freestanding` → `freestanding`
 * - `wall` → `wall`
 * - `pergola_outline` → `freestanding` (no house host; wired up properly
 *   when pergola-to-pergola attachments graduate from v1)
 * - `roof_edge` + method:
 *   - `fascia_under_gutter` → `fascia`
 *   - `direct_to_soffit` → `soffit`
 *   - `soffit_brackets` → `soffit` (bracket-attached but structurally on
 *     the soffit; the bracket detail is a quantity hook, not a connection
 *     type for the solver)
 */
export function connectionTypeFromAttachment(attachment: PergolaAttachment): ConnectionType {
  if (attachment.spatialKind === 'freestanding') return 'freestanding';
  if (attachment.spatialKind === 'wall') return 'wall';
  if (attachment.spatialKind === 'pergola_outline') return 'freestanding';
  // spatialKind === 'roof_edge'
  switch (attachment.method) {
    case 'fascia_under_gutter':
      return 'fascia';
    case 'direct_to_soffit':
    case 'soffit_brackets':
      return 'soffit';
    default:
      return 'soffit';
  }
}
