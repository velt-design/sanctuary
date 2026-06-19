import { describe, expect, it } from 'vitest';
import { tryConvertResizeToPresetParams } from './tryConvertResizeToPresetParams';

const REAR_PRESET_STRAIGHT = {
  sourceMode: 'preset' as const,
  sourcePreset: 'straight' as const,
  sourceAttachmentSide: 'rear' as const,
  sourceRotationQuarterTurns: 0,
};

describe('tryConvertResizeToPresetParams (PR-WB-RESIZE-KEEPS-PRESET)', () => {
  it('recovers params from the default 6m × 4m rectangle (no resize, just a sanity check)', () => {
    // For attachmentSide 'rear' with offsetXM=0, setbackM=0,
    // widthM=6, bandDepthM=4, the polygon in form-local mm is:
    //   x ∈ [0, 6000], y ∈ [-4000, 0]
    const result = tryConvertResizeToPresetParams({
      ...REAR_PRESET_STRAIGHT,
      formLocalPolygonMm: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: -4000 },
        { x: 0, y: -4000 },
      ],
    });
    expect(result).toEqual({
      widthM: '6',
      bandDepthM: '4',
      offsetXM: '0',
      setbackM: '0',
    });
  });

  it('recovers params after an east-edge drag (widthM 6 -> 8)', () => {
    // East edge dragged 2m east: polygon now x ∈ [0, 8000], y unchanged.
    const result = tryConvertResizeToPresetParams({
      ...REAR_PRESET_STRAIGHT,
      formLocalPolygonMm: [
        { x: 0, y: 0 },
        { x: 8000, y: 0 },
        { x: 8000, y: -4000 },
        { x: 0, y: -4000 },
      ],
    });
    expect(result!.widthM).toBe('8');
    expect(result!.bandDepthM).toBe('4');
    expect(result!.offsetXM).toBe('0');
    expect(result!.setbackM).toBe('0');
  });

  it('recovers params after a south-edge drag (bandDepthM 4 -> 7)', () => {
    // South edge dragged 3m south: y ∈ [-7000, 0].
    const result = tryConvertResizeToPresetParams({
      ...REAR_PRESET_STRAIGHT,
      formLocalPolygonMm: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: -7000 },
        { x: 0, y: -7000 },
      ],
    });
    expect(result!.widthM).toBe('6');
    expect(result!.bandDepthM).toBe('7');
    expect(result!.setbackM).toBe('0');
  });

  it('recovers params after a west-edge drag (offsetXM grows positive)', () => {
    // West edge dragged 2m east: polygon at x ∈ [2000, 6000].
    const result = tryConvertResizeToPresetParams({
      ...REAR_PRESET_STRAIGHT,
      formLocalPolygonMm: [
        { x: 2000, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: -4000 },
        { x: 2000, y: -4000 },
      ],
    });
    expect(result!.widthM).toBe('4');
    expect(result!.offsetXM).toBe('2');
  });

  it('recovers params after a north-edge drag (setbackM grows positive)', () => {
    // North edge dragged 1m south: y ∈ [-4000, -1000], so the top
    // of the rectangle is 1m south of the pergola attachment line.
    const result = tryConvertResizeToPresetParams({
      ...REAR_PRESET_STRAIGHT,
      formLocalPolygonMm: [
        { x: 0, y: -1000 },
        { x: 6000, y: -1000 },
        { x: 6000, y: -4000 },
        { x: 0, y: -4000 },
      ],
    });
    expect(result!.widthM).toBe('6');
    expect(result!.bandDepthM).toBe('3');
    expect(result!.setbackM).toBe('1');
  });

  it('returns null for custom_polygon source (caller falls back to custom_polygon path)', () => {
    const result = tryConvertResizeToPresetParams({
      ...REAR_PRESET_STRAIGHT,
      sourceMode: 'custom_polygon',
      formLocalPolygonMm: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: -4000 },
        { x: 0, y: -4000 },
      ],
    });
    expect(result).toBeNull();
  });

  it('returns null for non-straight presets (L / U / etc. have richer params)', () => {
    const result = tryConvertResizeToPresetParams({
      ...REAR_PRESET_STRAIGHT,
      sourcePreset: 'l_left',
      formLocalPolygonMm: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: -4000 },
        { x: 0, y: -4000 },
      ],
    });
    expect(result).toBeNull();
  });

  it('returns null for non-rear attachment sides (math not verified yet)', () => {
    const result = tryConvertResizeToPresetParams({
      ...REAR_PRESET_STRAIGHT,
      sourceAttachmentSide: 'front',
      formLocalPolygonMm: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: -4000 },
        { x: 0, y: -4000 },
      ],
    });
    expect(result).toBeNull();
  });

  it('returns null for rotated forms (quarter-turn handling deferred)', () => {
    const result = tryConvertResizeToPresetParams({
      ...REAR_PRESET_STRAIGHT,
      sourceRotationQuarterTurns: 1,
      formLocalPolygonMm: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: -4000 },
        { x: 0, y: -4000 },
      ],
    });
    expect(result).toBeNull();
  });

  it('returns null for non-rectangle polygons (designer dragged a corner into a non-axis-aligned shape)', () => {
    const result = tryConvertResizeToPresetParams({
      ...REAR_PRESET_STRAIGHT,
      formLocalPolygonMm: [
        { x: 0, y: 0 },
        { x: 6000, y: 500 },
        { x: 6000, y: -4000 },
        { x: 0, y: -4000 },
      ],
    });
    expect(result).toBeNull();
  });

  it('returns null when the resize would collapse the form to zero area', () => {
    const result = tryConvertResizeToPresetParams({
      ...REAR_PRESET_STRAIGHT,
      formLocalPolygonMm: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: -4000 },
        { x: 0, y: -4000 },
      ],
    });
    expect(result).toBeNull();
  });

  it('tolerates sub-millimetre float noise from drag-commit-encoded polygons', () => {
    // Simulating the kind of float drift the EdgeDragTool produces
    // when world→form-local conversion goes through rotation math.
    const result = tryConvertResizeToPresetParams({
      ...REAR_PRESET_STRAIGHT,
      formLocalPolygonMm: [
        { x: 0.0001, y: -0.0001 },
        { x: 6000.0001, y: 0 },
        { x: 6000, y: -4000.0001 },
        { x: 0, y: -4000 },
      ],
    });
    expect(result).not.toBeNull();
    expect(Number(result!.widthM)).toBeCloseTo(6, 3);
    expect(Number(result!.bandDepthM)).toBeCloseTo(4, 3);
  });
});
