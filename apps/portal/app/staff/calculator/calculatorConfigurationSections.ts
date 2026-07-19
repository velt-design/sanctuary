import type { ReactNode } from 'react';

import type { FieldOption, FieldTileType } from './FieldTile';

export type CalculatorConfigurationField = {
  id: string;
  label: string;
  type: FieldTileType;
  value?: string | boolean;
  content?: ReactNode;
  onChange?: (next: string | boolean) => void;
  options?: FieldOption[];
  disabled?: boolean;
  helperText?: string;
  error?: string;
  onAction?: () => void;
  actionLabel?: string;
};

export type CalculatorConfigurationFieldLayout = 'standard' | 'wide' | 'full';
type CalculatorConfigurationSectionDensity = 'default' | 'compact';
type CalculatorConfigurationSectionSurface = 'quiet' | 'card';

type CalculatorConfigurationSectionDefinition = {
  id: string;
  title: string;
  density?: CalculatorConfigurationSectionDensity;
  surface?: CalculatorConfigurationSectionSurface;
  fieldLabelAsTitle?: boolean;
  advancedOnly?: boolean;
  fieldIds: readonly string[];
};

type CalculatorConfigurationSection = CalculatorConfigurationSectionDefinition & {
  fields: Array<CalculatorConfigurationField & { layout: CalculatorConfigurationFieldLayout }>;
};

export const CALCULATOR_CONFIGURATION_SECTIONS = [
  {
    id: 'context',
    title: 'Context',
    density: 'compact',
    fieldIds: ['project-context', 'draft-notice'],
  },
  {
    id: 'connections-site',
    title: 'Connections & Site',
    fieldIds: ['houseConnectionType', 'postConnectionType', 'ground', 'access', 'height', 'jobType'],
  },
  {
    id: 'structure',
    title: 'Structure',
    fieldIds: [
      'pergolaStyle',
      'boxPerimeterEnabled',
      'roofMaterial',
      'mixedAcrylicBaysMain',
      'mixedAcrylicBaysA',
      'mixedAcrylicBaysB',
      'timberSystemHeading',
      'timberNoteRafters',
      'timberNotePurlins',
      'timberNoteEdgeRafters',
      'timberRoofAboveType',
      'timberInsulatedPanelThicknessMm',
      'timberTrayWidthMm',
      'extrusionColour',
      'powdercoatStandardColour',
      'powdercoatIsCustom',
      'powdercoatCustomColour',
      'lengthM',
      'projectionM',
      'hipCornerLengthBM',
      'hipCornerProjectionBM',
      'roofPitchDeg',
      'gableEndFramesMode',
      'gableHouseEdgeGutter',
      'gableOuterEdgeGutter',
      'invertedEnabled',
      'invertedHouseGutter',
      'overhangEnabled',
      'overhangAmountM',
      'perSideSpanM',
      'slopedLengthPerSideM',
      'postCutHeightM',
      'postCount',
      'boxPitchDeg',
      'boxRiseMm',
      'boxGutterHouseEdge',
      'boxGutterFarEdge',
      'downpipeCount',
      'downpipeJoinCount',
      'downpipeElbowCount',
    ],
  },
  {
    id: 'flashings',
    title: 'Flashings',
    advancedOnly: true,
    fieldIds: ['flashings'],
  },
  {
    id: 'overrides',
    title: 'Overrides',
    advancedOnly: true,
    fieldIds: [
      'ledgerProfileOverride',
      'rafterProfileOverride',
      'postProfileOverride',
      'frontBeamProfileOverride',
      'ridgeBeamProfileOverride',
      'tieBeamProfileOverride',
      'strutProfileOverride',
      'boxPerimeterBeamProfileOverride',
      'overhangSupportBeamProfile',
      'separateGutterEnabled',
    ],
  },
  {
    id: 'blinds',
    title: 'Blinds',
    surface: 'card',
    fieldLabelAsTitle: true,
    fieldIds: ['blindsList'],
  },
  {
    id: 'infills',
    title: 'Infills',
    surface: 'card',
    fieldLabelAsTitle: true,
    fieldIds: ['infillsEditor'],
  },
  {
    id: 'allowances',
    title: 'Allowances',
    fieldIds: ['travelExGst', 'extrasAllowanceExGst', 'quoteDiscountPct'],
  },
  {
    id: 'house-footprint',
    title: 'House Footprint',
    advancedOnly: true,
    fieldIds: [
      'attachmentSide',
      'drawingRotationQuarterTurns',
      'houseFootprintPreset',
      'houseFootprintBandDepthM',
      'houseFootprintReturnRunM',
      'houseFootprintRecessWidthM',
      'houseFootprintRecessDepthM',
      'houseFootprintLeftLegRunM',
      'houseFootprintRightLegRunM',
      'houseFootprintSideRunM',
    ],
  },
] as const satisfies readonly CalculatorConfigurationSectionDefinition[];

const WIDE_FIELD_IDS = new Set([
  'timberSystemHeading',
  'timberNoteRafters',
  'timberNotePurlins',
  'timberNoteEdgeRafters',
]);

const FULL_FIELD_IDS = new Set(['flashings', 'blindsList', 'infillsEditor']);

export function calculatorConfigurationFieldLayout(fieldId: string): CalculatorConfigurationFieldLayout {
  if (FULL_FIELD_IDS.has(fieldId)) return 'full';
  if (WIDE_FIELD_IDS.has(fieldId)) return 'wide';
  return 'standard';
}

export function buildCalculatorConfigurationSections(
  fields: readonly CalculatorConfigurationField[],
  isAdvancedUi: boolean,
): CalculatorConfigurationSection[] {
  const fieldsById = new Map(fields.map((field) => [field.id, field]));

  return CALCULATOR_CONFIGURATION_SECTIONS.filter(
    (section) => !('advancedOnly' in section) || !section.advancedOnly || isAdvancedUi,
  )
    .map((section) => ({
      ...section,
      fields: section.fieldIds.flatMap((fieldId) => {
        const field = fieldsById.get(fieldId);
        return field ? [{ ...field, layout: calculatorConfigurationFieldLayout(fieldId) }] : [];
      }),
    }))
    .filter((section) => section.fields.length > 0);
}
