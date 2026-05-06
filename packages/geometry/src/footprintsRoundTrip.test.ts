import { describe, expect, it } from 'vitest';
import {
  buildCustomHouseFootprintPolygon,
  buildSideLocalPolygonFromWorld,
  houseFootprintSideLocalPointToWorld,
  houseFootprintWorldPointToSideLocal,
  resolveHouseFootprintFrame,
} from './footprints';

describe('houseFootprint world ↔ side-local round-trip', () => {
  const PERGOLA_WIDTH_MM = 6000;
  const PERGOLA_DEPTH_MM = 3000;
  const BAND_DEPTH_M = 1.8;

  const sides = ['rear', 'front', 'left', 'right'] as const;

  for (const side of sides) {
    it(`round-trips a default-band rectangle for attachmentSide='${side}'`, () => {
      const frame = resolveHouseFootprintFrame({
        pergolaWidthMm: PERGOLA_WIDTH_MM,
        pergolaDepthMm: PERGOLA_DEPTH_MM,
        attachmentSide: side,
      });

      const seedSideLocal = [
        { alongM: 0, depthM: 0 },
        { alongM: 0, depthM: BAND_DEPTH_M },
        { alongM: frame.alongWidthM, depthM: BAND_DEPTH_M },
        { alongM: frame.alongWidthM, depthM: 0 },
      ];

      const built = buildCustomHouseFootprintPolygon({
        pergolaWidthMm: PERGOLA_WIDTH_MM,
        pergolaDepthMm: PERGOLA_DEPTH_MM,
        polygon: seedSideLocal.map((p) => ({ alongM: p.alongM.toString(), depthM: p.depthM.toString() })),
        params: null,
        attachmentSide: side,
      });
      expect(built.ok).toBe(true);
      if (!built.ok) return;

      const worldPolygonMm = built.polygon.map((p) => ({ x: p.x, y: p.y }));
      const reEncoded = buildSideLocalPolygonFromWorld({
        worldPolygonMm,
        pergolaWidthMm: PERGOLA_WIDTH_MM,
        pergolaDepthMm: PERGOLA_DEPTH_MM,
        attachmentSide: side,
        params: null,
      });

      const rebuilt = buildCustomHouseFootprintPolygon({
        pergolaWidthMm: PERGOLA_WIDTH_MM,
        pergolaDepthMm: PERGOLA_DEPTH_MM,
        polygon: reEncoded.map((p) => ({ alongM: p.alongM.toString(), depthM: p.depthM.toString() })),
        params: null,
        attachmentSide: side,
      });
      expect(rebuilt.ok).toBe(true);
      if (!rebuilt.ok) return;

      expect(rebuilt.polygon.length).toBe(built.polygon.length);
      for (let idx = 0; idx < built.polygon.length; idx += 1) {
        const original = built.polygon[idx]!;
        const after = rebuilt.polygon[idx]!;
        expect(after.x).toBeCloseTo(original.x, 6);
        expect(after.y).toBeCloseTo(original.y, 6);
      }
    });

    it(`round-trips an along-axis-widened rectangle for attachmentSide='${side}'`, () => {
      const frame = resolveHouseFootprintFrame({
        pergolaWidthMm: PERGOLA_WIDTH_MM,
        pergolaDepthMm: PERGOLA_DEPTH_MM,
        attachmentSide: side,
      });

      const seedSideLocal = [
        { alongM: 0, depthM: 0 },
        { alongM: 0, depthM: BAND_DEPTH_M },
        { alongM: frame.alongWidthM, depthM: BAND_DEPTH_M },
        { alongM: frame.alongWidthM, depthM: 0 },
      ];
      const built = buildCustomHouseFootprintPolygon({
        pergolaWidthMm: PERGOLA_WIDTH_MM,
        pergolaDepthMm: PERGOLA_DEPTH_MM,
        polygon: seedSideLocal.map((p) => ({ alongM: p.alongM.toString(), depthM: p.depthM.toString() })),
        params: null,
        attachmentSide: side,
      });
      expect(built.ok).toBe(true);
      if (!built.ok) return;

      // Identify the edge whose perpendicular is the along-axis (the "left/right wall"
      // of the rectangle in the local frame). We pick the edge whose endpoints both
      // have the same alongM (one of the two "vertical" walls in side-local), then
      // shift those world endpoints by +500mm in the world-axis matching the +along
      // direction at the point.
      const sideLocalIdxAtMaxAlong = seedSideLocal
        .map((p, i) => ({ p, i }))
        .filter((entry) => entry.p.alongM === frame.alongWidthM)
        .map((entry) => entry.i);
      expect(sideLocalIdxAtMaxAlong.length).toBe(2);

      // Compute the world delta direction for "+along" by sampling forward conversion
      const w0 = houseFootprintSideLocalPointToWorld({
        point: { alongM: 0, depthM: 0 },
        frame,
        resolved: {
          widthM: frame.alongWidthM,
          offsetXM: 0,
          setbackM: 0,
          bandDepthM: BAND_DEPTH_M,
          returnRunM: 2.4,
          recessWidthM: 2.4,
          recessDepthM: 1.2,
          leftLegRunM: 2.4,
          rightLegRunM: 2.4,
          sideRunM: 2.4,
        },
      });
      const w1 = houseFootprintSideLocalPointToWorld({
        point: { alongM: 1, depthM: 0 },
        frame,
        resolved: {
          widthM: frame.alongWidthM,
          offsetXM: 0,
          setbackM: 0,
          bandDepthM: BAND_DEPTH_M,
          returnRunM: 2.4,
          recessWidthM: 2.4,
          recessDepthM: 1.2,
          leftLegRunM: 2.4,
          rightLegRunM: 2.4,
          sideRunM: 2.4,
        },
      });
      const alongDir = { x: w1.x - w0.x, y: w1.y - w0.y };
      const alongLen = Math.hypot(alongDir.x, alongDir.y);
      alongDir.x /= alongLen;
      alongDir.y /= alongLen;

      const SHIFT_MM = 500;
      const draggedWorldPolygonMm = built.polygon.map((p, idx) => {
        const isFarAlongVertex = sideLocalIdxAtMaxAlong.includes(idx);
        if (!isFarAlongVertex) return { x: p.x, y: p.y };
        return { x: p.x + alongDir.x * SHIFT_MM, y: p.y + alongDir.y * SHIFT_MM };
      });

      const reEncoded = buildSideLocalPolygonFromWorld({
        worldPolygonMm: draggedWorldPolygonMm,
        pergolaWidthMm: PERGOLA_WIDTH_MM,
        pergolaDepthMm: PERGOLA_DEPTH_MM,
        attachmentSide: side,
        params: null,
      });

      const rebuilt = buildCustomHouseFootprintPolygon({
        pergolaWidthMm: PERGOLA_WIDTH_MM,
        pergolaDepthMm: PERGOLA_DEPTH_MM,
        polygon: reEncoded.map((p) => ({ alongM: p.alongM.toString(), depthM: p.depthM.toString() })),
        params: null,
        attachmentSide: side,
      });
      expect(rebuilt.ok).toBe(true);
      if (!rebuilt.ok) return;

      // The rebuilt polygon should match the dragged world polygon up to point
      // ordering. Validate by sorting vertices into a canonical order.
      const sortByXThenY = (poly: ReadonlyArray<{ x: number; y: number }>): ReadonlyArray<{ x: number; y: number }> =>
        [...poly].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
      const rebuiltSorted = sortByXThenY(rebuilt.polygon);
      const draggedSorted = sortByXThenY(draggedWorldPolygonMm);
      expect(rebuiltSorted.length).toBe(draggedSorted.length);
      for (let idx = 0; idx < rebuiltSorted.length; idx += 1) {
        expect(rebuiltSorted[idx]!.x).toBeCloseTo(draggedSorted[idx]!.x, 6);
        expect(rebuiltSorted[idx]!.y).toBeCloseTo(draggedSorted[idx]!.y, 6);
      }
    });
  }

  it('point-level inverse round-trip for all attachment sides', () => {
    const samples = [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: -1800 },
      { x: -300, y: 1500 },
    ];
    const frames = sides.map((side) => ({
      side,
      frame: resolveHouseFootprintFrame({
        pergolaWidthMm: PERGOLA_WIDTH_MM,
        pergolaDepthMm: PERGOLA_DEPTH_MM,
        attachmentSide: side,
      }),
    }));
    for (const { side, frame } of frames) {
      for (const sample of samples) {
        const sideLocal = houseFootprintWorldPointToSideLocal({
          worldPointMm: sample,
          frame,
          resolved: {
            widthM: frame.alongWidthM,
            offsetXM: 0,
            setbackM: 0,
            bandDepthM: BAND_DEPTH_M,
            returnRunM: 2.4,
            recessWidthM: 2.4,
            recessDepthM: 1.2,
            leftLegRunM: 2.4,
            rightLegRunM: 2.4,
            sideRunM: 2.4,
          },
        });
        const back = houseFootprintSideLocalPointToWorld({
          point: sideLocal,
          frame,
          resolved: {
            widthM: frame.alongWidthM,
            offsetXM: 0,
            setbackM: 0,
            bandDepthM: BAND_DEPTH_M,
            returnRunM: 2.4,
            recessWidthM: 2.4,
            recessDepthM: 1.2,
            leftLegRunM: 2.4,
            rightLegRunM: 2.4,
            sideRunM: 2.4,
          },
        });
        expect(back.x).toBeCloseTo(sample.x, 6);
        expect(back.y).toBeCloseTo(sample.y, 6);
        expect(back.z).toBe(0);
        // suppress unused warnings
        void side;
      }
    }
  });
});
