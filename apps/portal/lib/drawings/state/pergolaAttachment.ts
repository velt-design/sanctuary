import type { ConnectionType } from '@sp/geometry';
import type { CalculatorHouseAttachmentStrategy } from '@/lib/types/calculator';
import type {
  ObjectFirstPergolaConnectionKind,
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
 * - `connectionTypeFromAttachment(...)` — project the attachment to the
 *   package geometry connection enum used by pergola solves.
 *
 * No dependency on the snap engine module — the input is a plain object so
 * this helper is testable without pulling viewport plumbing.
 */

// Module-internal: only `pergolaAttachmentFromSnap` uses this shape.
type AttachmentSnapInput = {
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
 * Build a `PergolaAttachment` from older stored connection fields
 * (`connectionKind` + `strategy`) when a persisted draft has not yet written
 * the canonical attachment shape. `attachmentEdgeId` is a footprint edge id
 * (not the snap engine's `wall-${id}` / `roof-eave-${id}` format) so we do
 * not synthesize a host from it. Instead we leave `host: null`, signalling
 * "spatial kind is known but absolute host edge has not yet been resolved
 * through a snap" per the relaxed PergolaAttachment invariants.
 *
 * The pergola edge-drag handler upgrades the host from null to a resolved
 * `PergolaAttachmentHost` whenever the user snaps to a wall or roof eave.
 * Until then, `host: null + spatialKind: 'wall'` (etc.) is the normal state
 * for drafts with stored connection fields only.
 */
export function pergolaAttachmentFromStoredConnectionFields(input: {
  connectionKind?: ObjectFirstPergolaConnectionKind | null;
  strategy?: CalculatorHouseAttachmentStrategy | null;
}): PergolaAttachment {
  const kind = input.connectionKind ?? null;
  if (!kind || kind === 'freestanding') return freestandingPergolaAttachment();
  if (kind === 'wall') {
    return { spatialKind: 'wall', host: null, method: 'facade_ledger' };
  }
  // kind === 'soffit' | 'fascia' -> roof_edge. Method derivation:
  //   1. Explicit roof_edge strategy wins when the stored strategy matches a
  //      current attachment method.
  //   2. Otherwise: 'fascia' -> 'fascia_under_gutter', 'soffit' -> 'direct_to_soffit'.
  const strategy = input.strategy ?? null;
  let method: PergolaAttachmentMethod;
  if (
    strategy === 'soffit_brackets' ||
    strategy === 'fascia_under_gutter'
  ) {
    method = strategy;
  } else if (kind === 'fascia') {
    method = 'fascia_under_gutter';
  } else {
    method = 'direct_to_soffit';
  }
  return { spatialKind: 'roof_edge', host: null, method };
}

/**
 * Project the snap-derived attachment onto the package geometry
 * `ConnectionType` enum. The mapping is deterministic:
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

/**
 * Project the snap-derived attachment onto the workbench-internal
 * `ObjectFirstPergolaConnectionKind` enum used by inspector/status/store
 * code paths. Mirrors `connectionTypeFromAttachment` but stays in the
 * workbench domain (no `freestanding` collapse for `pergola_outline`
 * needs different handling once pergola-to-pergola attachments land —
 * for now we keep the same collapse as cost projection).
 */
export function connectionKindFromAttachment(
  attachment: PergolaAttachment,
): ObjectFirstPergolaConnectionKind {
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
