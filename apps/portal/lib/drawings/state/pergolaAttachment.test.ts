import { describe, expect, it } from 'vitest';
import {
  connectionTypeFromAttachment,
  freestandingPergolaAttachment,
  pergolaAttachmentFromSnap,
} from './pergolaAttachment';

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

describe('freestandingPergolaAttachment', () => {
  it('builds a freestanding attachment with no host and method=none', () => {
    const attachment = freestandingPergolaAttachment();
    expect(attachment.spatialKind).toBe('freestanding');
    expect(attachment.host).toBeNull();
    expect(attachment.method).toBe('none');
  });
});

describe('connectionTypeFromAttachment — legacy enum projection', () => {
  // The cost engine reads `ConnectionType` (`'fascia' | 'soffit' | 'wall' |
  // 'freestanding'`); the snap-derived attachment is the new source of truth.
  // This projection is what keeps cost-engine reads unchanged during the
  // migration. Lock the mapping here so a refactor can't silently shift
  // pricing semantics.

  it('maps freestanding → freestanding', () => {
    expect(connectionTypeFromAttachment(freestandingPergolaAttachment())).toBe('freestanding');
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
