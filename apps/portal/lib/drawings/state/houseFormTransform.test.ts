import { describe, expect, it } from 'vitest';
import {
  houseFormTransformToAssemblyPosition,
  houseFormTransformToWorldPositionMm,
} from './houseFormTransform';

describe('houseFormTransformToAssemblyPosition', () => {
  it('maps the primary-form origin transform to the geometry zero position', () => {
    // Primary form sits at world origin (offsetXM=0, offsetYM=0, no rotation),
    // which is what `buildSharedHouse` writes in PR7. PR8b feeds this through
    // `buildHouseReferenceGeometry`; the resulting AssemblyPosition must be a
    // zero placement so the existing single-house geometry stays byte-identical.
    expect(
      houseFormTransformToAssemblyPosition({
        offsetXM: 0,
        offsetYM: 0,
        rotationQuarterTurns: 0,
      }),
    ).toEqual({ origin: { x: 0, y: 0 }, rotationDeg: 0 });
  });

  it('converts metres to millimetres on both axes (matches the geometry mm-everywhere contract)', () => {
    // 10m east is the default offset `addHouseFormToObjectFirstDraft` applies
    // to cloned forms so they don't sit on top of the source in plan view.
    // PR8b should place an additional form 10000mm east, not 10mm.
    expect(
      houseFormTransformToAssemblyPosition({
        offsetXM: 10,
        offsetYM: -4.5,
        rotationQuarterTurns: 0,
      }),
    ).toEqual({ origin: { x: 10000, y: -4500 }, rotationDeg: 0 });
  });

  it('expands each quarter turn into 90 degrees of +Z rotation', () => {
    // All four quarter turns map to canonical angles -- never wraps, never
    // negates. AssemblyPosition is fully general degrees but PR8 only ever
    // feeds these discrete values.
    expect(houseFormTransformToAssemblyPosition({ offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 1 }).rotationDeg).toBe(90);
    expect(houseFormTransformToAssemblyPosition({ offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 2 }).rotationDeg).toBe(180);
    expect(houseFormTransformToAssemblyPosition({ offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 3 }).rotationDeg).toBe(270);
  });

  it('combines offset and rotation in a single call (no order-of-operations surprises)', () => {
    // Rotation and translation are independent -- AssemblyPosition consumers
    // apply rotation around the form's own origin, then translate the result.
    // Verifying both fields land at once locks in the contract for PR8b.
    expect(
      houseFormTransformToAssemblyPosition({
        offsetXM: 2.5,
        offsetYM: -7.5,
        rotationQuarterTurns: 3,
      }),
    ).toEqual({ origin: { x: 2500, y: -7500 }, rotationDeg: 270 });
  });

  it('exposes a deck-patch friendly world-position view in millimetres', () => {
    expect(
      houseFormTransformToWorldPositionMm({
        offsetXM: 1.25,
        offsetYM: -0.5,
        rotationQuarterTurns: 2,
      }),
    ).toEqual({ x: 1250, y: -500, rotationDeg: 180 });
  });
});
