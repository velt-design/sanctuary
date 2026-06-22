import { describe, expect, it } from 'vitest';
import {
  connectionTypeFromAttachment,
  pergolaAttachmentFromStoredConnectionFields,
  pergolaAttachmentFromSnap,
} from './pergolaAttachment';

const FREESTANDING_ATTACHMENT = {
  spatialKind: 'freestanding',
  host: null,
  method: 'none',
} as const;

describe('pergolaAttachmentFromSnap', () => {
  // Step 8 of the first-class spatial-entities migration. The snap engine
  // surfaces a host edge; this helper packages it into the persisted shape
  // with a derived spatialKind and a default-or-preferred method.

  it('builds a wall attachment with method=facade_ledger (only valid choice)', () => {
    const attachment = pergolaAttachmentFromSnap({
      hostObjectFamily: 'house_forms',
      hostObjectId: 'house-main',
      hostEdgeKind: 'wall',
      hostEdgeId: 'wall-house-wall-1',
      myEdgeIndex: 2,
    });
    expect(attachment.spatialKind).toBe('wall');
    expect(attachment.method).toBe('facade_ledger');
    expect(attachment.host).toEqual({
      objectFamily: 'house_forms',
      objectId: 'house-main',
      edgeKind: 'wall',
      edgeId: 'wall-house-wall-1',
      myEdgeIndex: 2,
    });
  });

  it('builds a roof_edge attachment with method=fascia_under_gutter by default', () => {
    const attachment = pergolaAttachmentFromSnap({
      hostObjectFamily: 'house_forms',
      hostObjectId: 'house-main',
      hostEdgeKind: 'roof_eave',
      hostEdgeId: 'roof-eave-edge-1',
      myEdgeIndex: 0,
    });
    expect(attachment.spatialKind).toBe('roof_edge');
    expect(attachment.method).toBe('fascia_under_gutter');
  });

  it('honours a method preference when spatialKind=roof_edge', () => {
    const attachment = pergolaAttachmentFromSnap({
      hostObjectFamily: 'house_forms',
      hostObjectId: 'house-main',
      hostEdgeKind: 'roof_eave',
      hostEdgeId: 'roof-eave-edge-1',
      myEdgeIndex: 0,
      methodPreference: 'soffit_brackets',
    });
    expect(attachment.method).toBe('soffit_brackets');
  });

  it('ignores method preference for non-roof_edge spatial kinds', () => {
    const attachment = pergolaAttachmentFromSnap({
      hostObjectFamily: 'house_forms',
      hostObjectId: 'house-main',
      hostEdgeKind: 'wall',
      hostEdgeId: 'wall-house-wall-1',
      myEdgeIndex: 0,
      methodPreference: 'fascia_under_gutter', // Invalid for wall.
    });
    expect(attachment.method).toBe('facade_ledger');
  });

  it('builds a pergola_outline attachment with method=none', () => {
    const attachment = pergolaAttachmentFromSnap({
      hostObjectFamily: 'pergolas',
      hostObjectId: 'pergola-2',
      hostEdgeKind: 'pergola_outline',
      hostEdgeId: 'pergola-2-edge-1',
      myEdgeIndex: 1,
    });
    expect(attachment.spatialKind).toBe('pergola_outline');
    expect(attachment.method).toBe('none');
    expect(attachment.host?.objectFamily).toBe('pergolas');
  });
});

describe('connectionTypeFromAttachment — legacy enum projection', () => {
  // The cost engine reads `ConnectionType` (`'fascia' | 'soffit' | 'wall' |
  // 'freestanding'`); the snap-derived attachment is the new source of truth.
  // This projection is what keeps cost-engine reads unchanged during the
  // migration. Lock the mapping here so a refactor can't silently shift
  // pricing semantics.

  it('maps freestanding → freestanding', () => {
    expect(connectionTypeFromAttachment(FREESTANDING_ATTACHMENT)).toBe('freestanding');
  });

  it('maps wall → wall', () => {
    const attachment = pergolaAttachmentFromSnap({
      hostObjectFamily: 'house_forms',
      hostObjectId: 'house-main',
      hostEdgeKind: 'wall',
      hostEdgeId: 'wall-1',
      myEdgeIndex: 0,
    });
    expect(connectionTypeFromAttachment(attachment)).toBe('wall');
  });

  it('maps roof_edge + fascia_under_gutter → fascia', () => {
    const attachment = pergolaAttachmentFromSnap({
      hostObjectFamily: 'house_forms',
      hostObjectId: 'house-main',
      hostEdgeKind: 'roof_eave',
      hostEdgeId: 'roof-eave-1',
      myEdgeIndex: 0,
      methodPreference: 'fascia_under_gutter',
    });
    expect(connectionTypeFromAttachment(attachment)).toBe('fascia');
  });

  it('maps roof_edge + direct_to_soffit → soffit', () => {
    const attachment = pergolaAttachmentFromSnap({
      hostObjectFamily: 'house_forms',
      hostObjectId: 'house-main',
      hostEdgeKind: 'roof_eave',
      hostEdgeId: 'roof-eave-1',
      myEdgeIndex: 0,
      methodPreference: 'direct_to_soffit',
    });
    expect(connectionTypeFromAttachment(attachment)).toBe('soffit');
  });

  it('maps roof_edge + soffit_brackets → soffit (bracket detail is a quantity hook, not a solver split)', () => {
    const attachment = pergolaAttachmentFromSnap({
      hostObjectFamily: 'house_forms',
      hostObjectId: 'house-main',
      hostEdgeKind: 'roof_eave',
      hostEdgeId: 'roof-eave-1',
      myEdgeIndex: 0,
      methodPreference: 'soffit_brackets',
    });
    expect(connectionTypeFromAttachment(attachment)).toBe('soffit');
  });

  it('maps pergola_outline → freestanding (cost engine treats as no-host until pergola-to-pergola lands)', () => {
    const attachment = pergolaAttachmentFromSnap({
      hostObjectFamily: 'pergolas',
      hostObjectId: 'pergola-2',
      hostEdgeKind: 'pergola_outline',
      hostEdgeId: 'pergola-2-edge-1',
      myEdgeIndex: 0,
    });
    expect(connectionTypeFromAttachment(attachment)).toBe('freestanding');
  });
});

describe('pergolaAttachmentFromStoredConnectionFields — lazy migration', () => {
  // Step 8 follow-up #2: legacy pergola data has `connectionKind` + `strategy`
  // but no `attachment`. This helper graduates the legacy fields into the
  // canonical shape with `host: null` (resolved to a real host on first
  // snap). The geometry pipeline reads spatialKind/method directly so the
  // null host doesn't break solver behavior — it just means the absolute
  // host edge id isn't snap-resolved yet.

  it('maps connectionKind=freestanding to a freestanding attachment', () => {
    expect(pergolaAttachmentFromStoredConnectionFields({ connectionKind: 'freestanding' })).toEqual({
      spatialKind: 'freestanding',
      host: null,
      method: 'none',
    });
  });

  it('treats null/undefined connectionKind as freestanding (safe default)', () => {
    expect(pergolaAttachmentFromStoredConnectionFields({ connectionKind: null })).toEqual(
      FREESTANDING_ATTACHMENT,
    );
    expect(pergolaAttachmentFromStoredConnectionFields({})).toEqual(FREESTANDING_ATTACHMENT);
  });

  it('maps connectionKind=wall to spatialKind=wall + method=facade_ledger with null host', () => {
    expect(
      pergolaAttachmentFromStoredConnectionFields({ connectionKind: 'wall' }),
    ).toEqual({ spatialKind: 'wall', host: null, method: 'facade_ledger' });
  });

  it('maps connectionKind=fascia to spatialKind=roof_edge + method=fascia_under_gutter', () => {
    expect(
      pergolaAttachmentFromStoredConnectionFields({ connectionKind: 'fascia' }),
    ).toEqual({ spatialKind: 'roof_edge', host: null, method: 'fascia_under_gutter' });
  });

  it('maps connectionKind=soffit (no strategy) to method=direct_to_soffit', () => {
    expect(
      pergolaAttachmentFromStoredConnectionFields({ connectionKind: 'soffit' }),
    ).toEqual({ spatialKind: 'roof_edge', host: null, method: 'direct_to_soffit' });
  });

  it('preserves explicit roof_edge strategy when present (soffit_brackets)', () => {
    expect(
      pergolaAttachmentFromStoredConnectionFields({
        connectionKind: 'soffit',
        strategy: 'soffit_brackets',
      }),
    ).toEqual({ spatialKind: 'roof_edge', host: null, method: 'soffit_brackets' });
  });

  it('preserves fascia_under_gutter strategy on soffit (legacy strategy was the picker for the new method)', () => {
    expect(
      pergolaAttachmentFromStoredConnectionFields({
        connectionKind: 'soffit',
        strategy: 'fascia_under_gutter',
      }),
    ).toEqual({ spatialKind: 'roof_edge', host: null, method: 'fascia_under_gutter' });
  });

  it('ignores non-roof_edge strategies (facade_ledger / post_supported_tieback / none) when deriving method', () => {
    // facade_ledger is for spatialKind=wall, post_supported_tieback isn't a
    // roof_edge method. Both should fall through to the kind-based default.
    expect(
      pergolaAttachmentFromStoredConnectionFields({
        connectionKind: 'soffit',
        strategy: 'facade_ledger',
      }).method,
    ).toBe('direct_to_soffit');
    expect(
      pergolaAttachmentFromStoredConnectionFields({
        connectionKind: 'soffit',
        strategy: 'post_supported_tieback',
      }).method,
    ).toBe('direct_to_soffit');
    expect(
      pergolaAttachmentFromStoredConnectionFields({
        connectionKind: 'fascia',
        strategy: 'none',
      }).method,
    ).toBe('fascia_under_gutter');
  });

  it('round-trips through connectionTypeFromAttachment for every legacy connection kind', () => {
    expect(
      connectionTypeFromAttachment(pergolaAttachmentFromStoredConnectionFields({ connectionKind: 'wall' })),
    ).toBe('wall');
    expect(
      connectionTypeFromAttachment(pergolaAttachmentFromStoredConnectionFields({ connectionKind: 'fascia' })),
    ).toBe('fascia');
    expect(
      connectionTypeFromAttachment(pergolaAttachmentFromStoredConnectionFields({ connectionKind: 'soffit' })),
    ).toBe('soffit');
    expect(
      connectionTypeFromAttachment(pergolaAttachmentFromStoredConnectionFields({ connectionKind: 'freestanding' })),
    ).toBe('freestanding');
  });
});
