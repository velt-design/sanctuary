import type { ReactNode } from 'react';
import {
  getHouseRoofFormBehavior,
  houseRoofFormUsesMinimumVisiblePitch,
  MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG,
  normalizeHouseRoofPitchInputForForm,
} from '@sp/geometry';
import type { CalculatorHouseRoofMaterial, CalculatorModuleInputs } from '@/lib/types/calculator';
import type { HouseFormRoofIntentModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchHouseFormInspectorModel } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type { FieldErrors, RunRoofCommit } from './objectWorkbenchRailTypes';
import {
  ATTACHMENT_SIDE_OPTIONS,
  ActionButton,
  HOUSE_ROOF_FORM_OPTIONS,
  NumberField,
  ROOF_FALL_DIRECTION_OPTIONS,
  ROOF_MATERIAL_OPTIONS,
  ROOF_RIDGE_AXIS_OPTIONS,
  SelectField,
  SummarySection,
  labelForRoofApproximationReason,
  labelForAttachmentSideList,
  labelForRoofFieldSource,
  labelForRoofGeometryKind,
} from './objectRailShared';
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
  const roofProvenance = roofContext.provenance;
  const approximationReasons = roofContext.approximationReasons;
  const appendageSupportedHostEdges = roofContext.appendageSupportedHostEdges;
  const terminalEnds = roofContext.terminalEnds;
  const selectedFormSupported = roofContext.selectedFormSupported;
  const canEditSelectedRoofForm = selectedFormSupported;
  const roofControls = roofContext.controls ?? getHouseRoofFormBehavior(roofDraft.form ?? 'mono').controls;
  const pitchHelperText = houseRoofFormUsesMinimumVisiblePitch(roofDraft.form ?? 'mono')
    ? `Minimum is ${MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG} deg for this roof.`
    : 'Shared roof pitch for the main house roof.';
  const canShowAppendageControls = canEditSelectedRoofForm && roofControls.appendage;
  const appendageHelperText =
    roofContext.validationCode === 'invalid_appendage_topology' ||
    roofContext.validationCode === 'invalid_appendage_host_edge'
      ? 'The current appendage remains editable so you can disable it or adjust it after the footprint changes.'
      : roofContext.appendageSupported
        ? `Supported host edges: ${labelForAttachmentSideList(appendageSupportedHostEdges)}.`
        : 'Appendage bands require at least one continuous exterior perimeter run on the current footprint.';
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

    if (roofControls.material) {
      fields.push(
        <SelectField
          key="roof-material"
          label="Roof material"
          value={roofDraft.material ?? 'corrugated_iron'}
          options={ROOF_MATERIAL_OPTIONS}
          disabled={disabled}
          error={fieldErrors['roof-material']}
          onCommit={(value) =>
            runRoofCommit('roof-material', {
              ...roofDraft,
              material: value as CalculatorHouseRoofMaterial,
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

  if (canEditSelectedRoofForm && roofControls.ridgeAxis) {
    fields.push(
      <SelectField
        key="roof-ridge-axis"
        label={roofDraft.form === 'hipped' ? 'Hipped ridge orientation' : 'Gable ridge orientation'}
        value={roofDraft.ridgeAxis ?? 'x'}
        options={ROOF_RIDGE_AXIS_OPTIONS}
        disabled={disabled}
        error={fieldErrors['roof-ridge-axis']}
        onCommit={(value) =>
          runRoofCommit('roof-ridge-axis', {
            ...roofDraft,
            ridgeAxis: value as HouseFormRoofIntentModel['ridgeAxis'],
          })
        }
      />,
    );
  }

  if (roofDraft.form === 'gable' && canEditSelectedRoofForm) {
    if (terminalEnds.length > 0) {
      fields.push(
        <div key="gable-end-frames" className={styles.field}>
          <span className={styles.fieldLabel}>Open gable ends</span>
          <div className={styles.buttonRow}>
            {terminalEnds.map((end) => (
              <ActionButton
                key={end.id}
                label={`${end.isOpen ? 'Close' : 'Open'} ${end.label}`}
                disabled={disabled}
                onClick={() =>
                  void runRoofCommit(`gable-end-${end.id}`, {
                    ...roofDraft,
                    openGableEndIds: end.isOpen
                      ? (roofDraft.openGableEndIds ?? []).filter((candidate) => candidate !== end.id)
                      : [...new Set([...(roofDraft.openGableEndIds ?? []), end.id])],
                  })
                }
              />
            ))}
          </div>
          <span className={styles.fieldHint}>
            Select which terminal gable faces render as open end frames.
          </span>
        </div>,
      );
    } else {
      fields.push(
        <p key="gable-end-frames-empty" className={styles.fieldHint}>
          No terminal gable ends are available for the current footprint.
        </p>,
      );
    }
  }

  if (canShowAppendageControls) {
    fields.push(
      <SelectField
        key="appendage-enabled"
        label="Appendage band"
        value={roofDraft.appendage?.enabled ? 'enabled' : 'disabled'}
        options={[
          { label: 'Off', value: 'disabled' },
          { label: 'On', value: 'enabled' },
        ]}
        disabled={disabled}
        error={fieldErrors['appendage-enabled']}
        helperText={appendageHelperText}
        onCommit={(value) =>
          runRoofCommit('appendage-enabled', {
            ...roofDraft,
            appendage: {
              ...(roofDraft.appendage ?? {}),
              enabled: value === 'enabled',
            },
          })
        }
      />,
    );
  } else if (canEditSelectedRoofForm && roofControls.appendage && !roofContext.appendageSupported) {
    fields.push(
      <p key="appendage-disabled-hint" className={styles.fieldHint}>
        {appendageHelperText}
      </p>,
    );
  }

  if (roofDraft.appendage?.enabled && canShowAppendageControls) {
    fields.push(
      <SelectField
        key="appendage-host-edge"
        label="Appendage host edge"
        value={roofDraft.appendage.hostEdge ?? 'rear'}
        options={ATTACHMENT_SIDE_OPTIONS}
        disabled={disabled}
        error={fieldErrors['appendage-host-edge']}
        helperText={
          roofContext.validationCode === 'invalid_appendage_host_edge'
            ? roofContext.appendageSupportReason ?? `Supported edges: ${labelForAttachmentSideList(appendageSupportedHostEdges)}.`
            : `Supported edges: ${labelForAttachmentSideList(appendageSupportedHostEdges)}.`
        }
        onCommit={(value) =>
          runRoofCommit('appendage-host-edge', {
            ...roofDraft,
            appendage: {
              ...(roofDraft.appendage ?? {}),
              hostEdge: value as NonNullable<CalculatorModuleInputs['attachmentSide']>,
            },
          })
        }
      />,
      <NumberField
        key="appendage-pitch"
        label="Appendage pitch (deg)"
        value={roofDraft.appendage.pitchDeg ?? ''}
        disabled={disabled}
        error={fieldErrors['appendage-pitch']}
        onCommit={(value) =>
          runRoofCommit('appendage-pitch', {
            ...roofDraft,
            appendage: {
              ...(roofDraft.appendage ?? {}),
              pitchDeg: value,
              form: Number(value) === 0 ? 'flat' : 'mono',
            },
          })
        }
      />,
      <NumberField
        key="appendage-drop"
        label="Appendage drop (mm)"
        value={roofDraft.appendage.dropMm ?? '450'}
        disabled={disabled}
        error={fieldErrors['appendage-drop']}
        onCommit={(value) =>
          runRoofCommit('appendage-drop', {
            ...roofDraft,
            appendage: {
              ...(roofDraft.appendage ?? {}),
              dropMm: value,
            },
          })
        }
      />,
    );
  }

  const ridgeBasisLabel =
    approximationReasons.includes('ambiguous_ridge_axis')
      ? `${labelForRoofFieldSource(roofProvenance?.ridgeAxis)}; near-square rectangular footprint keeps the current axis`
      : labelForRoofFieldSource(roofProvenance?.ridgeAxis);
  const appendageSupportLabel =
    !roofControls.appendage
      ? 'Not used for this roof'
      : roofContext.validationCode === 'invalid_appendage_topology' ||
          roofContext.validationCode === 'invalid_appendage_host_edge'
        ? roofContext.appendageSupportReason ?? 'Blocked on the current footprint'
        : roofContext.appendageSupported
          ? 'Supported on the current footprint'
          : 'Not supported on the current footprint';
  const appendageSupportedEdgesLabel = roofControls.appendage
    ? labelForAttachmentSideList(appendageSupportedHostEdges)
    : 'Not used for this roof';

  fields.push(
    <SummarySection
      key="roof-review-basis"
      title="Review Basis"
      items={[
        { label: 'Roof geometry', value: labelForRoofGeometryKind(roofContext.geometryKind) },
        { label: 'Roof form basis', value: labelForRoofFieldSource(roofProvenance?.form) },
        {
          label: 'Mono fall basis',
          value:
            roofControls.primaryFallDirection
              ? labelForRoofFieldSource(roofProvenance?.primaryFallDirection)
              : 'Not used for this roof',
        },
        {
          label: 'Ridge basis',
          value: roofControls.ridgeAxis ? ridgeBasisLabel : 'Not used for this roof',
        },
        { label: 'Appendage support', value: appendageSupportLabel },
        { label: 'Appendage supported edges', value: appendageSupportedEdgesLabel },
      ]}
      hint={
        approximationReasons.length > 0
          ? approximationReasons.map((reason) => labelForRoofApproximationReason(reason)).join(' | ')
          : 'These review signals explain whether the current roof is explicit, inherited, or best-guess.'
      }
    />,
  );

  if (roofContext.validationStatus === 'invalid' && roofContext.validationMessage) {
    fields.push(
      <p key="roof-invalid" className={styles.fieldError}>
        {roofContext.validationMessage}
      </p>,
    );
  }

  return fields;
}
