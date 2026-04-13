import { describe, expect, it } from 'vitest';
import { solveAssembly3D } from '@sp/geometry';
import { getGeometryFixtureCase } from '../fixtures';
import { canonicalizeAssembly3D, diffCanonicalAssembly } from './canonical';

function requireSupportedFixture(id: string) {
  const fixture = getGeometryFixtureCase(id);
  if (!fixture || fixture.kind !== 'supported') {
    throw new Error(`Missing supported fixture: ${id}`);
  }
  return fixture;
}

describe('canonicalizeAssembly3D', () => {
  it('is deterministic regardless of assembly member, hook, or house model ordering', () => {
    const fixture = requireSupportedFixture('box_attached_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const reordered = structuredClone(solveResult.value);
    reordered.members.reverse();
    reordered.roofPlanes.reverse();
    reordered.supportConditions.reverse();
    reordered.quantityHooks.reverse();
    reordered.house.model?.wallSegments.reverse();
    reordered.house.model?.roofPlanes.reverse();
    reordered.house.model?.roofFeatures?.reverse();

    expect(canonicalizeAssembly3D(reordered)).toEqual(canonicalizeAssembly3D(solveResult.value));
  });

  it('canonicalizes semantic house model fields while preserving legacy house references', () => {
    const fixture = requireSupportedFixture('mono_attached_fascia_toward_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const actual = structuredClone(solveResult.value);
    if (!actual.house.model?.wallSegments[0] || !actual.house.model.attachmentTarget?.zone) {
      throw new Error('Expected semantic house model and fascia attachment zone.');
    }

    actual.house.model.wallSegments[0].boundary[0]!.x += 0.49;
    actual.house.model.wallSegments[0].plane.normal.x = 0.123456789;
    actual.house.model.eave.soffitDepthMm = 450.4;
    actual.house.model.attachmentTarget.zone.topZMm = 2137.4;

    const canonical = canonicalizeAssembly3D(actual);

    expect(canonical.house.wallPlane).not.toBeNull();
    expect(canonical.house.roofEdgeLine).not.toBeNull();
    expect(canonical.house.model?.footprint).toHaveLength(4);
    expect(canonical.house.model?.wallSegments[0]?.boundary[0]?.x).toBe(0);
    expect(canonical.house.model?.wallSegments[0]?.plane.normal.x).toBe(0.123457);
    expect(canonical.house.model?.eave.soffitDepthMm).toBe(450);
    expect(canonical.house.model?.attachmentTarget?.zone?.topZMm).toBe(2137);
    expect(canonical.house.attachmentTarget?.kind).toBe('zone');
  });
});

describe('diffCanonicalAssembly', () => {
  it('identifies the exact member endpoint path when a member moves', () => {
    const fixture = requireSupportedFixture('box_attached_standard');
    const actual = structuredClone(fixture.expectedAssembly);
    const member = actual.members.find((entry) => entry.id === 'outer-gutter');
    if (!member) {
      throw new Error('Expected outer-gutter in canonical box fixture.');
    }
    member.centerline.start.z += 7;

    const diffs = diffCanonicalAssembly(actual, fixture.expectedAssembly);

    expect(diffs).toContainEqual(
      expect.objectContaining({
        path: 'members.outer-gutter.centerline.start.z',
      }),
    );
  });

  it('identifies the exact roof-plane boundary path when a roof point moves', () => {
    const fixture = requireSupportedFixture('box_attached_standard');
    const actual = structuredClone(fixture.expectedAssembly);
    const roofPlane = actual.roofPlanes.find((entry) => entry.id === 'box-roof');
    if (!roofPlane) {
      throw new Error('Expected box-roof in canonical box fixture.');
    }
    roofPlane.boundary[2]!.y += 5;

    const diffs = diffCanonicalAssembly(actual, fixture.expectedAssembly);

    expect(diffs).toContainEqual(
      expect.objectContaining({
        path: 'roofPlanes.box-roof.boundary[2].y',
      }),
    );
  });

  it('identifies the exact quantity hook path when a quantity changes', () => {
    const fixture = requireSupportedFixture('box_attached_standard');
    const actual = structuredClone(fixture.expectedAssembly);
    const hook = actual.quantityHooks.find((entry) => entry.key === 'box_perimeter_beams.total_length_mm');
    if (!hook) {
      throw new Error('Expected box_perimeter_beams.total_length_mm quantity hook.');
    }
    hook.quantity += 11;

    const diffs = diffCanonicalAssembly(actual, fixture.expectedAssembly);

    expect(diffs).toContainEqual(
      expect.objectContaining({
        path: 'quantityHooks.box_perimeter_beams.total_length_mm.quantity',
      }),
    );
  });

  it('identifies the exact house wall segment path when semantic house geometry moves', () => {
    const fixture = requireSupportedFixture('box_attached_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }
    const expected = canonicalizeAssembly3D(solveResult.value);
    const actual = structuredClone(expected);
    const wallSegment = actual.house.model?.wallSegments.find((entry) => entry.id === 'house-wall-1');
    if (!wallSegment) {
      throw new Error('Expected house-wall-1 in canonical box fixture.');
    }
    wallSegment.boundary[2]!.z += 9;

    const diffs = diffCanonicalAssembly(actual, expected);

    expect(diffs).toContainEqual(
      expect.objectContaining({
        path: 'house.model.wallSegments.house-wall-1.boundary[2].z',
      }),
    );
  });

  it('identifies the exact house attachment target path when a fascia safe line moves', () => {
    const fixture = requireSupportedFixture('mono_attached_fascia_toward_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }
    const expected = canonicalizeAssembly3D(solveResult.value);
    const actual = structuredClone(expected);
    if (!actual.house.attachmentTarget?.zone?.safeLine) {
      throw new Error('Expected fascia attachment target safe line in canonical mono fixture.');
    }
    actual.house.attachmentTarget.zone.safeLine.start.z += 13;

    const diffs = diffCanonicalAssembly(actual, expected);

    expect(diffs).toContainEqual(
      expect.objectContaining({
        path: 'house.attachmentTarget.zone.safeLine.start.z',
      }),
    );
  });
});
