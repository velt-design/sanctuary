import { describe, expect, it } from 'vitest';
import { buildRectangleHippedRoof } from './roofRectangleHipped';
import { buildRectangularRoof, type BuildRectangularRoofInput } from './roofRectangle';

/**
 * Phase A of milestone 13. The unified builder MUST produce byte-equivalent
 * output to the legacy `buildRectangleHippedRoof` for the (hipped, hipped)
 * cap pair, and structurally-equivalent output to `buildRectangularGableRoof`
 * for the (open_gable, open_gable) pair (we don't import the gable builder
 * directly in this test because it lives in roofPrimary.ts which depends
 * on more layers; the gable equivalence is verified at the
 * `buildPrimaryHouseRoof` call-site instead, alongside the wrapper
 * refactor).
 *
 * For Dutch-hip combinations (mixed caps), structural checks confirm the
 * topology is consistent: the main slopes always render, the hip plane
 * appears only on the closed-end side, and the ridge endpoint extends to
 * the eave on the open-end side.
 */

const BASE: Omit<BuildRectangularRoofInput, 'startCap' | 'endCap' | 'ridgeAxis'> = {
  minX: 0,
  maxX: 8000,
  minY: 0,
  maxY: 4000,
  eaveHeightMm: 2400,
  roofPitchDeg: 25,
};

describe('buildRectangularRoof', () => {
  describe('byte-equivalence with legacy buildRectangleHippedRoof', () => {
    it('matches plane and feature structure for both ends hipped (X-axis ridge)', () => {
      const legacy = buildRectangleHippedRoof({
        minX: BASE.minX,
        maxX: BASE.maxX,
        minY: BASE.minY,
        maxY: BASE.maxY,
        eaveHeightMm: BASE.eaveHeightMm,
        roofPitchDeg: BASE.roofPitchDeg,
      });
      const unified = buildRectangularRoof({
        ...BASE,
        ridgeAxis: 'x',
        startCap: 'hipped',
        endCap: 'hipped',
      });

      expect(unified.roofPlanes).toHaveLength(legacy.roofPlanes.length);
      const legacyPlaneIds = legacy.roofPlanes.map((p) => p.id).sort();
      const unifiedPlaneIds = unified.roofPlanes.map((p) => p.id).sort();
      expect(unifiedPlaneIds).toEqual(legacyPlaneIds);

      // Boundary equivalence: each plane in the unified output must match
      // its legacy counterpart by id.
      for (const legacyPlane of legacy.roofPlanes) {
        const unifiedPlane = unified.roofPlanes.find((p) => p.id === legacyPlane.id);
        expect(unifiedPlane, `plane ${legacyPlane.id}`).toBeDefined();
        if (!unifiedPlane) continue;
        expect(unifiedPlane.boundary).toEqual(legacyPlane.boundary);
      }

      // Feature equivalence: same number of ridge + hip features.
      expect(unified.roofFeatures).toHaveLength(legacy.roofFeatures.length);
      const legacyFeatureIds = legacy.roofFeatures.map((f) => f.id).sort();
      const unifiedFeatureIds = unified.roofFeatures.map((f) => f.id).sort();
      expect(unifiedFeatureIds).toEqual(legacyFeatureIds);
    });

    it('matches plane and feature structure for both ends hipped (Y-axis ridge -- footprint taller than wide)', () => {
      const legacy = buildRectangleHippedRoof({
        minX: 0,
        maxX: 4000,
        minY: 0,
        maxY: 8000,
        eaveHeightMm: BASE.eaveHeightMm,
        roofPitchDeg: BASE.roofPitchDeg,
      });
      const unified = buildRectangularRoof({
        minX: 0,
        maxX: 4000,
        minY: 0,
        maxY: 8000,
        eaveHeightMm: BASE.eaveHeightMm,
        roofPitchDeg: BASE.roofPitchDeg,
        ridgeAxis: 'y',
        startCap: 'hipped',
        endCap: 'hipped',
      });

      expect(unified.roofPlanes).toHaveLength(legacy.roofPlanes.length);
      expect(unified.roofPlanes.map((p) => p.id).sort()).toEqual(
        legacy.roofPlanes.map((p) => p.id).sort(),
      );
      for (const legacyPlane of legacy.roofPlanes) {
        const unifiedPlane = unified.roofPlanes.find((p) => p.id === legacyPlane.id);
        expect(unifiedPlane?.boundary).toEqual(legacyPlane.boundary);
      }
    });

    it('matches the pyramid collapse case for a square footprint (both caps hipped)', () => {
      const square = { minX: 0, maxX: 4000, minY: 0, maxY: 4000, eaveHeightMm: 2400, roofPitchDeg: 25 };
      const legacy = buildRectangleHippedRoof(square);
      // For a square, ridge collapses regardless of axis input.
      const unified = buildRectangularRoof({ ...square, ridgeAxis: 'x', startCap: 'hipped', endCap: 'hipped' });
      expect(unified.roofPlanes).toHaveLength(4);
      expect(legacy.roofPlanes).toHaveLength(4);
      // Plane id sets match.
      expect(unified.roofPlanes.map((p) => p.id).sort()).toEqual(
        legacy.roofPlanes.map((p) => p.id).sort(),
      );
      // Each plane's boundary matches the legacy version's by id.
      for (const legacyPlane of legacy.roofPlanes) {
        const unifiedPlane = unified.roofPlanes.find((p) => p.id === legacyPlane.id);
        expect(unifiedPlane?.boundary).toEqual(legacyPlane.boundary);
      }
    });
  });

  describe('open_gable + open_gable (legacy gable rectangle)', () => {
    it('emits 2 main slopes + 1 ridge feature, no hip planes/features (X-axis ridge)', () => {
      const result = buildRectangularRoof({
        ...BASE,
        ridgeAxis: 'x',
        startCap: 'open_gable',
        endCap: 'open_gable',
      });
      expect(result.roofPlanes.map((p) => p.id).sort()).toEqual([
        'house-roof-max-y',
        'house-roof-min-y',
      ]);
      // Ridge spans full eave-to-eave.
      const ridge = result.roofFeatures.find((f) => f.kind === 'ridge');
      expect(ridge?.line.start.x).toBe(BASE.minX);
      expect(ridge?.line.end.x).toBe(BASE.maxX);
      // No hip features.
      expect(result.roofFeatures.filter((f) => f.kind === 'hip')).toHaveLength(0);
    });

    it('emits 2 main slopes + 1 ridge feature, no hip planes/features (Y-axis ridge)', () => {
      const result = buildRectangularRoof({
        minX: 0,
        maxX: 4000,
        minY: 0,
        maxY: 8000,
        eaveHeightMm: BASE.eaveHeightMm,
        roofPitchDeg: BASE.roofPitchDeg,
        ridgeAxis: 'y',
        startCap: 'open_gable',
        endCap: 'open_gable',
      });
      expect(result.roofPlanes.map((p) => p.id).sort()).toEqual([
        'house-roof-max-x',
        'house-roof-min-x',
      ]);
      const ridge = result.roofFeatures.find((f) => f.kind === 'ridge');
      expect(ridge?.line.start.y).toBe(0);
      expect(ridge?.line.end.y).toBe(8000);
      expect(result.roofFeatures.filter((f) => f.kind === 'hip')).toHaveLength(0);
    });
  });

  describe('Dutch-hip combinations (mixed caps)', () => {
    it('start open + end hipped: 3 planes, ridge starts at eave, hip plane only on max-x end (X-axis)', () => {
      const result = buildRectangularRoof({
        ...BASE,
        ridgeAxis: 'x',
        startCap: 'open_gable',
        endCap: 'hipped',
      });
      const planeIds = result.roofPlanes.map((p) => p.id).sort();
      // 2 main slopes + 1 hip plane on the max-x (closed) end.
      expect(planeIds).toEqual(['house-roof-max-x', 'house-roof-max-y', 'house-roof-min-y']);
      // No min-x plane (that end is open).
      expect(planeIds).not.toContain('house-roof-min-x');

      const ridge = result.roofFeatures.find((f) => f.kind === 'ridge');
      // Open start -> ridge starts at eave x.
      expect(ridge?.line.start.x).toBe(BASE.minX);
      // Hipped end -> ridge ends inset by halfShort.
      const halfShort = (BASE.maxY - BASE.minY) / 2;
      expect(ridge?.line.end.x).toBe(BASE.maxX - halfShort);

      // Hip features only at the hipped (max-x) corners.
      const hips = result.roofFeatures.filter((f) => f.kind === 'hip');
      expect(hips).toHaveLength(2);
      // All hips emanate from the corners on the max-x (closed) side.
      hips.forEach((hip) => {
        expect(hip.line.start.x).toBe(BASE.maxX);
      });
    });

    it('start hipped + end open: 3 planes, ridge ends at eave, hip plane only on min-x end (X-axis)', () => {
      const result = buildRectangularRoof({
        ...BASE,
        ridgeAxis: 'x',
        startCap: 'hipped',
        endCap: 'open_gable',
      });
      const planeIds = result.roofPlanes.map((p) => p.id).sort();
      expect(planeIds).toEqual(['house-roof-max-y', 'house-roof-min-x', 'house-roof-min-y']);
      expect(planeIds).not.toContain('house-roof-max-x');

      const ridge = result.roofFeatures.find((f) => f.kind === 'ridge');
      const halfShort = (BASE.maxY - BASE.minY) / 2;
      expect(ridge?.line.start.x).toBe(BASE.minX + halfShort);
      expect(ridge?.line.end.x).toBe(BASE.maxX);

      const hips = result.roofFeatures.filter((f) => f.kind === 'hip');
      expect(hips).toHaveLength(2);
      hips.forEach((hip) => {
        expect(hip.line.start.x).toBe(BASE.minX);
      });
    });

    it('start hipped + end open: 3 planes, ridge ends at eave (Y-axis ridge)', () => {
      const result = buildRectangularRoof({
        minX: 0,
        maxX: 4000,
        minY: 0,
        maxY: 8000,
        eaveHeightMm: BASE.eaveHeightMm,
        roofPitchDeg: BASE.roofPitchDeg,
        ridgeAxis: 'y',
        startCap: 'hipped',
        endCap: 'open_gable',
      });
      const planeIds = result.roofPlanes.map((p) => p.id).sort();
      expect(planeIds).toEqual(['house-roof-max-x', 'house-roof-min-x', 'house-roof-min-y']);
      expect(planeIds).not.toContain('house-roof-max-y');

      const ridge = result.roofFeatures.find((f) => f.kind === 'ridge');
      expect(ridge?.line.start.y).toBe(0 + 4000 / 2); // halfShort = widthX/2
      expect(ridge?.line.end.y).toBe(8000);
    });
  });

  describe('ridge metadata reflects the derived form', () => {
    it("(hipped, hipped) -> roofForm: 'hipped'", () => {
      const result = buildRectangularRoof({ ...BASE, ridgeAxis: 'x', startCap: 'hipped', endCap: 'hipped' });
      const ridge = result.roofFeatures.find((f) => f.kind === 'ridge');
      expect(ridge?.metadata?.roofForm).toBe('hipped');
    });
    it("(open_gable, open_gable) -> roofForm: 'gable'", () => {
      const result = buildRectangularRoof({ ...BASE, ridgeAxis: 'x', startCap: 'open_gable', endCap: 'open_gable' });
      const ridge = result.roofFeatures.find((f) => f.kind === 'ridge');
      expect(ridge?.metadata?.roofForm).toBe('gable');
    });
    it("mixed -> roofForm: 'dutch_hip'", () => {
      const result = buildRectangularRoof({ ...BASE, ridgeAxis: 'x', startCap: 'open_gable', endCap: 'hipped' });
      const ridge = result.roofFeatures.find((f) => f.kind === 'ridge');
      expect(ridge?.metadata?.roofForm).toBe('dutch_hip');
    });
  });
});
