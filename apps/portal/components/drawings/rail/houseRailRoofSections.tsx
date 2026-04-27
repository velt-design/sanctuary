import type { ReactNode } from 'react';
import type { CalculatorHouseRoofMaterial, CalculatorModuleInputs } from '@/lib/types/calculator';
import type {
  HouseModel,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type { FieldErrors, RunRoofCommit } from './houseRailTypes';
import {
  ATTACHMENT_SIDE_OPTIONS,
  ActionButton,
  NumberField,
  ROOF_FALL_DIRECTION_OPTIONS,
  ROOF_FORM_OPTIONS,
  ROOF_MATERIAL_OPTIONS,
  ROOF_RIDGE_AXIS_OPTIONS,
  SelectField,
  buildRoofDraftFromHouse,
} from './houseRailShared';
import styles from './ConfiguratorRail.module.css';

type BuildHouseRailRoofSectionsInput = {
  disabled?: boolean;
  fieldErrors: FieldErrors;
  house: HouseModel | null;
  runRoofCommit: RunRoofCommit;
};

export function buildHouseRailRoofSections({
  disabled,
  fieldErrors,
  house,
  runRoofCommit,
}: BuildHouseRailRoofSectionsInput): ReactNode[] {
  const roofDraft = buildRoofDraftFromHouse(house);
  const roofCapabilities = house?.roof.capabilities ?? null;
  const appendageHelperText = roofCapabilities?.appendageSupported
    ? 'One lower appendage band is supported in this milestone.'
    : 'Appendage bands are limited to straight or rectangular house footprints in this milestone.';
  const fields: ReactNode[] = [
    <SelectField
      key="roof-form"
      label="Roof form"
      value={roofDraft.form ?? 'mono'}
      options={ROOF_FORM_OPTIONS}
      disabled={disabled}
      error={fieldErrors['roof-form']}
      onCommit={(value) =>
        runRoofCommit('roof-form', {
          ...roofDraft,
          form: value as typeof roofDraft.form,
        })
      }
    />,
    <NumberField
      key="roof-pitch"
      label="Roof pitch (deg)"
      value={roofDraft.primaryPitchDeg ?? ''}
      disabled={disabled}
      error={fieldErrors['roof-pitch']}
      helperText="Shared roof pitch for the main house roof."
      onCommit={(value) =>
        runRoofCommit('roof-pitch', {
          ...roofDraft,
          primaryPitchDeg: value,
        })
      }
    />,
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
  ];

  if (roofCapabilities?.controls.primaryFallDirection ?? (roofDraft.form === 'mono')) {
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
            primaryFallDirection: value as HouseRoofPrimaryFallDirection,
          })
        }
      />,
    );
  }

  if (roofCapabilities?.controls.ridgeAxis ?? (roofDraft.form === 'gable')) {
    fields.push(
      <SelectField
        key="roof-ridge-axis"
        label="Gable ridge orientation"
        value={roofDraft.ridgeAxis ?? 'x'}
        options={ROOF_RIDGE_AXIS_OPTIONS}
        disabled={disabled}
        error={fieldErrors['roof-ridge-axis']}
        onCommit={(value) =>
          runRoofCommit('roof-ridge-axis', {
            ...roofDraft,
            ridgeAxis: value as HouseRoofRidgeAxis,
          })
        }
      />,
    );
  }

  if (roofDraft.form === 'gable' && house?.roof.capabilities.selectedFormSupported) {
    if (house.roof.terminalEnds.length > 0) {
      fields.push(
        <div key="gable-end-frames" className={styles.field}>
          <span className={styles.fieldLabel}>Open gable ends</span>
          <div className={styles.buttonRow}>
            {house.roof.terminalEnds.map((end) => (
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

  if (roofDraft.appendage?.enabled) {
    fields.push(
      <SelectField
        key="appendage-host-edge"
        label="Appendage host edge"
        value={roofDraft.appendage.hostEdge ?? 'rear'}
        options={ATTACHMENT_SIDE_OPTIONS}
        disabled={disabled}
        error={fieldErrors['appendage-host-edge']}
        onCommit={(value) =>
          runRoofCommit('appendage-host-edge', {
            ...roofDraft,
            appendage: {
              ...(roofDraft.appendage ?? {}),
              hostEdge: value as CalculatorModuleInputs['attachmentSide'],
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

  if (house?.roof.validation.status === 'invalid' && house.roof.validation.message) {
    fields.push(
      <p key="roof-invalid" className={styles.fieldError}>
        {house.roof.validation.message}
      </p>,
    );
  }

  return fields;
}
