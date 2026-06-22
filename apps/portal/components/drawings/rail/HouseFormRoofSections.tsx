import type { ReactNode } from 'react';
import {
  getHouseRoofFormBehavior,
  houseRoofFormUsesMinimumVisiblePitch,
  MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG,
  normalizeHouseRoofPitchInputForForm,
} from '@sp/geometry';
import type { HouseFormRoofIntentModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchHouseFormInspectorModel } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import { resolveHouseTerminalEndToggleRoofDraft } from '@/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft';
import type { FieldErrors, RunRoofCommit } from './objectWorkbenchRailTypes';
import {
  ActionButton,
  HOUSE_ROOF_FORM_OPTIONS,
  NumberField,
  ROOF_FALL_DIRECTION_OPTIONS,
  SelectField,
} from './objectRailShared';
import RoofValidationPanel from './RoofValidationPanel';
import styles from './WorkbenchRail.module.css';

type BuildHouseFormRoofSectionsInput = {
  disabled?: boolean;
  fieldErrors: FieldErrors;
  houseFormContext: ObjectWorkbenchHouseFormInspectorModel;
  runRoofCommit: RunRoofCommit;
};

export function buildHouseFormRoofSections({
  disabled,
  fieldErrors,
  houseFormContext,
  runRoofCommit,
}: BuildHouseFormRoofSectionsInput): ReactNode[] {
  const roofContext = houseFormContext.roof;
  const roofDraft = roofContext.intent;
  const terminalEnds = roofContext.terminalEnds;
  const selectedFormSupported = roofContext.selectedFormSupported;
  const canEditSelectedRoofForm = selectedFormSupported;
  const roofControls = roofContext.controls ?? getHouseRoofFormBehavior(roofDraft.form ?? 'mono').controls;
  const pitchHelperText = houseRoofFormUsesMinimumVisiblePitch(roofDraft.form ?? 'mono')
    ? `Minimum is ${MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG} deg for this roof.`
    : 'Shared roof pitch for the main house roof.';
  const fields: ReactNode[] = [];

  fields.push(
    <SelectField
      key="roof-form"
      label="Roof form"
      value={roofDraft.form ?? 'mono'}
      options={HOUSE_ROOF_FORM_OPTIONS}
      disabled={disabled}
      error={fieldErrors['roof-form']}
      onCommit={(value) =>
        runRoofCommit('roof-form', {
          ...roofDraft,
          form: value as HouseFormRoofIntentModel['form'],
        })
      }
    />,
  );

  if (canEditSelectedRoofForm) {
    if (roofControls.pitch) {
      fields.push(
        <NumberField
          key="roof-pitch"
          label="Roof pitch (deg)"
          value={roofDraft.primaryPitchDeg ?? ''}
          disabled={disabled}
          error={fieldErrors['roof-pitch']}
          helperText={pitchHelperText}
          normalizeOnCommit={(value) =>
            normalizeHouseRoofPitchInputForForm({
              roofForm: roofDraft.form ?? 'mono',
              value,
            })
          }
          onCommit={(value) =>
            runRoofCommit('roof-pitch', {
              ...roofDraft,
              primaryPitchDeg: value,
            })
          }
        />,
      );
    }

  }

  if (canEditSelectedRoofForm && roofControls.primaryFallDirection) {
    fields.push(
      <SelectField
        key="roof-fall-direction"
        label="Mono fall direction"
        value={roofDraft.primaryFallDirection ?? 'positive_y'}
        options={ROOF_FALL_DIRECTION_OPTIONS}
        disabled={disabled}
        error={fieldErrors['roof-fall-direction']}
        onCommit={(value) =>
          runRoofCommit('roof-fall-direction', {
            ...roofDraft,
            primaryFallDirection: value as HouseFormRoofIntentModel['primaryFallDirection'],
          })
        }
      />,
    );
  }

  // Milestone 13 session C: only `'hipped'` exposes the open-end
  // toggles. Legacy `'gable'` was retired from `HouseRoofForm` and
  // any stored gable data is mapped to `'hipped'` at the normalize
  // boundary. Opening an end on a hipped roof converts that corner
  // into a gable wall (Dutch hip).
  const showOpenEndControls =
    canEditSelectedRoofForm && roofDraft.form === 'hipped';
  if (showOpenEndControls) {
    if (terminalEnds.length > 0) {
      fields.push(
        <div key="open-end-toggles" className={styles.field}>
          <span className={styles.fieldLabel}>Open hip ends as gables</span>
          <div className={styles.buttonRow}>
            {terminalEnds.map((end) => (
              <ActionButton
                key={end.id}
                label={`${end.isOpen ? 'Close' : 'Open'} ${end.label}`}
                disabled={disabled}
                onClick={() =>
                  // The shared helper ports the geometry-side gable->hipped
                  // migration into explicit workbench state in the SAME
                  // commit. Without it, a click on a `form: 'gable'` house
                  // produces `openGableEndIds: []` which the normalize
                  // migration immediately re-opens on the next solve --
                  // a silent no-op for the user. See decision-log
                  // 2026-05-13 "House Roof Topology -- Gable Form
                  // Migration Must Be Ported on First Toggle".
                  void runRoofCommit(
                    `open-end-${end.id}`,
                    resolveHouseTerminalEndToggleRoofDraft({
                      currentRoof: roofDraft,
                      endId: end.id,
                      currentlyOpen: end.isOpen,
                      allTerminalEndIds: terminalEnds.map((entry) => entry.id),
                    }),
                  )
                }
              />
            ))}
          </div>
          <span className={styles.fieldHint}>
            Open a hip end to convert that corner of the roof into a gable wall. Click again to close.
          </span>
        </div>,
      );
    } else {
      fields.push(
        <p key="open-end-toggles-empty" className={styles.fieldHint}>
          No terminal ends are available for the current footprint.
        </p>,
      );
    }
  }

  if (
    roofContext.validationStatus === 'invalid' ||
    roofContext.validationStatus === 'approximate'
  ) {
    fields.push(
      <RoofValidationPanel
        key="roof-validation"
        roofStatus={roofContext}
        houseForm={houseFormContext.houseForm}
      />,
    );
  }

  return fields;
}
