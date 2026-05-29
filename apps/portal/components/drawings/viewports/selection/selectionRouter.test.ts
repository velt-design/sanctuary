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

    it('classifies project-wide 3D pergola scene object ids by pergola id', () => {
      expect(defaultPrefixClassifier('project_pergola:pergola-2:post-1')).toEqual({
        kind: 'pergola',
        pergolaId: 'pergola-2',
      });
      expect(defaultPrefixClassifier('pergola-2:post-1')).toEqual({
        kind: 'pergola',
        pergolaId: 'pergola-2',
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

    it('PR-Bug1: prefers metadata.houseFormId over the prefixed scene id for house-family shapes', () => {
      // After PR-Geo1's scene-seam id prefixing, house_surface_solid shapes
      // carry ids like `<houseId>:house-wall-1` that don't map to any
      // workbench house form id. The houseFormId metadata tag (set at the
      // workbench-side projection seam) is the source of truth for selection.
      expect(
        topProjectionShapeClassifier(
          makeShape({
            family: 'house',
            kind: 'roof',
            // Simulate a post-Geo1 prefixed scene id on the surface solid.
            id: 'host-house:house-solid-house-roof-main',
            sourceObjectId: 'host-house:house-solid-house-roof-main',
            sourceId: 'house-solid-house-roof-main',
            metadata: { houseFormId: 'house-main' },
          }),
        ),
      ).toEqual({ kind: 'workbench', targetKind: 'roof', targetId: 'house-main' });

      expect(
        topProjectionShapeClassifier(
          makeShape({
            family: 'house',
            kind: 'footprint',
            sourceObjectId: 'house-footprint',
            sourceId: 'house-footprint',
            metadata: { houseFormId: 'house-main' },
          }),
        ),
      ).toEqual({ kind: 'workbench', targetKind: 'footprint', targetId: 'house-main' });

      // Deck classification is unaffected — decks have their own family
      // resolution via metadata.sourceId, not houseFormId.
      expect(
        topProjectionShapeClassifier(
          makeShape({
            family: 'house',
            kind: 'deck',
            sourceObjectId: 'host-house:house-solid-deck-1',
            sourceId: 'house-solid-deck-1',
            metadata: { houseFormId: 'house-main', sourceId: 'deck-1' },
          }),
        ),
      ).toEqual({ kind: 'workbench', targetKind: 'deck', targetId: 'deck-1' });
    });

    it('PR-Bug1: still falls back to sourceObjectId/sourceId/id for house shapes without houseFormId metadata', () => {
      // Reference shapes (built by `buildReferenceShapes` /
      // `buildHouseReferenceProjectionShape`) carry the form id in
      // sourceObjectId directly, no metadata tag. The fallback path stays.
      expect(
        topProjectionShapeClassifier(
          makeShape({
            family: 'house',
            kind: 'footprint',
            id: 'house_reference:house-2',
            sourceObjectId: 'house-2',
            sourceId: 'house-2',
          }),
        ),
      ).toEqual({ kind: 'workbench', targetKind: 'footprint', targetId: 'house-2' });
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

    it('classifies a hip facet roof shape carrying openGableEndId metadata as a toggle action', () => {
      // Milestone 13: enrichHouseRoofShapesWithTerminalEnds tags the
      // existing hip facet (kind: 'roof') with `openGableEndId` and
      // `isOpen` metadata. Clicking it must dispatch the toggle action
      // rather than select the roof. Other roof facets (without the
      // metadata tag) keep their standard roof-selection routing.
      expect(
        topProjectionShapeClassifier(
          makeShape({
            family: 'house',
            kind: 'roof',
            sourceObjectId: 'house-roof-edge-2',
            metadata: { openGableEndId: 'house-gable-end-x-2', isOpen: false },
          }),
        ),
      ).toEqual({
        kind: 'house_terminal_end_toggle',
        endId: 'house-gable-end-x-2',
        isOpen: false,
      });

      expect(
        topProjectionShapeClassifier(
          makeShape({
            family: 'house',
            kind: 'roof',
            sourceObjectId: 'house-roof-edge-4',
            metadata: { openGableEndId: 'house-gable-end-x-4', isOpen: true },
          }),
        ),
      ).toEqual({
        kind: 'house_terminal_end_toggle',
        endId: 'house-gable-end-x-4',
        isOpen: true,
      });
    });

    it('keeps roof facets without openGableEndId metadata on the standard roof selection path', () => {
      // Non-terminal hip facets (and the long along-ridge facets) don't
      // toggle anything -- they should still select the roof as before.
      expect(
        topProjectionShapeClassifier(
          makeShape({
            family: 'house',
            kind: 'roof',
            sourceObjectId: 'house-roof-min-y',
          }),
        ),
      ).toEqual({ kind: 'workbench', targetKind: 'roof', targetId: 'house-roof-min-y' });
    });
  });
});
