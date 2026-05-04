import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import {
  defaultPrefixClassifier,
  routeSelectedObject,
  stripOpeningDerivedSuffix,
  topProjectionShapeClassifier,
  type SelectionClassifier,
} from './selectionRouter';

function makeShape(overrides: Partial<GeometryTopProjectionShape>): GeometryTopProjectionShape {
  return {
    id: 'shape-1',
    sourceObjectId: 'shape-1',
    sourceId: null,
    sourceType: 'house_surface',
    family: 'house',
    kind: 'footprint',
    polygon: [],
    zOrder: 0,
    zMin: null,
    zMax: null,
    ...overrides,
  };
}

describe('selectionRouter', () => {
  describe('routeSelectedObject', () => {
    it('returns none for null', () => {
      const classify: SelectionClassifier = () => ({ kind: 'unhandled', objectId: 'x' });
      expect(routeSelectedObject(null, classify)).toEqual({ kind: 'none' });
    });

    it('returns none for undefined', () => {
      const classify: SelectionClassifier = () => ({ kind: 'unhandled', objectId: 'x' });
      expect(routeSelectedObject(undefined, classify)).toEqual({ kind: 'none' });
    });

    it('returns none for empty string', () => {
      const classify: SelectionClassifier = () => ({ kind: 'unhandled', objectId: 'x' });
      expect(routeSelectedObject('', classify)).toEqual({ kind: 'none' });
    });

    it('delegates to the classifier for a non-empty id', () => {
      const classify: SelectionClassifier = (id) => ({ kind: 'pergola', pergolaId: id });
      expect(routeSelectedObject('pergola-xyz', classify)).toEqual({
        kind: 'pergola',
        pergolaId: 'pergola-xyz',
      });
    });
  });

  describe('defaultPrefixClassifier', () => {
    it('classifies deck- prefix as workbench deck', () => {
      expect(defaultPrefixClassifier('deck-1')).toEqual({
        kind: 'workbench',
        targetKind: 'deck',
        targetId: 'deck-1',
      });
    });

    it('classifies opening- prefix as workbench opening with derived suffix stripped', () => {
      expect(defaultPrefixClassifier('opening-12-marker')).toEqual({
        kind: 'workbench',
        targetKind: 'opening',
        targetId: 'opening-12',
      });
      expect(defaultPrefixClassifier('opening-12-outline-3')).toEqual({
        kind: 'workbench',
        targetKind: 'opening',
        targetId: 'opening-12',
      });
      expect(defaultPrefixClassifier('opening-12')).toEqual({
        kind: 'workbench',
        targetKind: 'opening',
        targetId: 'opening-12',
      });
    });

    it('classifies pergola- prefix as pergola', () => {
      expect(defaultPrefixClassifier('pergola-A')).toEqual({
        kind: 'pergola',
        pergolaId: 'pergola-A',
      });
    });

    it('does not misclassify a pergola whose id contains the substring "deck"', () => {
      expect(defaultPrefixClassifier('pergola-deck-cover-1')).toEqual({
        kind: 'pergola',
        pergolaId: 'pergola-deck-cover-1',
      });
    });

    it('returns unhandled for ids that do not match a known prefix', () => {
      expect(defaultPrefixClassifier('house-soffit-1')).toEqual({
        kind: 'unhandled',
        objectId: 'house-soffit-1',
      });
      expect(defaultPrefixClassifier('roof-plane-2')).toEqual({
        kind: 'unhandled',
        objectId: 'roof-plane-2',
      });
    });
  });

  describe('stripOpeningDerivedSuffix', () => {
    it('strips known derived suffixes', () => {
      expect(stripOpeningDerivedSuffix('opening-7-marker')).toBe('opening-7');
      expect(stripOpeningDerivedSuffix('opening-7-outline-1')).toBe('opening-7');
      expect(stripOpeningDerivedSuffix('opening-7-edge')).toBe('opening-7');
    });

    it('leaves a base opening id unchanged', () => {
      expect(stripOpeningDerivedSuffix('opening-7')).toBe('opening-7');
    });

    it('does not strip suffixes that look similar but are not derived', () => {
      expect(stripOpeningDerivedSuffix('opening-7-edgework')).toBe('opening-7-edgework');
    });
  });

  describe('topProjectionShapeClassifier', () => {
    it('returns a pergola target with the metadata pergolaId when present', () => {
      expect(
        topProjectionShapeClassifier(
          makeShape({
            family: 'pergola',
            kind: 'roof_plane',
            sourceObjectId: 'rendered-1',
            metadata: { pergolaId: 'pergola-A' },
          }),
        ),
      ).toEqual({ kind: 'pergola', pergolaId: 'pergola-A' });
    });

    it('falls back through sourceObjectId, sourceId, then id when metadata.pergolaId is absent', () => {
      expect(
        topProjectionShapeClassifier(
          makeShape({ family: 'pergola', kind: 'roof_plane', sourceObjectId: 'pergola-X' }),
        ),
      ).toEqual({ kind: 'pergola', pergolaId: 'pergola-X' });

      expect(
        topProjectionShapeClassifier(
          makeShape({
            family: 'pergola',
            kind: 'roof_plane',
            sourceObjectId: '',
            sourceId: 'pergola-Y',
          }),
        ),
      ).toEqual({ kind: 'pergola', pergolaId: 'pergola-Y' });
    });

    it('classifies house deck shapes using the source id when available', () => {
      expect(
        topProjectionShapeClassifier(
          makeShape({
            family: 'house',
            kind: 'deck',
            sourceObjectId: 'rendered-deck-1',
            sourceId: 'deck-1',
          }),
        ),
      ).toEqual({ kind: 'workbench', targetKind: 'deck', targetId: 'deck-1' });
    });

    it('classifies opening_marker and opening_outline shapes as workbench openings', () => {
      const target = { kind: 'workbench', targetKind: 'opening', targetId: 'opening-2' } as const;
      expect(
        topProjectionShapeClassifier(
          makeShape({ family: 'house', kind: 'opening_marker', sourceObjectId: 'opening-2' }),
        ),
      ).toEqual(target);
      expect(
        topProjectionShapeClassifier(
          makeShape({ family: 'house', kind: 'opening_outline', sourceObjectId: 'opening-2' }),
        ),
      ).toEqual(target);
    });

    it('classifies footprint, attachment_target, and roof house shapes', () => {
      expect(
        topProjectionShapeClassifier(
          makeShape({ family: 'house', kind: 'footprint', sourceObjectId: 'house-1' }),
        ),
      ).toEqual({ kind: 'workbench', targetKind: 'footprint', targetId: 'house-1' });

      expect(
        topProjectionShapeClassifier(
          makeShape({ family: 'house', kind: 'attachment_target', sourceObjectId: 'zone-1' }),
        ),
      ).toEqual({ kind: 'workbench', targetKind: 'attachment_zone', targetId: 'zone-1' });

      expect(
        topProjectionShapeClassifier(
          makeShape({ family: 'house', kind: 'roof', sourceObjectId: 'roof-1' }),
        ),
      ).toEqual({ kind: 'workbench', targetKind: 'roof', targetId: 'roof-1' });
    });

    it('falls back to a generic house target for unrecognized house kinds', () => {
      expect(
        topProjectionShapeClassifier(
          makeShape({ family: 'house', kind: 'gutter', sourceObjectId: 'house-1' }),
        ),
      ).toEqual({ kind: 'workbench', targetKind: 'house', targetId: 'house-1' });
    });

    it('returns unhandled for shape families outside house and pergola', () => {
      expect(
        topProjectionShapeClassifier(
          makeShape({ family: 'reference', kind: 'roof_outline', id: 'reference-1' }),
        ),
      ).toEqual({ kind: 'unhandled', objectId: 'reference-1' });
    });

    it('does not misclassify a pergola whose source id starts with deck-', () => {
      expect(
        topProjectionShapeClassifier(
          makeShape({
            family: 'pergola',
            kind: 'roof_plane',
            sourceObjectId: 'deck-cover-1',
            metadata: { pergolaId: 'pergola-deck-cover-1' },
          }),
        ),
      ).toEqual({ kind: 'pergola', pergolaId: 'pergola-deck-cover-1' });
    });
  });
});
