import type { ReactNode } from 'react';
import type { HouseFormModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { FieldErrors, RunFootprintCommit } from './objectWorkbenchRailTypes';
import styles from './WorkbenchRail.module.css';

type BuildHouseFormFootprintSectionsInput = {
  canEditFootprint?: boolean;
  disabled?: boolean;
  fieldErrors: FieldErrors;
  houseForm: HouseFormModel | null;
  runFootprintCommit: RunFootprintCommit;
};

/**
 * PR-WB-RETIRE-PRESET-DROPDOWN (2026-06-19): rail's footprint
 * section is now near-empty for composition-authored forms. Add
 * structure + plan-view edge drag + Join/Detach are the only
 * authoring affordances; there's no preset selector and no
 * per-preset NumberFields (return run / recess / leg / side run)
 * to dial in. Designers compose shapes visually rather than
 * typing dimension parameters into a dropdown-driven form.
 *
 * Legacy custom_polygon forms still show a read-only badge so
 * designers understand why this rail section is otherwise empty
 * on those forms — they were authored before composition and
 * need to be recreated as rectangles to participate in the
 * composition workflow.
 *
 * The follow-up architectural cleanup (PR-WB-COMPOSITION-ONLY)
 * retires the `footprint` field entirely; until then this section
 * is intentionally minimal.
 */
export function buildHouseFormFootprintSections({
  canEditFootprint: _canEditFootprint,
  disabled: _disabled,
  fieldErrors,
  houseForm,
  runFootprintCommit: _runFootprintCommit,
}: BuildHouseFormFootprintSectionsInput): ReactNode[] {
  const footprintMode = houseForm?.footprint.mode ?? 'preset';
  const fields: ReactNode[] = [];
  if (footprintMode === 'custom_polygon') {
    fields.push(
      <p key="legacy-polygon-badge" className={styles.fieldHint}>
        This house form was authored as a freeform outline before composition. It
        renders read-only; recreate it as a rectangle if you need to change shape.
      </p>,
    );
  }
  if (fieldErrors.outline) {
    fields.push(
      <p key="outline-error" className={styles.fieldError}>
        {fieldErrors.outline}
      </p>,
    );
  }
  return fields;
}
