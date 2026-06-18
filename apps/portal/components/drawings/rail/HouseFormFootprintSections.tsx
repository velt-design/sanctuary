import type { ReactNode } from 'react';
import type { HouseFormFootprintModel, HouseFormModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { FieldErrors, RunFootprintCommit } from './objectWorkbenchRailTypes';
import {
  FOOTPRINT_OPTIONS,
  NumberField,
  SelectField,
  resolveFootprintParams,
} from './objectRailShared';
import styles from './WorkbenchRail.module.css';

type BuildHouseFormFootprintSectionsInput = {
  canEditFootprint?: boolean;
  disabled?: boolean;
  fieldErrors: FieldErrors;
  houseForm: HouseFormModel | null;
  runFootprintCommit: RunFootprintCommit;
};

export function buildHouseFormFootprintSections({
  canEditFootprint,
  disabled,
  fieldErrors,
  houseForm,
  runFootprintCommit,
}: BuildHouseFormFootprintSectionsInput): ReactNode[] {
  const footprintParams = resolveFootprintParams(houseForm);
  const footprintMode = houseForm?.footprint.mode ?? 'preset';
  const footprintPreset = houseForm?.footprint.preset ?? 'straight';
  // PR-COMP-PHASE3.3 (2026-06-18): footprint mode picker removed.
  // Composition-first authoring (Phase 3.1/3.2) means new forms are
  // rectangles and freeform `custom_polygon` authoring is retired.
  // Legacy forms persisted with `mode: 'custom_polygon'` still render
  // their stored polygon read-only via the legacy pipeline; the rail
  // shows a single read-only badge so designers understand why
  // preset-specific controls are unavailable on those forms.
  const fields: ReactNode[] = [];
  if (footprintMode === 'custom_polygon') {
    fields.push(
      <p key="legacy-polygon-badge" className={styles.fieldHint}>
        This house form was authored as a freeform outline before composition. It
        renders read-only; recreate it as a rectangle if you need to change shape.
      </p>,
    );
  } else {
    fields.push(
      <SelectField
        key="footprint-preset"
        label="House footprint"
        value={footprintPreset}
        options={FOOTPRINT_OPTIONS}
        disabled={disabled || !canEditFootprint}
        error={fieldErrors['footprint-preset']}
        onCommit={(value) =>
          runFootprintCommit('footprint-preset', {
            type: 'preset',
            preset: value as HouseFormFootprintModel['preset'],
          })
        }
      />,
    );
  }
  if (fieldErrors.outline) {
    fields.push(
      <p key="outline-error" className={styles.fieldError}>
        {fieldErrors.outline}
      </p>,
    );
  }

  if (footprintMode === 'preset' && (footprintPreset === 'l_left' || footprintPreset === 'l_right')) {
    fields.push(
      <NumberField
        key="return-run"
        label="Return run (m)"
        value={footprintParams.returnRunM}
        disabled={disabled || !canEditFootprint}
        error={fieldErrors.returnRunM}
        onCommit={(value) => runFootprintCommit('returnRunM', { type: 'param', key: 'returnRunM', value })}
      />,
    );
  }

  if (footprintMode === 'preset' && (footprintPreset === 'recess_left' || footprintPreset === 'recess_right')) {
    fields.push(
      <NumberField
        key="recess-width"
        label="Recess width (m)"
        value={footprintParams.recessWidthM}
        disabled={disabled || !canEditFootprint}
        error={fieldErrors.recessWidthM}
        onCommit={(value) => runFootprintCommit('recessWidthM', { type: 'param', key: 'recessWidthM', value })}
      />,
      <NumberField
        key="recess-depth"
        label="Recess depth (m)"
        value={footprintParams.recessDepthM}
        disabled={disabled || !canEditFootprint}
        error={fieldErrors.recessDepthM}
        onCommit={(value) => runFootprintCommit('recessDepthM', { type: 'param', key: 'recessDepthM', value })}
      />,
    );
  }

  if (footprintMode === 'preset' && footprintPreset === 'u_shape') {
    fields.push(
      <NumberField
        key="left-leg"
        label="Left leg run (m)"
        value={footprintParams.leftLegRunM}
        disabled={disabled || !canEditFootprint}
        error={fieldErrors.leftLegRunM}
        onCommit={(value) => runFootprintCommit('leftLegRunM', { type: 'param', key: 'leftLegRunM', value })}
      />,
      <NumberField
        key="right-leg"
        label="Right leg run (m)"
        value={footprintParams.rightLegRunM}
        disabled={disabled || !canEditFootprint}
        error={fieldErrors.rightLegRunM}
        onCommit={(value) => runFootprintCommit('rightLegRunM', { type: 'param', key: 'rightLegRunM', value })}
      />,
    );
  }

  if (footprintMode === 'preset' && (footprintPreset === 'wrap_left' || footprintPreset === 'wrap_right')) {
    fields.push(
      <NumberField
        key="side-run"
        label="Side run (m)"
        value={footprintParams.sideRunM}
        disabled={disabled || !canEditFootprint}
        error={fieldErrors.sideRunM}
        onCommit={(value) => runFootprintCommit('sideRunM', { type: 'param', key: 'sideRunM', value })}
      />,
    );
  }

  return fields;
}
