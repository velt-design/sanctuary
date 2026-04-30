import type { ReactNode } from 'react';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { HouseFormModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { FieldErrors, RunFootprintCommit } from './objectWorkbenchRailTypes';
import {
  ActionButton,
  ATTACHMENT_SIDE_OPTIONS,
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
    <SelectField
      key="attachment-side"
      label="Attachment side"
      value={houseForm?.footprint.attachmentSide ?? 'rear'}
      options={ATTACHMENT_SIDE_OPTIONS}
      disabled={disabled || !canEditFootprint}
      error={fieldErrors['attachment-side']}
      onCommit={(value) =>
        runFootprintCommit('attachment-side', {
          type: 'attachment_side',
          side: value as CalculatorModuleInputs['attachmentSide'],
        })
      }
    />,
    <div key="footprint-actions" className={styles.buttonRow}>
      <ActionButton
        label="Rotate -90"
        disabled={disabled || !canEditFootprint}
        onClick={() => void runFootprintCommit('rotate-left', { type: 'rotate', delta: -1 })}
      />
      <ActionButton
        label="Rotate +90"
        disabled={disabled || !canEditFootprint}
        onClick={() => void runFootprintCommit('rotate-right', { type: 'rotate', delta: 1 })}
      />
    </div>,
    <ActionButton
      key="draw-outline"
      label={footprintMode === 'custom_polygon' ? 'Continue outline' : 'Draw outline'}
      disabled={disabled || !canEditFootprint || !canStartDrawOutline}
      onClick={() => void runStartOutline()}
    />,
    fieldErrors.outline ? <p key="outline-error" className={styles.fieldError}>{fieldErrors.outline}</p> : null,
    <NumberField
      key="width"
      label="House width (m)"
      value={footprintParams.widthM}
      disabled={disabled || !canEditFootprint || footprintMode === 'custom_polygon'}
      error={fieldErrors.widthM}
      helperText="Blank matches the active legacy module length."
      onCommit={(value) => runFootprintCommit('widthM', { type: 'param', key: 'widthM', value })}
    />,
    <NumberField
      key="offset"
      label="House offset X (m)"
      value={footprintParams.offsetXM}
      disabled={disabled || !canEditFootprint}
      error={fieldErrors.offsetXM}
      helperText="Negative values extend left of the pergola datum."
      onCommit={(value) => runFootprintCommit('offsetXM', { type: 'param', key: 'offsetXM', value })}
    />,
    <NumberField
      key="setback"
      label="Facade setback (m)"
      value={footprintParams.setbackM}
      disabled={disabled || !canEditFootprint}
      error={fieldErrors.setbackM}
      helperText="Shared facade offset for the house footprint context."
      onCommit={(value) => runFootprintCommit('setbackM', { type: 'param', key: 'setbackM', value })}
    />,
    <NumberField
      key="band-depth"
      label="Footprint band depth (m)"
      value={footprintParams.bandDepthM}
      disabled={disabled || !canEditFootprint || footprintMode === 'custom_polygon'}
      error={fieldErrors.bandDepthM}
      onCommit={(value) => runFootprintCommit('bandDepthM', { type: 'param', key: 'bandDepthM', value })}
    />,
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
