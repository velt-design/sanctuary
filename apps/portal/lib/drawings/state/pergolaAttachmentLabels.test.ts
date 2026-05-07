import { describe, expect, it } from 'vitest';
import type { PergolaAttachment } from './objectFirstWorkbenchModel';
import {
  PERGOLA_ATTACHMENT_METHOD_OPTIONS,
  labelForPergolaAttachmentHostEdge,
  labelForPergolaAttachmentHostZone,
  labelForPergolaAttachmentMethod,
  labelForPergolaAttachmentSpatialKind,
  pergolaAttachmentMethodIsWritable,
} from './pergolaAttachmentLabels';

function attachment(overrides: Partial<PergolaAttachment> = {}): PergolaAttachment {
  return {
    spatialKind: 'roof_edge',
    host: {
      objectFamily: 'house_forms',
      objectId: 'house-main',
      edgeKind: 'roof_eave',
      edgeId: 'roof-eave-edge-1',
      myEdgeIndex: 0,
    },
    method: 'fascia_under_gutter',
    ...overrides,
  };
}

describe('labelForPergolaAttachmentSpatialKind', () => {
  it('maps every spatialKind to a human-readable label', () => {
    expect(labelForPergolaAttachmentSpatialKind('wall')).toBe('Wall');
    expect(labelForPergolaAttachmentSpatialKind('roof_edge')).toBe('Roof edge');
    expect(labelForPergolaAttachmentSpatialKind('pergola_outline')).toBe('Pergola');
    expect(labelForPergolaAttachmentSpatialKind('freestanding')).toBe('Freestanding');
  });
});

describe('labelForPergolaAttachmentMethod', () => {
  it('maps every method to a human-readable label', () => {
    expect(labelForPergolaAttachmentMethod('facade_ledger')).toBe('Facade ledger');
    expect(labelForPergolaAttachmentMethod('fascia_under_gutter')).toBe('Fascia under gutter');
    expect(labelForPergolaAttachmentMethod('direct_to_soffit')).toBe('Direct to soffit');
    expect(labelForPergolaAttachmentMethod('soffit_brackets')).toBe('Soffit brackets');
    expect(labelForPergolaAttachmentMethod('none')).toBe('—');
  });
});

describe('labelForPergolaAttachmentHostEdge', () => {
  it('returns a "not snapped" prompt for non-freestanding attachments with no host', () => {
    expect(labelForPergolaAttachmentHostEdge(attachment({ host: null, spatialKind: 'wall' }))).toBe(
      'Not snapped — drag to assign',
    );
    expect(labelForPergolaAttachmentHostEdge(attachment({ host: null, spatialKind: 'roof_edge' }))).toBe(
      'Not snapped — drag to assign',
    );
  });

  it('returns "—" for freestanding (no host expected)', () => {
    expect(
      labelForPergolaAttachmentHostEdge({ spatialKind: 'freestanding', host: null, method: 'none' }),
    ).toBe('—');
  });

  it('returns a wall label when edgeKind=wall', () => {
    expect(
      labelForPergolaAttachmentHostEdge(
        attachment({
          spatialKind: 'wall',
          method: 'facade_ledger',
          host: {
            objectFamily: 'house_forms',
            objectId: 'house-main',
            edgeKind: 'wall',
            edgeId: 'wall-house-wall-1',
            myEdgeIndex: 0,
          },
        }),
      ),
    ).toBe('House wall');
  });

  it('returns a roof eave label when edgeKind=roof_eave', () => {
    expect(labelForPergolaAttachmentHostEdge(attachment())).toBe('House roof eave');
  });
});

describe('labelForPergolaAttachmentHostZone', () => {
  it('returns "Wall facade" for spatialKind=wall', () => {
    expect(labelForPergolaAttachmentHostZone(attachment({ spatialKind: 'wall' }))).toBe('Wall facade');
  });

  it('returns "Roof eave fascia" for spatialKind=roof_edge + method=fascia_under_gutter', () => {
    expect(
      labelForPergolaAttachmentHostZone(attachment({ method: 'fascia_under_gutter' })),
    ).toBe('Roof eave fascia');
  });

  it('returns "Roof eave soffit" for spatialKind=roof_edge + method=direct_to_soffit', () => {
    expect(
      labelForPergolaAttachmentHostZone(attachment({ method: 'direct_to_soffit' })),
    ).toBe('Roof eave soffit');
  });

  it('distinguishes soffit_brackets from direct_to_soffit (bracket detail is user-visible)', () => {
    expect(
      labelForPergolaAttachmentHostZone(attachment({ method: 'soffit_brackets' })),
    ).toBe('Roof eave soffit (brackets)');
  });

  it('returns "—" for freestanding', () => {
    expect(
      labelForPergolaAttachmentHostZone({ spatialKind: 'freestanding', host: null, method: 'none' }),
    ).toBe('—');
  });
});

describe('pergolaAttachmentMethodIsWritable', () => {
  it('is writable only for roof_edge (the only spatialKind with a method choice)', () => {
    expect(
      pergolaAttachmentMethodIsWritable(attachment({ spatialKind: 'roof_edge' })),
    ).toBe(true);
    expect(pergolaAttachmentMethodIsWritable(attachment({ spatialKind: 'wall' }))).toBe(false);
    expect(pergolaAttachmentMethodIsWritable(attachment({ spatialKind: 'pergola_outline' }))).toBe(
      false,
    );
    expect(
      pergolaAttachmentMethodIsWritable({
        spatialKind: 'freestanding',
        host: null,
        method: 'none',
      }),
    ).toBe(false);
  });
});

describe('PERGOLA_ATTACHMENT_METHOD_OPTIONS', () => {
  it('lists exactly the three roof_edge methods (no facade_ledger / none)', () => {
    expect(PERGOLA_ATTACHMENT_METHOD_OPTIONS.map((option) => option.value)).toEqual([
      'fascia_under_gutter',
      'direct_to_soffit',
      'soffit_brackets',
    ]);
  });
});
