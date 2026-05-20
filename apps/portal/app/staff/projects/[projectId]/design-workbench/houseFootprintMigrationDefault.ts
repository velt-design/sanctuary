import type { AttachmentSide } from '@sp/geometry';

/**
 * Migration default for the house's first-class `position` when an edge-drag
 * commit arrives BEFORE the house has been migrated to its first-class form
 * (i.e. `activeModuleInput.houseFootprintPosition` is null). The geometry
 * pipeline decodes the side-local polygon against a 1m × 1m unit frame and
 * adds the house position post-decode -- so the migration default is the
 * offset that would make a unit-frame decode reproduce the legacy real-frame
 * decode for the current pergola dimensions.
 *
 * Math is documented in `docs/design-workbench-architecture.md`
 * §"House first-class entity" stage 3.3. Per attachment side:
 *   - rear / left: house origin == world origin (no shift)
 *   - front:       shift down by (pergolaDepthM - 1) metres
 *   - right:       shift right by (pergolaWidthM - 1) metres
 *
 * Pergola dimensions arrive as the raw `lengthM` / `projectionM` fields off
 * `activeModuleInput` (string | number | undefined depending on source).
 * Non-numeric / missing values fall back to a 6×3 m pergola so a malformed
 * snapshot still produces a reasonable origin instead of NaN-poisoning the
 * persisted position.
 *
 * Pure helper: no React, no store reads. Both the existing edge-drag call
 * site and any future caller (deck-edge-drag migration, calculator import)
 * go through the same boundary so the math cannot drift -- per the "shared
 * logic for shared operations" rule in `docs/maintainability-principles.md`.
 */
export type HouseFootprintMigrationDefaultInput = {
  attachmentSide: AttachmentSide;
  /** Raw `activeModuleInput.lengthM` -- string | number | null | undefined. */
  pergolaWidthM: unknown;
  /** Raw `activeModuleInput.projectionM` -- string | number | null | undefined. */
  pergolaDepthM: unknown;
};

export type HouseFootprintMigrationPosition = {
  positionXMm: number;
  positionYMm: number;
  positionRotationDeg: number;
};

export function resolveHouseFootprintMigrationDefault(
  input: HouseFootprintMigrationDefaultInput,
): HouseFootprintMigrationPosition {
  const pergolaWidthM = Number(input.pergolaWidthM);
  const pergolaDepthM = Number(input.pergolaDepthM);
  const safeWidthM = Number.isFinite(pergolaWidthM) ? pergolaWidthM : 6;
  const safeDepthM = Number.isFinite(pergolaDepthM) ? pergolaDepthM : 3;
  let positionXMm: number;
  let positionYMm: number;
  switch (input.attachmentSide) {
    case 'front':
      positionXMm = 0;
      positionYMm = (safeDepthM - 1) * 1000;
      break;
    case 'right':
      positionXMm = (safeWidthM - 1) * 1000;
      positionYMm = 0;
      break;
    case 'rear':
    case 'left':
    default:
      positionXMm = 0;
      positionYMm = 0;
      break;
  }
  return { positionXMm, positionYMm, positionRotationDeg: 0 };
}
