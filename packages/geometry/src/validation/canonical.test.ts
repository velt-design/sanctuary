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
  it('is deterministic regardless of assembly member or hook ordering', () => {
    const fixture = requireSupportedFixture('gable_freestanding_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const reordered = structuredClone(solveResult.value);
    reordered.members.reverse();
    reordered.roofPlanes.reverse();
    reordered.supportConditions.reverse();
    reordered.quantityHooks.reverse();

    expect(canonicalizeAssembly3D(reordered)).toEqual(canonicalizeAssembly3D(solveResult.value));
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
});
