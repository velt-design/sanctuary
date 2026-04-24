import { describe, expect, it } from 'vitest';
import { validateDrawOutlinePoints } from './drawOutlineToolValidation';

describe('drawOutlineToolValidation', () => {
  it('returns a structured issue when there are too few points', () => {
    expect(validateDrawOutlinePoints([{ alongM: 0, depthM: 0 }])).toEqual({
      ok: false,
      issue: {
        code: 'too-few-points',
        message: 'Add at least 3 points before closing the outline.',
        pointCount: 1,
        minPointCount: 3,
      },
    });
  });

  it('returns the point index for non-finite points', () => {
    expect(
      validateDrawOutlinePoints([
        { alongM: 0, depthM: 0 },
        { alongM: Number.NaN, depthM: 1 },
        { alongM: 1, depthM: 0 },
      ]),
    ).toEqual({
      ok: false,
      issue: {
        code: 'non-finite-point',
        message: 'House footprint outline points need finite along/depth values.',
        pointIndex: 1,
      },
    });
  });

  it('returns the segment index for duplicate adjacent points', () => {
    expect(
      validateDrawOutlinePoints([
        { alongM: 0, depthM: 0 },
        { alongM: 0, depthM: 0 },
        { alongM: 1, depthM: 1 },
      ]),
    ).toEqual({
      ok: false,
      issue: {
        code: 'duplicate-adjacent-point',
        message: 'House footprint outline cannot include duplicate consecutive points.',
        segmentIndex: 0,
      },
    });
  });

  it('returns the closing segment index for duplicate closing points', () => {
    expect(
      validateDrawOutlinePoints([
        { alongM: 0, depthM: 0 },
        { alongM: 1, depthM: 0 },
        { alongM: 0, depthM: 0 },
      ]),
    ).toEqual({
      ok: false,
      issue: {
        code: 'duplicate-adjacent-point',
        message: 'House footprint outline cannot include duplicate consecutive points.',
        segmentIndex: 2,
      },
    });
  });

  it('returns zero-area for collinear polygons', () => {
    expect(
      validateDrawOutlinePoints([
        { alongM: 0, depthM: 0 },
        { alongM: 1, depthM: 0 },
        { alongM: 2, depthM: 0 },
      ]),
    ).toEqual({
      ok: false,
      issue: {
        code: 'zero-area',
        message: 'House footprint outline needs a non-zero area.',
      },
    });
  });

  it('returns both segment indexes for self-intersecting polygons', () => {
    expect(
      validateDrawOutlinePoints([
        { alongM: 0, depthM: 0 },
        { alongM: 2, depthM: 2 },
        { alongM: 0, depthM: 2 },
        { alongM: 2, depthM: 0 },
      ]),
    ).toEqual({
      ok: false,
      issue: {
        code: 'self-intersection',
        message: 'House footprint outline cannot self-intersect.',
        segmentIndexes: [0, 2],
      },
    });
  });

  it('passes valid triangle and rectangle polygons', () => {
    expect(
      validateDrawOutlinePoints([
        { alongM: 0, depthM: 0 },
        { alongM: 3, depthM: 0 },
        { alongM: 3, depthM: 2 },
      ]),
    ).toEqual({ ok: true });
    expect(
      validateDrawOutlinePoints([
        { alongM: 0, depthM: 0 },
        { alongM: 3, depthM: 0 },
        { alongM: 3, depthM: 2 },
        { alongM: 0, depthM: 2 },
      ]),
    ).toEqual({ ok: true });
  });
});
