import { describe, expect, it } from 'vitest';
import { resolveHouseFootprintMigrationDefault } from './houseFootprintMigrationDefault';

describe('resolveHouseFootprintMigrationDefault', () => {
  // Migration default math for the unit-frame house decoder. For `rear` and
  // `left` attachment the house origin coincides with the world origin --
  // those sides are the canonical zero-offset case. For `front` and `right`
  // attachment the origin shifts so the unit-frame decode reproduces the
  // legacy real-frame layout. Verifying each side keeps the migration
  // boundary deterministic so a future regression surfaces here instead of
  // as a silent geometry drift on first edit.

  it('returns zero offset for rear attachment regardless of pergola size', () => {
    expect(
      resolveHouseFootprintMigrationDefault({
        attachmentSide: 'rear',
        pergolaWidthM: 8,
        pergolaDepthM: 4,
      }),
    ).toEqual({ positionXMm: 0, positionYMm: 0, positionRotationDeg: 0 });
  });

  it('returns zero offset for left attachment regardless of pergola size', () => {
    expect(
      resolveHouseFootprintMigrationDefault({
        attachmentSide: 'left',
        pergolaWidthM: 5,
        pergolaDepthM: 7,
      }),
    ).toEqual({ positionXMm: 0, positionYMm: 0, positionRotationDeg: 0 });
  });

  it('shifts Y by (depthM - 1) metres for front attachment', () => {
    expect(
      resolveHouseFootprintMigrationDefault({
        attachmentSide: 'front',
        pergolaWidthM: 6,
        pergolaDepthM: 3,
      }),
    ).toEqual({ positionXMm: 0, positionYMm: 2000, positionRotationDeg: 0 });
  });

  it('shifts X by (widthM - 1) metres for right attachment', () => {
    expect(
      resolveHouseFootprintMigrationDefault({
        attachmentSide: 'right',
        pergolaWidthM: 6,
        pergolaDepthM: 3,
      }),
    ).toEqual({ positionXMm: 5000, positionYMm: 0, positionRotationDeg: 0 });
  });

  it('accepts string-encoded pergola dimensions (the raw shape from CalculatorModuleInputs)', () => {
    expect(
      resolveHouseFootprintMigrationDefault({
        attachmentSide: 'front',
        pergolaWidthM: '6',
        pergolaDepthM: '4',
      }),
    ).toEqual({ positionXMm: 0, positionYMm: 3000, positionRotationDeg: 0 });
  });

  it('falls back to 6m width when pergolaWidthM is NaN/undefined/non-numeric (right attachment)', () => {
    // The fallback fires only for values that `Number()` coerces to NaN.
    // `null` and `''` coerce to 0 (finite) -- handled by the empty-string
    // case below. `undefined` is the realistic miss path (missing field on
    // `activeModuleInput`).
    for (const bad of [undefined, 'not-a-number', NaN] as const) {
      expect(
        resolveHouseFootprintMigrationDefault({
          attachmentSide: 'right',
          pergolaWidthM: bad,
          pergolaDepthM: 3,
        }),
      ).toEqual({ positionXMm: 5000, positionYMm: 0, positionRotationDeg: 0 });
    }
  });

  it('falls back to 3m depth when pergolaDepthM is NaN/undefined/non-numeric (front attachment)', () => {
    for (const bad of [undefined, 'not-a-number', NaN] as const) {
      expect(
        resolveHouseFootprintMigrationDefault({
          attachmentSide: 'front',
          pergolaWidthM: 6,
          pergolaDepthM: bad,
        }),
      ).toEqual({ positionXMm: 0, positionYMm: 2000, positionRotationDeg: 0 });
    }
  });

  it('treats null/empty pergola dimensions as 0 (coerce-to-zero, no fallback)', () => {
    // Preserved behaviour: `Number(null) === 0`, `Number('') === 0`. The
    // original inline implementation relied on `Number.isFinite`, which
    // accepts 0; only values that coerce to NaN trip the 6×3 fallback.
    // Documenting it here so a future "make the fallback also catch null"
    // change is intentional rather than accidental.
    expect(
      resolveHouseFootprintMigrationDefault({
        attachmentSide: 'front',
        pergolaWidthM: null,
        pergolaDepthM: null,
      }),
    ).toEqual({ positionXMm: 0, positionYMm: -1000, positionRotationDeg: 0 });
    expect(
      resolveHouseFootprintMigrationDefault({
        attachmentSide: 'right',
        pergolaWidthM: '',
        pergolaDepthM: '',
      }),
    ).toEqual({ positionXMm: -1000, positionYMm: 0, positionRotationDeg: 0 });
  });

  it('always returns rotationDeg=0 (migration default never rotates)', () => {
    for (const side of ['front', 'right', 'rear', 'left'] as const) {
      expect(
        resolveHouseFootprintMigrationDefault({
          attachmentSide: side,
          pergolaWidthM: 6,
          pergolaDepthM: 3,
        }).positionRotationDeg,
      ).toBe(0);
    }
  });
});
