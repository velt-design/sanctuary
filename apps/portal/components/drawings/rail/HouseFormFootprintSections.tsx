import type { ReactNode } from 'react';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { HouseFormModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { FieldErrors, RunFootprintCommit } from './objectWorkbenchRailTypes';
import {
  ActionButton,
  FOOTPRINT_MODE_OPTIONS,
  FOOTPRINT_OPTIONS,
  NumberField,
  SelectField,
  resolveFootprintParams,
} from './objectRailShared';
import styles from './WorkbenchRail.module.css';

type BuildHouseFormFootprintSectionsInput = {
  canEditFootprint?: boolean;
  canStartDrawOutline?: boolean;
  disabled?: boolean;
  fieldErrors: FieldErrors;
  houseForm: HouseFormModel | null;
  runFootprintCommit: RunFootprintCommit;
  runStartOutline: () => Promise<void>;
};

export function buildHouseFormFootprintSections({
  canEditFootprint,
  canStartDrawOutline,
  disabled,
  fieldErrors,
  houseForm,
  runFootprintCommit,
  runStartOutline,
}: BuildHouseFormFootprintSectionsInput): ReactNode[] {
  const footprintParams = resolveFootprintParams(houseForm);
  const footprintMode = houseForm?.footprint.mode ?? 'preset';
  const footprintPreset = houseForm?.footprint.preset ?? 'straight';
  const fields: ReactNode[] = [
    <SelectField
      key="footprint-mode"
      label="House footprint mode"
      value={footprintMode}
      options={FOOTPRINT_MODE_OPTIONS}
      disabled={disabled || !canEditFootprint}
      error={fieldErrors['footprint-mode']}
      helperText={footprintMode === 'custom_polygon' ? 'Use the model-space outline tool to edit the shared house.' : undefined}
      onCommit={(value) => {
        if (value === 'custom_polygon') {
          return runStartOutline();
        }
        return runFootprintCommit('footprint-mode', {
          type: 'mode',
          mode: 'preset',
        });
      }}
    />,
    <SelectField
      key="footprint-preset"
      label="House footprint"
      value={footprintPreset}
      options={FOOTPRINT_OPTIONS}
      disabled={disabled || !canEditFootprint || footprintMode === 'custom_polygon'}
      error={fieldErrors['footprint-preset']}
      onCommit={(value) =>
        runFootprintCommit('footprint-preset', {
          type: 'preset',
          preset: value as CalculatorModuleInputs['houseFootprintPreset'],
        })
      }
    />,
    // PR-T7b (2026-05-29): five number-field/dropdown removals after a
    // recon pass:
    //   • Attachment side — superseded by snap-driven `pergola.attachment`
    //     per PR-F (docs/design-workbench-legacy-cull.md:185-225). Cost
    //     engine no longer reads it; geometry still uses it for polygon
    //     orientation but that's a leftover from the same retirement.
    //     Defaulting to 'rear' downstream is fine until the geometry
    //     path is cleaned up.
    //   • House width / Footprint band depth — only meaningful when
    //     synthesising a PRESET polygon. Disabled in custom_polygon
    //     mode already; removing rather than conditionally rendering
    //     because the user direction is "shape edits go through direct
    //     polygon editing or the gumball, not number fields."
    //   • House offset X / Facade setback — were the load-bearing
    //     position/setback controls but slot into the same category:
    //     direct polygon editing (drag the outline) or the future
    //     gumball replaces typed number entry. Removed per user
    //     direction. Geometry path (footprints.ts) keeps reading the
    //     persisted values; default-zero is the natural fallback.
    // "Continue outline" stays — conditional on custom_polygon mode so
    // it only appears when there's an active polygon edit to resume.
    footprintMode === 'custom_polygon' ? (
      <ActionButton
        key="continue-outline"
        label="Continue outline"
        disabled={disabled || !canEditFootprint || !canStartDrawOutline}
        onClick={() => void runStartOutline()}
      />
    ) : null,
    fieldErrors.outline ? <p key="outline-error" className={styles.fieldError}>{fieldErrors.outline}</p> : null,
  ];

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
