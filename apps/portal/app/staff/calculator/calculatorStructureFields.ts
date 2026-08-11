import type { Dispatch, ReactNode, SetStateAction } from 'react';

import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import type { CalculatorConfigurationField as FieldSchemaItem } from './calculatorConfigurationSections';
import type { CalculatorResolvedDefaultTexts } from './calculatorResolvedDefaults';
import {
  BOX_BEAM_PROFILE_OPTIONS,
  FRONT_BEAM_PROFILE_OPTIONS,
  GABLE_END_FRAME_OPTIONS,
  GABLE_GUTTER_OPTIONS,
  LEDGER_PROFILE_OPTIONS,
  OPEN_PERGOLA_PROFILE_OPTIONS,
  POST_PROFILE_OPTIONS,
  POWDERCOAT_STANDARD_COLOURS,
  RAFTER_PROFILE_OPTIONS,
  RIDGE_BEAM_PROFILE_OPTIONS,
  STRUT_PROFILE_OPTIONS,
} from './calculatorConfigurationFieldOptions';
import {
  computeBayCountsForModule,
  defaultMixedAcrylicBays,
  getRoofTypeForModule,
  isGutterBeamProfile,
  makeDefaultModule,
  normalizeOverrideValue,
  toNumber,
} from './calculatorInputs';
import {
  applyOpenPergolaDefaults,
  applyRoofedPergolaDefaults,
  DEFAULT_OPEN_PERGOLA_PROFILE,
  DEFAULT_OPEN_PERGOLA_RAFTER_SPACING_MM,
} from './calculatorOpenPergola';

function hasNonEmptyValue(value: string | undefined): value is string {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

type CalculatorModuleFieldSetter = <K extends keyof CalculatorModuleInputs>(
  key: K,
  next: CalculatorModuleInputs[K],
) => void;

type CalculatorModuleOverrideSetter = (
  key: keyof NonNullable<CalculatorModuleInputs['overrides']>,
  value: string,
) => void;

export type CalculatorStructureFieldBuilderInput = {
  activeModule: CalculatorModuleInputs;
  activeModuleIndex: number;
  activePergolaId: string;
  errors: Partial<Record<keyof CalculatorModuleInputs, string>>;
  resolvedDefaults: CalculatorResolvedDefaultTexts;
  flashingTileContent: ReactNode;
  additionalAluminiumTileContent?: ReactNode;
  setValues: Dispatch<SetStateAction<CalculatorInputs>>;
  setModuleField: CalculatorModuleFieldSetter;
  setModuleOverride: CalculatorModuleOverrideSetter;
};

function formatMaybeNumber(value: number | undefined, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function buildCalculatorStructureFields({
  activeModule,
  activeModuleIndex,
  activePergolaId,
  errors,
  resolvedDefaults,
  flashingTileContent,
  additionalAluminiumTileContent = null,
  setValues,
  setModuleField,
  setModuleOverride,
}: CalculatorStructureFieldBuilderInput): FieldSchemaItem[] {
  const isOpenPergola = activeModule.roofMaterial === 'none';
  const roofTypeForInputs = getRoofTypeForModule(activeModule);
  const roofSpanForInputsM = toNumber(activeModule.projectionM);
  const pitchForInputsDegRaw = toNumber(activeModule.roofPitchDeg);
  const defaultPitchForInputsDeg =
    roofTypeForInputs === 'low_gable'
      ? 10
      : roofTypeForInputs === 'gable' || roofTypeForInputs === 'hip' || roofTypeForInputs === 'hip_corner'
        ? 25
        : 5;
  const pitchForHintsDeg = Number.isFinite(pitchForInputsDegRaw)
    ? Math.max(0, Math.min(85, pitchForInputsDegRaw))
    : defaultPitchForInputsDeg;
  const cosForHints = Math.max(0.02, Math.cos((pitchForHintsDeg * Math.PI) / 180));

  const perSideSpanM =
    Number.isFinite(roofSpanForInputsM) && roofSpanForInputsM > 0 ? roofSpanForInputsM / 2 : NaN;
  const slopedDownslopePerSideM = perSideSpanM / cosForHints;

  const gableHintFields: FieldSchemaItem[] =
    roofTypeForInputs === 'gable' || roofTypeForInputs === 'low_gable'
      ? [
          {
            id: 'perSideSpanM',
            label: 'Per‑side span (m)',
            type: 'readOnly',
            value: formatMaybeNumber(perSideSpanM, 2),
            helperText: 'Gable: per-side span = roof span ÷ 2',
          },
          {
            id: 'slopedLengthPerSideM',
            label: 'Sloped length per side (m)',
            type: 'readOnly',
            value: Number.isFinite(slopedDownslopePerSideM)
              ? `${formatMaybeNumber(slopedDownslopePerSideM, 2)} (at ${pitchForHintsDeg.toFixed(0)}°)`
              : '—',
            helperText: 'Sloped length = (roof span ÷ 2) ÷ cos(pitch)',
          },
        ]
      : [];

  const moduleOverrides = activeModule.overrides ?? {};
  const boxPerimeterBeamProfileUsedUi = normalizeOverrideValue(moduleOverrides.boxPerimeterBeamProfile) ?? '300x50';
  const frontBeamOverride = normalizeOverrideValue(moduleOverrides.frontBeamProfile);
  const frontBeamProfileUsed = isOpenPergola
    ? frontBeamOverride ?? DEFAULT_OPEN_PERGOLA_PROFILE
    : frontBeamOverride ?? 'SP Gutter';
  const integratedGutterBeamUi = isGutterBeamProfile(frontBeamProfileUsed);
  const showSeparateGutterToggle =
    !isOpenPergola && !activeModule.boxPerimeterEnabled && !activeModule.overhangEnabled && !activeModule.invertedEnabled && !integratedGutterBeamUi;
  const gableGutterOptions =
    activeModule.houseConnectionType === 'none' ? [GABLE_GUTTER_OPTIONS[1]] : GABLE_GUTTER_OPTIONS;

  return [
    {
      id: 'pergolaStyle',
      label: 'Pergola style',
      type: 'select',
      value: activeModule.pergolaStyle,
      onChange: (v) => {
        const nextStyle = v as CalculatorModuleInputs['pergolaStyle'];
        setValues((prev) => {
          const modules = prev.modules.slice();
          const current = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
          modules[activeModuleIndex] = {
            ...current,
            pergolaStyle: nextStyle,
            ...(nextStyle === 'hip_corner' ? { boxPerimeterEnabled: false } : null),
          };
          return { ...prev, modules };
        });
      },
      options: [
        { label: 'Pitched', value: 'pitched' },
        { label: 'Gable', value: 'gable' },
        { label: 'Hip', value: 'hip' },
        { label: 'Hip (corner)', value: 'hip_corner' },
      ],
      helperText:
        isOpenPergola
          ? 'Open pergolas use the standard pitched frame.'
          : activeModule.pergolaStyle === 'gable' || activeModule.pergolaStyle === 'hip' || activeModule.pergolaStyle === 'hip_corner'
            ? 'v1 assumptions (check Details)'
            : undefined,
      disabled: isOpenPergola,
    },
    {
      id: 'boxPerimeterEnabled',
      label: 'Box perimeter',
      type: 'toggle',
      value: activeModule.boxPerimeterEnabled,
      onChange: (v) => setModuleField('boxPerimeterEnabled', Boolean(v)),
      disabled: isOpenPergola || activeModule.pergolaStyle === 'hip_corner',
      helperText:
        isOpenPergola
          ? 'Not available without roof covering.'
          : activeModule.pergolaStyle === 'hip_corner'
            ? 'Not supported for hip corner'
            : activeModule.boxPerimeterEnabled
              ? `Box beam = ${boxPerimeterBeamProfileUsedUi}`
              : undefined,
    },
    {
      id: 'roofMaterial',
      label: 'Roof material',
      type: 'select',
      value: activeModule.roofMaterial,
      onChange: (v) => {
        const next = v as CalculatorModuleInputs['roofMaterial'];
        setValues((prev) => {
          const modules = prev.modules.slice();
          const current = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
          const updated: CalculatorModuleInputs =
            next === 'none'
              ? applyOpenPergolaDefaults({ ...current, roofMaterial: next })
              : next === 'mixed'
                ? (() => {
                  const roofed = current.roofMaterial === 'none'
                    ? applyRoofedPergolaDefaults(current, next)
                    : { ...current, roofMaterial: next };
                  const bayCounts = computeBayCountsForModule(roofed);
                  const withDefault = (value: string | undefined, bayCount: number) =>
                    hasNonEmptyValue(value) ? value : defaultMixedAcrylicBays(bayCount);
                  return {
                    ...roofed,
                    ...(bayCounts.roofType === 'pitched'
                      ? { mixedAcrylicBaysMain: withDefault(roofed.mixedAcrylicBaysMain, bayCounts.bayCountMain) }
                      : {
                          mixedAcrylicBaysA: withDefault(roofed.mixedAcrylicBaysA, bayCounts.bayCountA),
                          mixedAcrylicBaysB: withDefault(roofed.mixedAcrylicBaysB, bayCounts.bayCountB),
                        }),
                  };
                  })()
                : current.roofMaterial === 'none'
                  ? applyRoofedPergolaDefaults(current, next)
                  : { ...current, roofMaterial: next };
          modules[activeModuleIndex] = updated;
          return {
            ...prev,
            modules,
          };
        });
      },
      options: [
        { label: 'Acrylic', value: 'acrylic' },
        { label: 'Timber', value: 'timber' },
        { label: 'Mixed (Acrylic + Timber)', value: 'mixed' },
        { label: 'Open / no roof covering', value: 'none' },
      ],
    },
    ...(isOpenPergola
      ? [
          {
            id: 'rafterSpacingMm',
            label: 'Rafter spacing (mm)',
            type: 'number',
            value: activeModule.rafterSpacingMm ?? DEFAULT_OPEN_PERGOLA_RAFTER_SPACING_MM,
            onChange: (v: string | boolean) => setModuleField('rafterSpacingMm', String(v)),
            min: 1,
            step: 1,
            error: errors.rafterSpacingMm,
            helperText: 'Target spacing; defaults to 500mm and has no upper cap.',
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...(activeModule.roofMaterial === 'mixed'
      ? [
          ...(computeBayCountsForModule(activeModule).roofType === 'pitched'
            ? [
                {
                  id: 'mixedAcrylicBaysMain',
                  label: 'Acrylic bays (main)',
                  type: 'number',
                  value: activeModule.mixedAcrylicBaysMain,
                  onChange: (v: string | boolean) => setModuleField('mixedAcrylicBaysMain', String(v)),
                  error: errors.mixedAcrylicBaysMain,
                  helperText: `0–${computeBayCountsForModule(activeModule).bayCountMain}`,
                } satisfies FieldSchemaItem,
              ]
            : computeBayCountsForModule(activeModule).roofType === 'hip_corner'
              ? [
                  {
                    id: 'mixedAcrylicBaysA',
                    label: 'Acrylic bays (leg A)',
                    type: 'number',
                    value: activeModule.mixedAcrylicBaysA,
                    onChange: (v: string | boolean) => setModuleField('mixedAcrylicBaysA', String(v)),
                    error: errors.mixedAcrylicBaysA,
                    helperText: `0–${computeBayCountsForModule(activeModule).bayCountA}`,
                  } satisfies FieldSchemaItem,
                  {
                    id: 'mixedAcrylicBaysB',
                    label: 'Acrylic bays (leg B)',
                    type: 'number',
                    value: activeModule.mixedAcrylicBaysB,
                    onChange: (v: string | boolean) => setModuleField('mixedAcrylicBaysB', String(v)),
                    error: errors.mixedAcrylicBaysB,
                    helperText: `0–${computeBayCountsForModule(activeModule).bayCountB}`,
                  } satisfies FieldSchemaItem,
                ]
              : [
                  {
                    id: 'mixedAcrylicBaysA',
                    label: 'Acrylic bays (side A)',
                    type: 'number',
                    value: activeModule.mixedAcrylicBaysA,
                    onChange: (v: string | boolean) => setModuleField('mixedAcrylicBaysA', String(v)),
                    error: errors.mixedAcrylicBaysA,
                    helperText: `0–${computeBayCountsForModule(activeModule).bayCountA}`,
                  } satisfies FieldSchemaItem,
                  {
                    id: 'mixedAcrylicBaysB',
                    label: 'Acrylic bays (side B)',
                    type: 'number',
                    value: activeModule.mixedAcrylicBaysB,
                    onChange: (v: string | boolean) => setModuleField('mixedAcrylicBaysB', String(v)),
                    error: errors.mixedAcrylicBaysB,
                    helperText: `0–${computeBayCountsForModule(activeModule).bayCountB}`,
                  } satisfies FieldSchemaItem,
                ]),
        ]
      : []),
    ...(activeModule.roofMaterial === 'timber' || activeModule.roofMaterial === 'mixed'
      ? [
          {
            id: 'timberSystemHeading',
            label: 'TIMBER SYSTEM (ceiling + roof above)',
            type: 'readOnly',
            value: '—',
          } satisfies FieldSchemaItem,
          {
            id: 'timberNoteRafters',
            label: 'Timber rafters',
            type: 'readOnly',
            value: 'Common rafters 80x50 @ max 500mm centres (mill finish)',
          } satisfies FieldSchemaItem,
          {
            id: 'timberNotePurlins',
            label: 'Purlins',
            type: 'readOnly',
            value: '50x50 @ max 500mm centres, first/last 100mm from eave + ridge (mill finish)',
          } satisfies FieldSchemaItem,
          {
            id: 'timberNoteEdgeRafters',
            label: 'Edge rafters',
            type: 'readOnly',
            value: '150x50 each side (match frame finish)',
          } satisfies FieldSchemaItem,
          {
            id: 'timberRoofAboveType',
            label: 'Roof above type',
            type: 'select',
            value: activeModule.timberRoofAboveType,
            onChange: (v) => setModuleField('timberRoofAboveType', v as CalculatorModuleInputs['timberRoofAboveType']),
            options: [
              { label: 'Insulated panels', value: 'insulated_panels' },
              { label: 'Steel corrugated', value: 'steel_corrugated' },
              { label: 'Steel tray', value: 'steel_tray' },
            ],
            error: errors.timberRoofAboveType,
          } satisfies FieldSchemaItem,
          ...(activeModule.timberRoofAboveType === 'insulated_panels'
            ? [
                {
                  id: 'timberInsulatedPanelThicknessMm',
                  label: 'Insulated panel thickness (mm)',
                  type: 'readOnly',
                  value: activeModule.timberInsulatedPanelThicknessMm,
                  error: errors.timberInsulatedPanelThicknessMm,
                } satisfies FieldSchemaItem,
              ]
            : []),
          ...(activeModule.timberRoofAboveType === 'steel_tray'
            ? [
                {
                  id: 'timberTrayWidthMm',
                  label: 'Steel tray width (mm)',
                  type: 'select',
                  value: activeModule.timberTrayWidthMm,
                  onChange: (v) => setModuleField('timberTrayWidthMm', String(v)),
                  options: [
                    { label: '400', value: '400' },
                    { label: '500', value: '500' },
                    { label: '600', value: '600' },
                  ],
                  error: errors.timberTrayWidthMm,
                } satisfies FieldSchemaItem,
              ]
            : []),
        ]
      : []),
    {
      id: 'extrusionColour',
      label: 'Extrusion colour',
      type: 'select',
      value: activeModule.extrusionColour,
      onChange: (v) => setModuleField('extrusionColour', v as CalculatorModuleInputs['extrusionColour']),
      options: [
        { label: 'Black', value: 'Black' },
        { label: 'White', value: 'White' },
        { label: 'Mill', value: 'Mill' },
      ],
    },
    ...(activeModule.extrusionColour === 'Mill'
      ? [
          {
            id: 'powdercoatStandardColour',
            label: 'Powdercoat colour',
            type: 'select',
            value: activeModule.powdercoatStandardColour ?? '',
            onChange: (v) => setModuleField('powdercoatStandardColour', String(v)),
            options: [
              { label: 'Select', value: '' },
              ...POWDERCOAT_STANDARD_COLOURS.map((colour) => ({ label: colour, value: colour })),
            ],
            disabled: Boolean(activeModule.powdercoatIsCustom),
            error: errors.powdercoatStandardColour,
          } satisfies FieldSchemaItem,
          {
            id: 'powdercoatIsCustom',
            label: 'Custom powdercoat colour',
            type: 'toggle',
            value: Boolean(activeModule.powdercoatIsCustom),
            onChange: (v) => setModuleField('powdercoatIsCustom', Boolean(v)),
          } satisfies FieldSchemaItem,
          ...(activeModule.powdercoatIsCustom
            ? [
                {
                  id: 'powdercoatCustomColour',
                  label: 'Custom powdercoat colour name',
                  type: 'text',
                  value: activeModule.powdercoatCustomColour ?? '',
                  onChange: (v) => setModuleField('powdercoatCustomColour', String(v)),
                  error: errors.powdercoatCustomColour,
                } satisfies FieldSchemaItem,
              ]
            : []),
        ]
      : []),

    {
      id: 'lengthM',
      label: isOpenPergola
        ? 'Pergola length (m)'
        : activeModule.pergolaStyle === 'hip_corner'
          ? 'Roof Length A (m)'
          : 'Roof Length (m)',
      type: 'number',
      value: activeModule.lengthM,
      onChange: (v) => setModuleField('lengthM', String(v)),
      error: errors.lengthM,
      helperText: isOpenPergola
        ? 'Frame length parallel to the front beam.'
        : 'Roof Length: dimension parallel to the ridge / gutter.',
    },
    {
      id: 'projectionM',
      label: isOpenPergola
        ? 'Pergola projection (m)'
        : activeModule.pergolaStyle === 'hip_corner'
          ? 'Roof Span A (m)'
          : 'Roof Span (Eave‑to‑Eave) (m)',
      type: 'number',
      value: activeModule.projectionM,
      onChange: (v) => setModuleField('projectionM', String(v)),
      error: errors.projectionM,
      helperText: isOpenPergola
        ? 'Frame projection from the house/support edge to the front beam.'
        : 'Roof Span (Eave‑to‑Eave): total width across the roof (both sides for gable, single slope for pitched).',
    },
    ...(activeModule.pergolaStyle === 'hip_corner'
      ? [
          {
            id: 'hipCornerLengthBM',
            label: 'Roof Length B (m)',
            type: 'number',
            value: activeModule.hipCornerLengthBM,
            onChange: (v: string | boolean) => setModuleField('hipCornerLengthBM', String(v)),
            error: errors.hipCornerLengthBM,
          } satisfies FieldSchemaItem,
          {
            id: 'hipCornerProjectionBM',
            label: 'Roof Span B (m)',
            type: 'number',
            value: activeModule.hipCornerProjectionBM,
            onChange: (v: string | boolean) => setModuleField('hipCornerProjectionBM', String(v)),
            error: errors.hipCornerProjectionBM,
          } satisfies FieldSchemaItem,
        ]
      : []),
    {
      id: 'roofPitchDeg',
      label: 'Roof pitch (deg)',
      type: 'number',
      value: isOpenPergola ? '0' : activeModule.roofPitchDeg,
      onChange: (v) => setModuleField('roofPitchDeg', String(v)),
      error: errors.roofPitchDeg,
      resolvedDefaultText: isOpenPergola ? undefined : resolvedDefaults.roofPitchDeg,
      helperText: isOpenPergola
        ? 'Fixed at 0° for an open pergola.'
        : activeModule.boxPerimeterEnabled
          ? 'Auto-computed for box perimeter'
          : activeModule.roofPitchDeg.trim()
            ? 'Overrides default pitch for roof type'
            : 'Blank = default pitch',
      disabled: isOpenPergola || activeModule.boxPerimeterEnabled,
    },
    ...(!isOpenPergola
      ? [
          {
            id: 'flashings',
            label: 'Flashings',
            type: 'custom',
            content: flashingTileContent,
            error: errors.flashings,
          } satisfies FieldSchemaItem,
        ]
      : []),
    {
      id: 'additionalAluminium',
      label: 'Additional aluminium',
      type: 'custom',
      content: additionalAluminiumTileContent,
      error: errors.additionalAluminium,
    },
    ...(activeModule.pergolaStyle === 'gable'
      ? [
          {
            id: 'gableEndFramesMode',
            label: 'Gable end frames',
            type: 'select',
            value: activeModule.gableEndFramesMode,
            onChange: (v) => setModuleField('gableEndFramesMode', v as CalculatorModuleInputs['gableEndFramesMode']),
            options: GABLE_END_FRAME_OPTIONS,
            helperText: 'Adds tie beam + king-post strut at selected gable end(s).',
          } satisfies FieldSchemaItem,
          {
            id: 'gableHouseEdgeGutter',
            label: 'House-side eave gutter',
            type: 'select',
            value: activeModule.gableHouseEdgeGutter,
            onChange: (v) => setModuleField('gableHouseEdgeGutter', v as CalculatorModuleInputs['gableHouseEdgeGutter']),
            options: gableGutterOptions,
            helperText: 'Choose whether the house-side eave uses house gutter or our SP gutter support.',
          } satisfies FieldSchemaItem,
          {
            id: 'gableOuterEdgeGutter',
            label: 'Outer-side eave gutter',
            type: 'select',
            value: activeModule.gableOuterEdgeGutter,
            onChange: (v) => setModuleField('gableOuterEdgeGutter', v as CalculatorModuleInputs['gableOuterEdgeGutter']),
            options: gableGutterOptions,
            helperText: 'Choose whether the outer eave uses house gutter or our SP gutter support.',
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...(!isOpenPergola && roofTypeForInputs === 'pitched' && !activeModule.boxPerimeterEnabled
      ? [
          {
            id: 'invertedEnabled',
            label: 'Inverted (toward house)',
            type: 'toggle',
            value: activeModule.invertedEnabled,
            onChange: (v: string | boolean) => setModuleField('invertedEnabled', Boolean(v)),
            error: errors.invertedEnabled,
            helperText: 'Flip slope so fall runs toward the house',
          } satisfies FieldSchemaItem,
          ...(activeModule.invertedEnabled
            ? [
                {
                  id: 'invertedHouseGutter',
                  label: 'Use house gutter?',
                  type: 'toggle',
                  value: activeModule.invertedHouseGutter,
                  onChange: (v: string | boolean) => setModuleField('invertedHouseGutter', Boolean(v)),
                  helperText: activeModule.invertedHouseGutter
                    ? 'No gutter supplied by us (house gutter only)'
                    : 'Use SP gutter at house edge',
                } satisfies FieldSchemaItem,
              ]
            : []),
        ]
      : []),
    ...(!isOpenPergola && !activeModule.boxPerimeterEnabled
      ? [
          {
            id: 'overhangEnabled',
            label: 'Overhang',
            type: 'toggle',
            value: activeModule.overhangEnabled,
            onChange: (v: string | boolean) => setModuleField('overhangEnabled', Boolean(v)),
            error: errors.overhangEnabled,
            helperText: 'Add overhang support beam + end stringer',
          } satisfies FieldSchemaItem,
          ...(activeModule.overhangEnabled
            ? [
                {
                  id: 'overhangAmountM',
                  label: 'Overhang amount (m)',
                  type: 'number',
                  value: activeModule.overhangAmountM,
                  onChange: (v: string | boolean) => setModuleField('overhangAmountM', String(v)),
                  error: errors.overhangAmountM,
                  helperText: 'Overhang is within the roof footprint (L×W unchanged). It moves the post beam inboard.',
                } satisfies FieldSchemaItem,
              ]
            : []),
        ]
      : []),
    ...(activeModule.boxPerimeterEnabled
      ? [
          {
            id: 'boxPerimeterBeamProfileOverride',
            label: 'Box perimeter beam override',
            type: 'select',
            value: moduleOverrides.boxPerimeterBeamProfile ?? '',
            onChange: (v) => setModuleOverride('boxPerimeterBeamProfile', String(v)),
            options: BOX_BEAM_PROFILE_OPTIONS,
            helperText: 'Overrides box perimeter beam profile (default 300x50)',
          } satisfies FieldSchemaItem,
        ]
      : []),
    {
      id: 'ledgerProfileOverride',
      label: 'Ledger override',
      type: 'select',
      value: isOpenPergola ? moduleOverrides.ledgerProfile ?? DEFAULT_OPEN_PERGOLA_PROFILE : moduleOverrides.ledgerProfile ?? '',
      onChange: (v) => setModuleOverride('ledgerProfile', String(v)),
      options: isOpenPergola ? OPEN_PERGOLA_PROFILE_OPTIONS : LEDGER_PROFILE_OPTIONS,
      helperText: isOpenPergola ? 'Defaults to 150x50; select any 50mm-wide profile.' : 'Override ledger/stringer profile',
    },
    {
      id: 'rafterProfileOverride',
      label: 'Rafter override',
      type: 'select',
      value: isOpenPergola ? moduleOverrides.rafterProfile ?? DEFAULT_OPEN_PERGOLA_PROFILE : moduleOverrides.rafterProfile ?? '',
      onChange: (v) => setModuleOverride('rafterProfile', String(v)),
      options: isOpenPergola ? OPEN_PERGOLA_PROFILE_OPTIONS : RAFTER_PROFILE_OPTIONS,
      helperText: isOpenPergola ? 'Defaults to 150x50; select any 50mm-wide profile.' : 'Override auto rafter profile selection',
    },
    {
      id: 'postProfileOverride',
      label: 'Post override',
      type: 'select',
      value: moduleOverrides.postProfile ?? '',
      onChange: (v) => setModuleOverride('postProfile', String(v)),
      options: POST_PROFILE_OPTIONS,
      helperText: 'Override post profile (default 100x100)',
    },
    ...(!activeModule.boxPerimeterEnabled
      ? [
          {
            id: 'frontBeamProfileOverride',
            label: 'Front beam override',
            type: 'select',
            value: isOpenPergola ? moduleOverrides.frontBeamProfile ?? DEFAULT_OPEN_PERGOLA_PROFILE : moduleOverrides.frontBeamProfile ?? '',
            onChange: (v) => setModuleOverride('frontBeamProfile', String(v)),
            options: isOpenPergola ? OPEN_PERGOLA_PROFILE_OPTIONS : FRONT_BEAM_PROFILE_OPTIONS,
            helperText: isOpenPergola
              ? 'Defaults to 150x50; select any 50mm-wide profile.'
              : integratedGutterBeamUi
                ? 'SP gutter selected = integrated gutter beam'
                : 'Select a non‑gutter beam to allow a separate gutter',
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...(roofTypeForInputs === 'gable' || roofTypeForInputs === 'low_gable' || roofTypeForInputs === 'hip'
      ? [
          {
            id: 'ridgeBeamProfileOverride',
            label: 'Ridge beam override',
            type: 'select',
            value: moduleOverrides.ridgeBeamProfile ?? '',
            onChange: (v) => setModuleOverride('ridgeBeamProfile', String(v)),
            options: RIDGE_BEAM_PROFILE_OPTIONS,
            helperText: 'Overrides ridge beam profile when applicable',
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...(activeModule.pergolaStyle === 'gable'
      ? [
          {
            id: 'tieBeamProfileOverride',
            label: 'Tie beam override',
            type: 'select',
            value: moduleOverrides.tieBeamProfile ?? '',
            onChange: (v) => setModuleOverride('tieBeamProfile', String(v)),
            options: FRONT_BEAM_PROFILE_OPTIONS,
            helperText: 'Overrides tie beam profile when applicable',
          } satisfies FieldSchemaItem,
          {
            id: 'strutProfileOverride',
            label: 'King-post strut override',
            type: 'select',
            value: moduleOverrides.strutProfile ?? '',
            onChange: (v) => setModuleOverride('strutProfile', String(v)),
            options: STRUT_PROFILE_OPTIONS,
            helperText: 'Overrides king-post strut profile when applicable',
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...(activeModule.overhangEnabled
      ? [
          {
            id: 'overhangSupportBeamProfile',
            label: 'Overhang support beam profile',
            type: 'select',
            value: activeModule.overhangSupportBeamProfile,
            onChange: (v: string | boolean) =>
              setModuleField('overhangSupportBeamProfile', v as CalculatorModuleInputs['overhangSupportBeamProfile']),
            options: [
              { label: '150x50', value: '150x50' },
              { label: '200x50', value: '200x50' },
              { label: 'Steel RHS 150x50x3', value: 'RHS 150x50x3' },
            ],
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...(showSeparateGutterToggle
      ? [
          {
            id: 'separateGutterEnabled',
            label: 'Separate gutter (100x100 cut)',
            type: 'toggle',
            value: activeModule.separateGutterEnabled,
            onChange: (v: string | boolean) => setModuleField('separateGutterEnabled', Boolean(v)),
            helperText: 'Adds separate 100x100 cut‑down gutter (stock doubled for waste)',
          } satisfies FieldSchemaItem,
        ]
      : []),
    ...gableHintFields,
    {
      id: 'postCutHeightM',
      label: 'Ledger underside height (m)',
      type: 'number',
      value: activeModule.postCutHeightM,
      onChange: (v) => setModuleField('postCutHeightM', String(v)),
      error: errors.postCutHeightM,
      helperText: 'Clear height to underside of ledger',
    },
    { id: 'postCount', label: 'Post count', type: 'number', value: activeModule.postCount, onChange: (v) => setModuleField('postCount', String(v)), error: errors.postCount },

  ];
}
