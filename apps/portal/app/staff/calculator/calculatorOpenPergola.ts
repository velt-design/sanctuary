import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { makeDefaultFlashings } from './calculatorFlashings';

export const DEFAULT_OPEN_PERGOLA_RAFTER_SPACING_MM = '500';
export const DEFAULT_OPEN_PERGOLA_PROFILE = '150x50';
export const OPEN_PERGOLA_50MM_PROFILE_VALUES = [
  '50x50',
  '80x50',
  '100x50',
  '150x50',
  '200x50',
  '250x50',
  '300x50',
] as const;

type RoofedMaterial = Exclude<CalculatorModuleInputs['roofMaterial'], 'none'>;

const OPEN_FRAME_OVERRIDE_KEYS = new Set(['ledgerProfile', 'rafterProfile', 'frontBeamProfile']);

function normalizeOpenPergolaProfile(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized && (OPEN_PERGOLA_50MM_PROFILE_VALUES as readonly string[]).includes(normalized)
    ? normalized
    : DEFAULT_OPEN_PERGOLA_PROFILE;
}

export function applyOpenPergolaDefaults(module: CalculatorModuleInputs): CalculatorModuleInputs {
  if (module.roofMaterial !== 'none') return module;
  const overrides = module.overrides ?? {};
  return {
    ...module,
    pergolaStyle: 'pitched',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '0',
    rafterSpacingMm: module.rafterSpacingMm?.trim() || DEFAULT_OPEN_PERGOLA_RAFTER_SPACING_MM,
    boxGutterHouseEdge: 'none',
    boxGutterFarEdge: 'none',
    downpipeCount: '0',
    downpipeJoinCount: '0',
    downpipeElbowCount: '0',
    separateGutterEnabled: false,
    overhangEnabled: false,
    invertedEnabled: false,
    invertedHouseGutter: false,
    flashings: { rows: [] },
    overrides: {
      ...overrides,
      ledgerProfile: normalizeOpenPergolaProfile(overrides.ledgerProfile),
      rafterProfile: normalizeOpenPergolaProfile(overrides.rafterProfile),
      frontBeamProfile: normalizeOpenPergolaProfile(overrides.frontBeamProfile),
    },
  };
}

export function applyRoofedPergolaDefaults(
  module: CalculatorModuleInputs,
  roofMaterial: RoofedMaterial,
): CalculatorModuleInputs {
  const preservedOverrides = Object.fromEntries(
    Object.entries(module.overrides ?? {}).filter(([key]) => !OPEN_FRAME_OVERRIDE_KEYS.has(key)),
  ) as NonNullable<CalculatorModuleInputs['overrides']>;
  const roofed: CalculatorModuleInputs = {
    ...module,
    roofMaterial,
    pergolaStyle: 'pitched',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '',
    rafterSpacingMm: DEFAULT_OPEN_PERGOLA_RAFTER_SPACING_MM,
    gableEndFramesMode: 'outer_end_only',
    gableHouseEdgeGutter: 'house',
    gableOuterEdgeGutter: 'our',
    boxGutterHouseEdge: 'house',
    boxGutterFarEdge: 'our',
    downpipeCount: '0',
    downpipeJoinCount: '0',
    downpipeElbowCount: '0',
    separateGutterEnabled: false,
    overhangEnabled: false,
    overhangAmountM: '0.2',
    overhangSupportBeamProfile: '150x50',
    invertedEnabled: false,
    invertedHouseGutter: true,
    mixedSkylightStripCount: '1',
    mixedSkylightStripWidthM: '0.62',
    mixedAcrylicBaysMain: '',
    mixedAcrylicBaysA: '',
    mixedAcrylicBaysB: '',
    timberRoofAboveType: 'insulated_panels',
    timberInsulatedPanelThicknessMm: '50',
    timberTrayWidthMm: '500',
    flashings: { rows: [] },
    overrides: preservedOverrides,
  };
  return {
    ...roofed,
    flashings: makeDefaultFlashings(roofed),
  };
}
