'use client';

import { useCallback, useMemo, useState } from 'react';
import { HOUSE_FOOTPRINT_PRESET_OPTIONS, type ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import {
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintMode,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPreset,
} from '@/lib/types/calculator';
import type {
  CalculatorHouseAttachmentStrategy,
  CalculatorHouseFootprintMode,
  CalculatorHouseRoofMaterial,
  CalculatorHouseStoreyMode,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type { ObjectWorkbenchGeometryEditIntent, ObjectWorkbenchGeometryEditState, ObjectWorkbenchPergolaFamily } from '@/lib/drawings/geometry/geometryEditAdapter';
import {
  RailSection,
  renderRailField,
  withCurrentOption,
  type CommitResult,
  type RailFieldDefinition,
  type SelectOption,
} from './fields';
import styles from './WorkbenchRail.module.css';

type SanctuaryWorkbenchSectionVisibility = {
  geometry?: boolean;
  roof?: boolean;
  gable?: boolean;
  houseContext?: 'full' | 'canonical_extras' | 'none';
  supports?: boolean;
  overrides?: boolean;
};

export type SanctuaryWorkbenchRailProps = {
  moduleLabel: string;
  geometryState?: ObjectWorkbenchGeometryEditState | null;
  view: ModuleViewsTab;
  disabled?: boolean;
  canStartDrawOutline?: boolean;
  onStartDrawOutline?: () => Promise<CommitResult> | CommitResult;
  onCommitGeometryEdit?: (intent: ObjectWorkbenchGeometryEditIntent) => Promise<CommitResult> | CommitResult;
  chrome?: 'rail' | 'embedded';
  renderSummary?: boolean;
  sections?: SanctuaryWorkbenchSectionVisibility;
  houseContextSectionTitle?: string;
  emptyMessage?: string;
};

const FAMILY_OPTIONS: SelectOption[] = [
  { label: 'Mono', value: 'mono' },
  { label: 'Gable', value: 'gable' },
  { label: 'Box', value: 'box' },
  { label: 'Hip', value: 'hip' },
  { label: 'Hip (corner)', value: 'hip_corner' },
];
const ROOF_MATERIAL_OPTIONS: SelectOption[] = [
  { label: 'Acrylic', value: 'acrylic' },
  { label: 'Insulated', value: 'insulated' },
  { label: 'Louvre', value: 'louvre' },
  { label: 'Timber', value: 'timber' },
  { label: 'Mixed', value: 'mixed' },
];
const HOUSE_CONNECTION_OPTIONS: SelectOption[] = [
  { label: 'Soffit', value: 'soffit' },
  { label: 'Fascia', value: 'fascia' },
  { label: 'Wall', value: 'wall' },
  { label: 'Freestanding', value: 'freestanding' },
];
const HOUSE_ATTACHMENT_STRATEGY_OPTIONS: SelectOption[] = [
  { label: 'Auto', value: 'auto' },
  { label: 'Soffit brackets', value: 'soffit_brackets' },
  { label: 'Fascia under gutter', value: 'fascia_under_gutter' },
  { label: 'Facade ledger', value: 'facade_ledger' },
  { label: 'Post-supported tieback', value: 'post_supported_tieback' },
  { label: 'None', value: 'none' },
];
const HOUSE_STOREY_MODE_OPTIONS: SelectOption[] = [
  { label: 'Single storey', value: 'single_storey' },
  { label: 'Double storey', value: 'double_storey' },
  { label: 'Custom', value: 'custom' },
];
const HOUSE_ROOF_MATERIAL_OPTIONS: SelectOption[] = [
  { label: 'Corrugated iron', value: 'corrugated_iron' },
  { label: '5-rib / trapezoidal', value: 'trapezoidal_5_rib' },
  { label: 'Eurotray 300', value: 'eurotray_300' },
  { label: 'Eurotray 500', value: 'eurotray_500' },
  { label: 'Shingles', value: 'shingles' },
];
const ATTACHMENT_SIDE_OPTIONS: SelectOption[] = [
  { label: 'Rear', value: 'rear' },
  { label: 'Front', value: 'front' },
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' },
];
const POST_CONNECTION_OPTIONS: SelectOption[] = [
  { label: 'Pile (1m)', value: 'pile_1m' },
  { label: 'Pile (1.5m)', value: 'pile_1_5m' },
  { label: 'Deck bracket', value: 'deck_bracket' },
  { label: 'Slab anchors', value: 'slab_anchors' },
];
const GROUND_OPTIONS: SelectOption[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Hard', value: 'hard' },
];
const GABLE_END_FRAME_OPTIONS: SelectOption[] = [
  { label: 'None', value: 'none' },
  { label: 'Outer end only', value: 'outer_end_only' },
  { label: 'Both ends', value: 'both_ends' },
];
const GABLE_GUTTER_OPTIONS: SelectOption[] = [
  { label: 'House gutter', value: 'house' },
  { label: 'Our gutter (SP)', value: 'our' },
];
const DRAWING_ROTATION_OPTIONS: SelectOption[] = [
  { label: '0 deg', value: '0' },
  { label: '90 deg', value: '1' },
  { label: '180 deg', value: '2' },
  { label: '270 deg', value: '3' },
];
const FOOTPRINT_OPTIONS: SelectOption[] = HOUSE_FOOTPRINT_PRESET_OPTIONS.map((option) => ({
  label: option.label,
  value: option.id,
}));
const FOOTPRINT_MODE_OPTIONS: SelectOption[] = [
  { label: 'Preset', value: 'preset' },
  { label: 'Draw outline', value: 'custom_polygon' },
];
const DEFAULT_OVERRIDE_OPTION: SelectOption = { label: 'Auto', value: '' };
const RAFTER_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: '80x50', value: '80x50' }, { label: '100x50', value: '100x50' }, { label: '150x50', value: '150x50' }, { label: '200x50', value: '200x50' }];
const LEDGER_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: '80x50', value: '80x50' }, { label: '100x50', value: '100x50' }, { label: '150x50', value: '150x50' }, { label: '200x50', value: '200x50' }];
const POST_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: '80x50', value: '80x50' }, { label: '100x50', value: '100x50' }, { label: '150x100', value: '150x100' }, { label: '100x100', value: '100x100' }, { label: '150x150', value: '150x150' }];
const FRONT_BEAM_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: 'SP Gutter', value: 'SP Gutter' }, { label: '100x50', value: '100x50' }, { label: '150x50', value: '150x50' }, { label: '200x50', value: '200x50' }, { label: '300x50', value: '300x50' }, { label: 'Steel RHS 150x50x3', value: 'RHS 150x50x3' }];
const RIDGE_BEAM_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: '100x50', value: '100x50' }, { label: '150x50', value: '150x50' }, { label: '200x50', value: '200x50' }, { label: 'Steel RHS 150x50x3', value: 'RHS 150x50x3' }];
const BOX_BEAM_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: '300x50', value: '300x50' }, { label: '250x50', value: '250x50' }, { label: '200x50', value: '200x50' }];
const STRUT_PROFILE_OPTIONS: SelectOption[] = [DEFAULT_OVERRIDE_OPTION, { label: '50x50', value: '50x50' }, { label: '80x50', value: '80x50' }, { label: '100x50', value: '100x50' }, { label: '150x50', value: '150x50' }, { label: '200x50', value: '200x50' }];
const CANONICAL_HOUSE_CONTEXT_EXCLUDED_IDS = new Set([
  'attachment-side',
  'house-footprint-mode',
  'house-footprint-preset',
  'drawing-rotation',
  'house-footprint-width',
  'house-footprint-offset-x',
  'house-footprint-setback',
  'house-footprint-band-depth',
  'house-footprint-return-run',
  'house-footprint-recess-width',
  'house-footprint-recess-depth',
  'house-footprint-left-leg',
  'house-footprint-right-leg',
  'house-footprint-side-run',
]);

function gableEndFrameOptionsForConnection(connectionType: ObjectWorkbenchGeometryEditState['connection']['type']): SelectOption[] {
  return GABLE_END_FRAME_OPTIONS.filter((option) => {
    if (option.value === 'none') return true;
    if (connectionType === 'freestanding') return option.value === 'both_ends';
    return option.value === 'outer_end_only' || option.value === 'both_ends';
  });
}

export default function SanctuaryWorkbenchRail({
  moduleLabel,
  geometryState,
  view,
  disabled = false,
  canStartDrawOutline = false,
  onStartDrawOutline,
  onCommitGeometryEdit,
  chrome = 'rail',
  renderSummary = true,
  sections,
  houseContextSectionTitle = 'House / Context',
  emptyMessage,
}: SanctuaryWorkbenchRailProps) {
  const [pendingFieldId, setPendingFieldId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const family = geometryState?.family ?? null;
  const footprintMode = geometryState ? normalizeHouseFootprintMode(geometryState.houseContext.footprintMode) : 'preset';
  const footprintPreset = geometryState ? normalizeHouseFootprintPreset(geometryState.houseContext.footprintPreset) : 'straight';
  const footprintParams = geometryState ? normalizeHouseFootprintParams(geometryState.houseContext.footprintParams) : normalizeHouseFootprintParams(undefined);
  const drawingRotation = geometryState ? String(normalizeDrawingRotationQuarterTurns(geometryState.houseContext.drawingRotationQuarterTurns)) : '0';
  const boxToggleDisabled =
    disabled ||
    !geometryState ||
    family === 'gable' ||
    family === 'hip' ||
    family === 'hip_corner' ||
    !onCommitGeometryEdit;
  const canEditHouseContext =
    !disabled &&
    Boolean(geometryState) &&
    Boolean(onCommitGeometryEdit) &&
    Boolean(geometryState?.houseContext.canEditFootprint);
  const canOpenDrawOutlineEditor = canEditHouseContext && view === 'plan' && canStartDrawOutline && Boolean(onStartDrawOutline);
  const canEditHouseModel = canEditHouseContext && geometryState?.connection.type !== 'freestanding';
  const showGround =
    geometryState?.supports.postConnectionType === 'pile_1m' || geometryState?.supports.postConnectionType === 'pile_1_5m';

  const runCommit = useCallback(async (fieldId: string, action: Promise<CommitResult> | CommitResult) => {
    setPendingFieldId(fieldId);
    const result = await Promise.resolve(action);
    setPendingFieldId((current) => (current === fieldId ? null : current));
    setFieldErrors((current) => {
      const next = { ...current };
      if (result.ok) delete next[fieldId];
      else next[fieldId] = result.error ?? 'Unable to update the local drawing draft.';
      return next;
    });
    return result;
  }, []);

  const commitGeometryEdit = useCallback(
    async (fieldId: string, intent: ObjectWorkbenchGeometryEditIntent) => {
      if (!onCommitGeometryEdit) {
        return { ok: false, error: 'Sanctuary controls are not available right now.' } satisfies CommitResult;
      }
      return await runCommit(fieldId, onCommitGeometryEdit(intent));
    },
    [onCommitGeometryEdit, runCommit],
  );

  const commitRotation = useCallback(
    async (nextValue: string) => {
      const target = Number.parseInt(nextValue, 10);
      if (!Number.isInteger(target) || target < 0 || target > 3) {
        return { ok: false, error: 'Choose a supported drawing rotation.' } satisfies CommitResult;
      }

      let current = Number.parseInt(drawingRotation, 10);
      while (current !== target) {
        const forward = (target - current + 4) % 4;
        const delta: -1 | 1 = forward <= 2 ? 1 : -1;
        const result = await commitGeometryEdit('drawing-rotation', { type: 'drawing_rotation', delta });
        if (!result.ok) return result;
        current = (current + delta + 4) % 4;
      }

      return { ok: true } satisfies CommitResult;
    },
    [commitGeometryEdit, drawingRotation],
  );

  const footprintModeOptions = useMemo(
    () =>
      FOOTPRINT_MODE_OPTIONS.map((option) => ({
        ...option,
        disabled: option.value === 'custom_polygon' && !canOpenDrawOutlineEditor,
      })),
    [canOpenDrawOutlineEditor],
  );

  const geometryFields = useMemo(() => {
    if (!geometryState || !family) return [];
    return [
      {
        id: 'pergola-family',
        kind: 'select',
        label: 'Pergola family',
        value: family,
        options: FAMILY_OPTIONS,
        helperText: view === 'section' ? 'Family changes still update the shared draft from Section review.' : 'Switch between Sanctuary V1 families without leaving the workbench.',
        pending: pendingFieldId === 'pergola-family',
        error: fieldErrors['pergola-family'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('pergola-family', {
            type: 'family',
            value: value as ObjectWorkbenchPergolaFamily,
          }),
      },
      {
        id: 'box-perimeter-enabled',
        kind: 'toggle',
        label: 'Box perimeter',
        value: geometryState.roof.boxPerimeterEnabled,
        helperText:
          family === 'gable' || family === 'hip' || family === 'hip_corner'
            ? 'Box perimeter is only available for mono/box layouts.'
            : 'Keep this on for box-family layouts.',
        pending: pendingFieldId === 'box-perimeter-enabled',
        error: fieldErrors['box-perimeter-enabled'],
        disabled: boxToggleDisabled,
        onCommit: (value: boolean) =>
          commitGeometryEdit('box-perimeter-enabled', {
            type: 'family',
            value: value ? 'box' : 'mono',
          }),
      },
      {
        id: 'lengthM',
        kind: 'number',
        label: family === 'hip_corner' ? 'Roof length A (m)' : 'Roof length (m)',
        value: geometryState.dimensions.lengthM,
        pending: pendingFieldId === 'lengthM',
        error: fieldErrors.lengthM,
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('lengthM', {
            type: 'dimension',
            field: 'lengthM',
            value,
          }),
      },
      {
        id: 'projectionM',
        kind: 'number',
        label: family === 'hip_corner' ? 'Roof span A (m)' : 'Roof span (m)',
        value: geometryState.dimensions.projectionM,
        pending: pendingFieldId === 'projectionM',
        error: fieldErrors.projectionM,
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('projectionM', {
            type: 'dimension',
            field: 'projectionM',
            value,
          }),
      },
      ...(family === 'hip_corner'
        ? ([
            {
              id: 'hip-corner-length-b',
              kind: 'number',
              label: 'Roof length B (m)',
              value: geometryState.dimensions.hipCornerLengthBM,
              pending: pendingFieldId === 'hip-corner-length-b',
              error: fieldErrors['hip-corner-length-b'],
              disabled: disabled || !onCommitGeometryEdit,
              onCommit: (value: string) =>
                commitGeometryEdit('hip-corner-length-b', {
                  type: 'dimension',
                  field: 'hipCornerLengthBM',
                  value,
                }),
            },
            {
              id: 'hip-corner-projection-b',
              kind: 'number',
              label: 'Roof span B (m)',
              value: geometryState.dimensions.hipCornerProjectionBM,
              pending: pendingFieldId === 'hip-corner-projection-b',
              error: fieldErrors['hip-corner-projection-b'],
              disabled: disabled || !onCommitGeometryEdit,
              onCommit: (value: string) =>
                commitGeometryEdit('hip-corner-projection-b', {
                  type: 'dimension',
                  field: 'hipCornerProjectionBM',
                  value,
                }),
            },
          ] satisfies RailFieldDefinition[])
        : []),
    ] satisfies RailFieldDefinition[];
  }, [boxToggleDisabled, commitGeometryEdit, disabled, family, fieldErrors, geometryState, onCommitGeometryEdit, pendingFieldId, view]);

  const roofFields = useMemo(() => {
    if (!geometryState) return [];
    return [
      {
        id: 'roof-material',
        kind: 'select',
        label: 'Roof material',
        value: geometryState.roof.material,
        options: ROOF_MATERIAL_OPTIONS,
        pending: pendingFieldId === 'roof-material',
        error: fieldErrors['roof-material'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('roof-material', {
            type: 'roof_material',
            value: value as CalculatorModuleInputs['roofMaterial'],
          }),
      },
      {
        id: 'roof-pitch',
        kind: 'number',
        label: 'Roof pitch (deg)',
        value: geometryState.roof.pitchDeg,
        helperText: geometryState.roof.boxPerimeterEnabled ? 'Auto-computed for box perimeter.' : 'Blank uses the module default pitch.',
        pending: pendingFieldId === 'roof-pitch',
        error: fieldErrors['roof-pitch'],
        disabled: disabled || !onCommitGeometryEdit || Boolean(geometryState.roof.boxPerimeterEnabled),
        onCommit: (value: string) =>
          commitGeometryEdit('roof-pitch', {
            type: 'roof_pitch',
            value,
          }),
      },
      ...(geometryState.roof.material === 'mixed'
        ? family === 'mono' || family === 'box'
          ? ([
              {
                id: 'mixed-acrylic-main',
                kind: 'number',
                label: 'Acrylic bays (main)',
                value: geometryState.roof.mixedAcrylicBaysMain,
                pending: pendingFieldId === 'mixed-acrylic-main',
                error: fieldErrors['mixed-acrylic-main'],
                disabled: disabled || !onCommitGeometryEdit,
                onCommit: (value: string) =>
                  commitGeometryEdit('mixed-acrylic-main', {
                    type: 'mixed_acrylic_bays',
                    field: 'mixedAcrylicBaysMain',
                    value,
                  }),
              },
            ] satisfies RailFieldDefinition[])
          : ([
              {
                id: 'mixed-acrylic-a',
                kind: 'number',
                label: family === 'hip_corner' ? 'Acrylic bays (leg A)' : 'Acrylic bays (side A)',
                value: geometryState.roof.mixedAcrylicBaysA,
                pending: pendingFieldId === 'mixed-acrylic-a',
                error: fieldErrors['mixed-acrylic-a'],
                disabled: disabled || !onCommitGeometryEdit,
                onCommit: (value: string) =>
                  commitGeometryEdit('mixed-acrylic-a', {
                    type: 'mixed_acrylic_bays',
                    field: 'mixedAcrylicBaysA',
                    value,
                  }),
              },
              {
                id: 'mixed-acrylic-b',
                kind: 'number',
                label: family === 'hip_corner' ? 'Acrylic bays (leg B)' : 'Acrylic bays (side B)',
                value: geometryState.roof.mixedAcrylicBaysB,
                pending: pendingFieldId === 'mixed-acrylic-b',
                error: fieldErrors['mixed-acrylic-b'],
                disabled: disabled || !onCommitGeometryEdit,
                onCommit: (value: string) =>
                  commitGeometryEdit('mixed-acrylic-b', {
                    type: 'mixed_acrylic_bays',
                    field: 'mixedAcrylicBaysB',
                    value,
                  }),
              },
            ] satisfies RailFieldDefinition[])
        : []),
    ] satisfies RailFieldDefinition[];
  }, [commitGeometryEdit, disabled, family, fieldErrors, geometryState, onCommitGeometryEdit, pendingFieldId]);

  const gableFields = useMemo(() => {
    if (!geometryState || family !== 'gable' || !geometryState.gable) return [];
    const endFrameOptions = withCurrentOption(
      gableEndFrameOptionsForConnection(geometryState.connection.type),
      geometryState.gable.endFramesMode,
      'Current',
    );
    const helperText = 'End frames are editable. Eave gutter modes are constrained to the supported gable baseline.';
    const gutterHelperText = 'Controlled by the supported gable baseline for this connection type.';
    return [
      {
        id: 'gable-end-frames',
        kind: 'select',
        label: 'Gable end frames',
        value: geometryState.gable.endFramesMode,
        options: endFrameOptions,
        helperText,
        pending: pendingFieldId === 'gable-end-frames',
        error: fieldErrors['gable-end-frames'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('gable-end-frames', {
            type: 'gable_end_frames',
            value: value as CalculatorModuleInputs['gableEndFramesMode'],
          }),
      },
      {
        id: 'gable-house-eave-gutter',
        kind: 'select',
        label: 'House-side eave gutter',
        value: geometryState.gable.houseEaveGutterMode,
        options: GABLE_GUTTER_OPTIONS,
        helperText: gutterHelperText,
        disabled: true,
        pending: false,
        onCommit: () => undefined,
      },
      {
        id: 'gable-outer-eave-gutter',
        kind: 'select',
        label: 'Outer-side eave gutter',
        value: geometryState.gable.outerEaveGutterMode,
        options: GABLE_GUTTER_OPTIONS,
        helperText: gutterHelperText,
        disabled: true,
        pending: false,
        onCommit: () => undefined,
      },
    ] satisfies RailFieldDefinition[];
  }, [commitGeometryEdit, disabled, family, fieldErrors, geometryState, onCommitGeometryEdit, pendingFieldId]);

  const houseFields = useMemo(() => {
    if (!geometryState) return [];

    const footprintFields: RailFieldDefinition[] = [
      {
        id: 'house-connection',
        kind: 'select',
        label: 'House connection',
        value: geometryState.connection.type,
        options: HOUSE_CONNECTION_OPTIONS,
        pending: pendingFieldId === 'house-connection',
        error: fieldErrors['house-connection'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('house-connection', {
            type: 'house_connection',
            value: value as ObjectWorkbenchGeometryEditState['connection']['type'],
          }),
      },
      {
        id: 'house-attachment-strategy',
        kind: 'select',
        label: 'Attachment strategy',
        value: geometryState.houseContext.attachmentStrategy,
        options: HOUSE_ATTACHMENT_STRATEGY_OPTIONS,
        helperText: canEditHouseModel ? 'Auto follows the broad house connection.' : 'Available when the pergola is attached to the house.',
        pending: pendingFieldId === 'house-attachment-strategy',
        error: fieldErrors['house-attachment-strategy'],
        disabled: !canEditHouseModel,
        onCommit: (value: string) =>
          commitGeometryEdit('house-attachment-strategy', {
            type: 'house_config',
            key: 'houseAttachmentStrategy',
            value: value as CalculatorHouseAttachmentStrategy | 'auto',
          }),
      },
      {
        id: 'house-storey-mode',
        kind: 'select',
        label: 'Storey mode',
        value: geometryState.houseContext.storeyMode,
        options: HOUSE_STOREY_MODE_OPTIONS,
        pending: pendingFieldId === 'house-storey-mode',
        error: fieldErrors['house-storey-mode'],
        disabled: !canEditHouseModel,
        onCommit: (value: string) =>
          commitGeometryEdit('house-storey-mode', {
            type: 'house_config',
            key: 'houseStoreyMode',
            value: value as CalculatorHouseStoreyMode,
          }),
      },
      {
        id: 'house-roof-material',
        kind: 'select',
        label: 'House roof material',
        value: geometryState.houseContext.roofMaterial ?? 'corrugated_iron',
        options: HOUSE_ROOF_MATERIAL_OPTIONS,
        pending: pendingFieldId === 'house-roof-material',
        error: fieldErrors['house-roof-material'],
        disabled: !canEditHouseModel,
        onCommit: (value: string) =>
          commitGeometryEdit('house-roof-material', {
            type: 'house_config',
            key: 'houseRoofMaterial',
            value: value as CalculatorHouseRoofMaterial,
          }),
      },
      {
        id: 'house-eave-height',
        kind: 'number',
        label: 'Eave height (m)',
        value: geometryState.houseContext.eaveHeightM,
        pending: pendingFieldId === 'house-eave-height',
        error: fieldErrors['house-eave-height'],
        disabled: !canEditHouseModel,
        onCommit: (value: string) =>
          commitGeometryEdit('house-eave-height', {
            type: 'house_config',
            key: 'houseEaveHeightM',
            value,
          }),
      },
      {
        id: 'house-wall-height',
        kind: 'number',
        label: 'Wall height (m)',
        value: geometryState.houseContext.wallHeightM,
        pending: pendingFieldId === 'house-wall-height',
        error: fieldErrors['house-wall-height'],
        disabled: !canEditHouseModel,
        onCommit: (value: string) =>
          commitGeometryEdit('house-wall-height', {
            type: 'house_config',
            key: 'houseWallHeightM',
            value,
          }),
      },
      {
        id: 'house-roof-pitch',
        kind: 'number',
        label: 'House roof pitch (deg)',
        value: geometryState.houseContext.roofPitchDeg,
        pending: pendingFieldId === 'house-roof-pitch',
        error: fieldErrors['house-roof-pitch'],
        disabled: !canEditHouseModel,
        onCommit: (value: string) =>
          commitGeometryEdit('house-roof-pitch', {
            type: 'house_config',
            key: 'houseRoofPitchDeg',
            value,
          }),
      },
      {
        id: 'attachment-side',
        kind: 'select',
        label: 'Attachment side',
        value: geometryState.connection.attachmentSide ?? 'rear',
        options: ATTACHMENT_SIDE_OPTIONS,
        helperText: canEditHouseContext ? undefined : 'Available when the pergola is attached to the house.',
        pending: pendingFieldId === 'attachment-side',
        error: fieldErrors['attachment-side'],
        disabled: !canEditHouseContext,
        onCommit: (value: string) =>
          commitGeometryEdit('attachment-side', {
            type: 'attachment_side',
            value: value as CalculatorModuleInputs['attachmentSide'],
          }),
      },
      {
        id: 'house-footprint-mode',
        kind: 'select',
        label: 'House footprint mode',
        value: footprintMode,
        options: footprintModeOptions,
        helperText:
          footprintMode === 'custom_polygon' || !canOpenDrawOutlineEditor
            ? 'Use Model Space > Plan to draw the outline.'
            : undefined,
        pending: pendingFieldId === 'house-footprint-mode',
        error: fieldErrors['house-footprint-mode'],
        disabled: !canEditHouseContext,
        onCommit: (value: string) => {
          if (value === 'custom_polygon' && !canOpenDrawOutlineEditor) {
            return runCommit('house-footprint-mode', {
              ok: false,
              error: 'Use Model Space > Plan to draw the outline.',
            });
          }
          if (value === 'custom_polygon') {
            return runCommit('house-footprint-mode', onStartDrawOutline?.() ?? { ok: false, error: 'Use Model Space > Plan to draw the outline.' });
          }
          return commitGeometryEdit('house-footprint-mode', {
            type: 'footprint_mode',
            value: value as CalculatorHouseFootprintMode,
          });
        },
      },
      {
        id: 'house-footprint-preset',
        kind: 'select',
        label: 'House footprint',
        value: footprintPreset,
        options: FOOTPRINT_OPTIONS,
        helperText: canEditHouseContext ? undefined : 'Available when the pergola is attached to the house.',
        pending: pendingFieldId === 'house-footprint-preset',
        error: fieldErrors['house-footprint-preset'],
        disabled: !canEditHouseContext || footprintMode === 'custom_polygon',
        onCommit: (value: string) =>
          commitGeometryEdit('house-footprint-preset', {
            type: 'footprint_preset',
            value: value as CalculatorModuleInputs['houseFootprintPreset'],
          }),
      },
      {
        id: 'drawing-rotation',
        kind: 'select',
        label: 'Drawing rotation',
        value: drawingRotation,
        options: DRAWING_ROTATION_OPTIONS,
        helperText: canEditHouseContext ? undefined : 'Available when the pergola is attached to the house.',
        pending: pendingFieldId === 'drawing-rotation',
        error: fieldErrors['drawing-rotation'],
        disabled: !canEditHouseContext,
        onCommit: commitRotation,
      },
      {
        id: 'house-soffit-depth',
        kind: 'number',
        label: 'Soffit depth (mm)',
        value: geometryState.houseContext.soffitDepthMm,
        pending: pendingFieldId === 'house-soffit-depth',
        error: fieldErrors['house-soffit-depth'],
        disabled: !canEditHouseModel,
        onCommit: (value: string) =>
          commitGeometryEdit('house-soffit-depth', {
            type: 'house_config',
            key: 'houseSoffitDepthMm',
            value,
          }),
      },
      {
        id: 'house-fascia-height',
        kind: 'number',
        label: 'Fascia height (mm)',
        value: geometryState.houseContext.fasciaHeightMm,
        pending: pendingFieldId === 'house-fascia-height',
        error: fieldErrors['house-fascia-height'],
        disabled: !canEditHouseModel,
        onCommit: (value: string) =>
          commitGeometryEdit('house-fascia-height', {
            type: 'house_config',
            key: 'houseFasciaHeightMm',
            value,
          }),
      },
      {
        id: 'house-gutter-width',
        kind: 'number',
        label: 'Gutter width (mm)',
        value: geometryState.houseContext.gutterWidthMm,
        pending: pendingFieldId === 'house-gutter-width',
        error: fieldErrors['house-gutter-width'],
        disabled: !canEditHouseModel,
        onCommit: (value: string) =>
          commitGeometryEdit('house-gutter-width', {
            type: 'house_config',
            key: 'houseGutterWidthMm',
            value,
          }),
      },
      {
        id: 'house-gutter-depth',
        kind: 'number',
        label: 'Gutter depth (mm)',
        value: geometryState.houseContext.gutterDepthMm,
        pending: pendingFieldId === 'house-gutter-depth',
        error: fieldErrors['house-gutter-depth'],
        disabled: !canEditHouseModel,
        onCommit: (value: string) =>
          commitGeometryEdit('house-gutter-depth', {
            type: 'house_config',
            key: 'houseGutterDepthMm',
            value,
          }),
      },
      {
        id: 'house-gutter-projection',
        kind: 'number',
        label: 'Gutter projection (mm)',
        value: geometryState.houseContext.gutterProjectionMm,
        pending: pendingFieldId === 'house-gutter-projection',
        error: fieldErrors['house-gutter-projection'],
        disabled: !canEditHouseModel,
        onCommit: (value: string) =>
          commitGeometryEdit('house-gutter-projection', {
            type: 'house_config',
            key: 'houseGutterProjectionMm',
            value,
          }),
      },
      {
        id: 'house-eave-overhang',
        kind: 'number',
        label: 'Eave overhang (mm)',
        value: geometryState.houseContext.eaveOverhangMm,
        pending: pendingFieldId === 'house-eave-overhang',
        error: fieldErrors['house-eave-overhang'],
        disabled: !canEditHouseModel,
        onCommit: (value: string) =>
          commitGeometryEdit('house-eave-overhang', {
            type: 'house_config',
            key: 'houseEaveOverhangMm',
            value,
          }),
      },
      {
        id: 'house-footprint-width',
        kind: 'number',
        label: 'House width (m)',
        value: footprintParams.widthM,
        helperText: 'Blank matches the pergola length.',
        pending: pendingFieldId === 'house-footprint-width',
        error: fieldErrors['house-footprint-width'],
        disabled: !canEditHouseContext || footprintMode === 'custom_polygon',
        onCommit: (value: string) =>
          commitGeometryEdit('house-footprint-width', {
            type: 'footprint_param',
            key: 'widthM',
            value,
          }),
      },
      {
        id: 'house-footprint-offset-x',
        kind: 'number',
        label: 'House offset X (m)',
        value: footprintParams.offsetXM,
        helperText: 'Negative values extend left of the pergola.',
        pending: pendingFieldId === 'house-footprint-offset-x',
        error: fieldErrors['house-footprint-offset-x'],
        disabled: !canEditHouseContext,
        onCommit: (value: string) =>
          commitGeometryEdit('house-footprint-offset-x', {
            type: 'footprint_param',
            key: 'offsetXM',
            value,
          }),
      },
      {
        id: 'house-footprint-setback',
        kind: 'number',
        label: 'Facade setback (m)',
        value: footprintParams.setbackM,
        helperText: 'Visual house context only; pergola attachment stays fixed.',
        pending: pendingFieldId === 'house-footprint-setback',
        error: fieldErrors['house-footprint-setback'],
        disabled: !canEditHouseContext,
        onCommit: (value: string) =>
          commitGeometryEdit('house-footprint-setback', {
            type: 'footprint_param',
            key: 'setbackM',
            value,
          }),
      },
      {
        id: 'house-footprint-band-depth',
        kind: 'number',
        label: 'Footprint band depth (m)',
        value: footprintParams.bandDepthM,
        pending: pendingFieldId === 'house-footprint-band-depth',
        error: fieldErrors['house-footprint-band-depth'],
        disabled: !canEditHouseContext || footprintMode === 'custom_polygon',
        onCommit: (value: string) =>
          commitGeometryEdit('house-footprint-band-depth', {
            type: 'footprint_param',
            key: 'bandDepthM',
            value,
          }),
      },
    ];

    if (footprintMode === 'preset' && (footprintPreset === 'l_left' || footprintPreset === 'l_right')) {
      footprintFields.push({
        id: 'house-footprint-return-run',
        kind: 'number',
        label: 'Return run (m)',
        value: footprintParams.returnRunM,
        pending: pendingFieldId === 'house-footprint-return-run',
        error: fieldErrors['house-footprint-return-run'],
        disabled: !canEditHouseContext,
        onCommit: (value: string) =>
          commitGeometryEdit('house-footprint-return-run', {
            type: 'footprint_param',
            key: 'returnRunM',
            value,
          }),
      });
    }

    if (footprintMode === 'preset' && (footprintPreset === 'recess_left' || footprintPreset === 'recess_right')) {
      footprintFields.push(
        {
          id: 'house-footprint-recess-width',
          kind: 'number',
          label: 'Recess width (m)',
          value: footprintParams.recessWidthM,
          pending: pendingFieldId === 'house-footprint-recess-width',
          error: fieldErrors['house-footprint-recess-width'],
          disabled: !canEditHouseContext,
          onCommit: (value: string) =>
            commitGeometryEdit('house-footprint-recess-width', {
              type: 'footprint_param',
              key: 'recessWidthM',
              value,
            }),
        },
        {
          id: 'house-footprint-recess-depth',
          kind: 'number',
          label: 'Recess depth (m)',
          value: footprintParams.recessDepthM,
          pending: pendingFieldId === 'house-footprint-recess-depth',
          error: fieldErrors['house-footprint-recess-depth'],
          disabled: !canEditHouseContext,
          onCommit: (value: string) =>
            commitGeometryEdit('house-footprint-recess-depth', {
              type: 'footprint_param',
              key: 'recessDepthM',
              value,
            }),
        },
      );
    }

    if (footprintMode === 'preset' && footprintPreset === 'u_shape') {
      footprintFields.push(
        {
          id: 'house-footprint-left-leg',
          kind: 'number',
          label: 'Left leg run (m)',
          value: footprintParams.leftLegRunM,
          pending: pendingFieldId === 'house-footprint-left-leg',
          error: fieldErrors['house-footprint-left-leg'],
          disabled: !canEditHouseContext,
          onCommit: (value: string) =>
            commitGeometryEdit('house-footprint-left-leg', {
              type: 'footprint_param',
              key: 'leftLegRunM',
              value,
            }),
        },
        {
          id: 'house-footprint-right-leg',
          kind: 'number',
          label: 'Right leg run (m)',
          value: footprintParams.rightLegRunM,
          pending: pendingFieldId === 'house-footprint-right-leg',
          error: fieldErrors['house-footprint-right-leg'],
          disabled: !canEditHouseContext,
          onCommit: (value: string) =>
            commitGeometryEdit('house-footprint-right-leg', {
              type: 'footprint_param',
              key: 'rightLegRunM',
              value,
            }),
        },
      );
    }

    if (footprintMode === 'preset' && (footprintPreset === 'wrap_left' || footprintPreset === 'wrap_right')) {
      footprintFields.push({
        id: 'house-footprint-side-run',
        kind: 'number',
        label: 'Side run (m)',
        value: footprintParams.sideRunM,
        pending: pendingFieldId === 'house-footprint-side-run',
        error: fieldErrors['house-footprint-side-run'],
        disabled: !canEditHouseContext,
        onCommit: (value: string) =>
          commitGeometryEdit('house-footprint-side-run', {
            type: 'footprint_param',
            key: 'sideRunM',
            value,
          }),
      });
    }

    return footprintFields;
  }, [canEditHouseContext, canEditHouseModel, commitGeometryEdit, commitRotation, disabled, drawingRotation, fieldErrors, footprintMode, footprintParams, footprintPreset, geometryState, onCommitGeometryEdit, pendingFieldId]);

  const supportFields = useMemo(() => {
    if (!geometryState) return [];
    const fields: RailFieldDefinition[] = [
      {
        id: 'post-connection',
        kind: 'select',
        label: 'Post connection',
        value: geometryState.supports.postConnectionType,
        options: POST_CONNECTION_OPTIONS,
        pending: pendingFieldId === 'post-connection',
        error: fieldErrors['post-connection'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('post-connection', {
            type: 'post_connection',
            value: value as CalculatorModuleInputs['postConnectionType'],
          }),
      },
    ];

    if (showGround) {
      fields.push({
        id: 'ground-condition',
        kind: 'select',
        label: 'Ground',
        value: geometryState.supports.ground,
        options: GROUND_OPTIONS,
        pending: pendingFieldId === 'ground-condition',
        error: fieldErrors['ground-condition'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('ground-condition', {
            type: 'ground',
            value: value as CalculatorModuleInputs['ground'],
          }),
      });
    }

    fields.push(
      {
        id: 'post-count',
        kind: 'number',
        label: 'Post count',
        value: geometryState.supports.postCount,
        pending: pendingFieldId === 'post-count',
        error: fieldErrors['post-count'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('post-count', {
            type: 'post_count',
            value,
          }),
      },
      {
        id: 'post-cut-height',
        kind: 'number',
        label: 'Base height (m)',
        value: geometryState.supports.postCutHeightM,
        helperText: 'Clear height to the underside of the ledger/base line.',
        pending: pendingFieldId === 'post-cut-height',
        error: fieldErrors['post-cut-height'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) =>
          commitGeometryEdit('post-cut-height', {
            type: 'post_cut_height',
            value,
          }),
      },
    );

    return fields;
  }, [commitGeometryEdit, disabled, fieldErrors, geometryState, onCommitGeometryEdit, pendingFieldId, showGround]);

  const overrideFields = useMemo(() => {
    if (!geometryState) return [];

    const fields: RailFieldDefinition[] = [
      {
        id: 'ledger-profile-override',
        kind: 'select',
        label: 'Ledger override',
        value: geometryState.overrides.ledgerProfile,
        options: withCurrentOption(LEDGER_PROFILE_OPTIONS, geometryState.overrides.ledgerProfile, 'Current override'),
        pending: pendingFieldId === 'ledger-profile-override',
        error: fieldErrors['ledger-profile-override'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) => commitGeometryEdit('ledger-profile-override', { type: 'override', key: 'ledgerProfile', value }),
      },
      {
        id: 'rafter-profile-override',
        kind: 'select',
        label: 'Rafter override',
        value: geometryState.overrides.rafterProfile,
        options: withCurrentOption(RAFTER_PROFILE_OPTIONS, geometryState.overrides.rafterProfile, 'Current override'),
        pending: pendingFieldId === 'rafter-profile-override',
        error: fieldErrors['rafter-profile-override'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) => commitGeometryEdit('rafter-profile-override', { type: 'override', key: 'rafterProfile', value }),
      },
      {
        id: 'post-profile-override',
        kind: 'select',
        label: 'Post override',
        value: geometryState.overrides.postProfile,
        options: withCurrentOption(POST_PROFILE_OPTIONS, geometryState.overrides.postProfile, 'Current override'),
        pending: pendingFieldId === 'post-profile-override',
        error: fieldErrors['post-profile-override'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) => commitGeometryEdit('post-profile-override', { type: 'override', key: 'postProfile', value }),
      },
      {
        id: 'front-beam-profile-override',
        kind: 'select',
        label: 'Front beam override',
        value: geometryState.overrides.frontBeamProfile,
        options: withCurrentOption(FRONT_BEAM_PROFILE_OPTIONS, geometryState.overrides.frontBeamProfile, 'Current override'),
        pending: pendingFieldId === 'front-beam-profile-override',
        error: fieldErrors['front-beam-profile-override'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) => commitGeometryEdit('front-beam-profile-override', { type: 'override', key: 'frontBeamProfile', value }),
      },
      {
        id: 'ridge-beam-profile-override',
        kind: 'select',
        label: 'Ridge beam override',
        value: geometryState.overrides.ridgeBeamProfile,
        options: withCurrentOption(RIDGE_BEAM_PROFILE_OPTIONS, geometryState.overrides.ridgeBeamProfile, 'Current override'),
        pending: pendingFieldId === 'ridge-beam-profile-override',
        error: fieldErrors['ridge-beam-profile-override'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) => commitGeometryEdit('ridge-beam-profile-override', { type: 'override', key: 'ridgeBeamProfile', value }),
      },
    ];

    if (geometryState.roof.boxPerimeterEnabled) {
      fields.push({
        id: 'box-perimeter-beam-profile-override',
        kind: 'select',
        label: 'Box perimeter beam override',
        value: geometryState.overrides.boxPerimeterBeamProfile,
        options: withCurrentOption(BOX_BEAM_PROFILE_OPTIONS, geometryState.overrides.boxPerimeterBeamProfile, 'Current override'),
        pending: pendingFieldId === 'box-perimeter-beam-profile-override',
        error: fieldErrors['box-perimeter-beam-profile-override'],
        disabled: disabled || !onCommitGeometryEdit,
        onCommit: (value: string) => commitGeometryEdit('box-perimeter-beam-profile-override', { type: 'override', key: 'boxPerimeterBeamProfile', value }),
      });
    }

    if (family === 'gable') {
      fields.push(
        {
          id: 'tie-beam-profile-override',
          kind: 'select',
          label: 'Tie beam override',
          value: geometryState.overrides.tieBeamProfile,
          options: withCurrentOption(FRONT_BEAM_PROFILE_OPTIONS, geometryState.overrides.tieBeamProfile, 'Current override'),
          pending: pendingFieldId === 'tie-beam-profile-override',
          error: fieldErrors['tie-beam-profile-override'],
          disabled: disabled || !onCommitGeometryEdit,
          onCommit: (value: string) => commitGeometryEdit('tie-beam-profile-override', { type: 'override', key: 'tieBeamProfile', value }),
        },
        {
          id: 'strut-profile-override',
          kind: 'select',
          label: 'King-post strut override',
          value: geometryState.overrides.strutProfile,
          options: withCurrentOption(STRUT_PROFILE_OPTIONS, geometryState.overrides.strutProfile, 'Current override'),
          pending: pendingFieldId === 'strut-profile-override',
          error: fieldErrors['strut-profile-override'],
          disabled: disabled || !onCommitGeometryEdit,
          onCommit: (value: string) => commitGeometryEdit('strut-profile-override', { type: 'override', key: 'strutProfile', value }),
        },
      );
    }

    return fields;
  }, [commitGeometryEdit, disabled, family, fieldErrors, geometryState, onCommitGeometryEdit, pendingFieldId]);

  const sectionVisibility = {
    geometry: sections?.geometry ?? true,
    roof: sections?.roof ?? true,
    gable: sections?.gable ?? true,
    houseContext: sections?.houseContext ?? 'full',
    supports: sections?.supports ?? true,
    overrides: sections?.overrides ?? true,
  } as const;

  const visibleHouseFields =
    sectionVisibility.houseContext === 'canonical_extras'
      ? houseFields.filter((field) => !CANONICAL_HOUSE_CONTEXT_EXCLUDED_IDS.has(field.id))
      : houseFields;

  if (!geometryState || !family) {
    if (!renderSummary) {
      return <p className={styles.empty}>{emptyMessage ?? 'No Sanctuary controls are available for this module.'}</p>;
    }
    return (
      <section className={styles.summary}>
        <p className={styles.eyebrow}>Sanctuary Controls</p>
        <h3 className={styles.title}>{moduleLabel}</h3>
        <p className={styles.empty}>{emptyMessage ?? 'No Sanctuary controls are available for this module.'}</p>
      </section>
    );
  }

  const content = (
    <>
      {renderSummary ? (
        <section className={styles.summary}>
          <p className={styles.eyebrow}>Sanctuary Controls</p>
          <h3 className={styles.title}>{moduleLabel}</h3>
          <p className={styles.summaryText}>
            Local draft edits only.{' '}
            {view === 'section'
              ? 'Section stays review-first while these controls update the shared design.'
              : 'Model Space remains the primary editing surface.'}
          </p>
          {disabled ? <p className={styles.empty}>Editing is currently disabled for this estimate.</p> : null}
        </section>
      ) : null}

      {sectionVisibility.geometry ? <RailSection title="Geometry">{geometryFields.map(renderRailField)}</RailSection> : null}
      {sectionVisibility.roof ? <RailSection title="Roof">{roofFields.map(renderRailField)}</RailSection> : null}
      {sectionVisibility.gable && gableFields.length ? (
        <RailSection title="Gable Baseline">{gableFields.map(renderRailField)}</RailSection>
      ) : null}
      {sectionVisibility.houseContext !== 'none' && visibleHouseFields.length ? (
        <RailSection title={houseContextSectionTitle}>{visibleHouseFields.map(renderRailField)}</RailSection>
      ) : null}
      {sectionVisibility.supports ? <RailSection title="Supports">{supportFields.map(renderRailField)}</RailSection> : null}
      {sectionVisibility.overrides ? <RailSection title="Overrides">{overrideFields.map(renderRailField)}</RailSection> : null}
    </>
  );

  if (chrome === 'embedded') {
    return content;
  }

  return (
    <aside className={styles.rail} aria-label="Sanctuary workbench rail">
      {content}
    </aside>
  );
}
