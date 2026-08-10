import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  isCalculatorInputsV2,
  isLegacyCalculatorInputsV1,
  migrateLegacyCalculatorInputsToV2,
  normalizeBlindsState,
} from '@/lib/types/calculator';
import { isRecord } from '@/lib/supabase/mappers';
import type { RunningJobStatusValue } from './types';

export type RunningJobsEstimateLite = {
  id: string;
  project_id: string;
  status: string | null;
  created_at: string | null;
  version: number | null;
  inputs: unknown;
  outputs: unknown;
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDimension(value: unknown): string | null {
  const numeric = toNumber(value);
  if (numeric === null) return null;
  const rounded = Math.round(numeric * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (match) => match.toUpperCase())
    .trim();
}

function normalizeCalculatorInputs(inputs: unknown): CalculatorInputs | null {
  if (isCalculatorInputsV2(inputs)) return inputs;
  if (isLegacyCalculatorInputsV1(inputs)) return migrateLegacyCalculatorInputsToV2(inputs);
  return null;
}

function getFirstModule(inputs: CalculatorInputs | null): CalculatorModuleInputs | null {
  if (!inputs || !Array.isArray(inputs.modules)) return null;
  return inputs.modules[0] ?? null;
}

function isMeaningfulBlindItem(item: {
  label?: string;
  system?: string;
  fabric?: string;
  motorised?: string | boolean | null;
  widthMm?: unknown;
  coverLengthMm?: unknown;
}): boolean {
  const hasLabel = typeof item.label === 'string' && item.label.trim().length > 0;
  const width = toNumber(item.widthMm);
  const cover = toNumber(item.coverLengthMm);
  const hasWidth = width !== null && width > 0;
  const hasCover = cover !== null && cover > 0;

  const system = typeof item.system === 'string' ? item.system.toUpperCase() : 'ZIPTRAK';
  const fabric = typeof item.fabric === 'string' ? item.fabric.toUpperCase() : 'MESH';
  const motorisedRaw = typeof item.motorised === 'string' ? item.motorised.toUpperCase() : item.motorised ? 'YES' : 'NONE';
  const hasNonDefault = system !== 'ZIPTRAK' || (fabric !== 'MESH' && fabric !== 'NONE') || motorisedRaw === 'YES';

  return hasLabel || hasWidth || hasCover || hasNonDefault;
}

function normalizeEstimateStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeLightsStatus(value: unknown): RunningJobStatusValue | null {
  if (value === 'No' || value === 'Yes' || value === 'TBC') return value;
  return null;
}

function extractEstimateSnapshotContactName(row: RunningJobsEstimateLite | null): string {
  if (!row || !isRecord(row.outputs)) return '';
  const snapshot = isRecord((row.outputs as any).snapshot) ? ((row.outputs as any).snapshot as Record<string, unknown>) : null;
  const contact = snapshot && isRecord(snapshot.contact) ? (snapshot.contact as Record<string, unknown>) : null;
  return typeof contact?.displayName === 'string' ? contact.displayName.trim() : '';
}

function derivePergolaType(module: CalculatorModuleInputs | null, inputs: CalculatorInputs | null): string | null {
  if (!module) return null;
  let label = 'Pitched Pergola';

  switch (module.pergolaStyle) {
    case 'gable':
      label = module.houseConnectionType === 'none' ? 'Freestanding Gable' : 'Gable Pergola';
      break;
    case 'hip':
      label = 'Hipped Pergola';
      break;
    case 'hip_corner':
      label = 'Hipped Corner Pergola';
      break;
    case 'pitched':
    default:
      label = module.invertedEnabled ? 'Inverted Pitched' : 'Pitched Pergola';
      break;
  }

  return inputs?.jobType === 'commercial' ? `Commercial ${label}` : label;
}

function deriveSizeText(module: CalculatorModuleInputs | null): string | null {
  if (!module) return null;
  const lengthA = formatDimension(module.lengthM);
  const spanA = formatDimension(module.projectionM);
  if (!lengthA || !spanA) return null;

  if (module.pergolaStyle === 'hip_corner') {
    const lengthB = formatDimension(module.hipCornerLengthBM);
    const spanB = formatDimension(module.hipCornerProjectionBM);
    if (!lengthB || !spanB) return null;
    return `A:${lengthA}x${spanA} B:${lengthB}x${spanB}m`;
  }

  return `${lengthA}x${spanA}m`;
}

function deriveColourText(module: CalculatorModuleInputs | null): string | null {
  if (!module) return null;
  if (module.powdercoatIsCustom) {
    const custom = typeof module.powdercoatCustomColour === 'string' ? module.powdercoatCustomColour.trim() : '';
    return custom || 'Custom';
  }
  if (module.extrusionColour === 'Mill') {
    const powdercoat = typeof module.powdercoatStandardColour === 'string' ? module.powdercoatStandardColour.trim() : '';
    return powdercoat || 'Mill';
  }
  return typeof module.extrusionColour === 'string' ? module.extrusionColour : null;
}

function deriveRoofingText(_row: RunningJobsEstimateLite | null, module: CalculatorModuleInputs | null): string | null {
  if (!module) return null;

  switch (module.roofMaterial) {
    case 'acrylic':
      return 'Acrylic';
    case 'timber':
      return 'Timber';
    case 'mixed':
      return 'Combination';
    case 'none':
      return 'No roof covering';
    default:
      return toTitleCase(module.roofMaterial);
  }
}

export function deriveCrewShortCode(shortCode: unknown, name: unknown): string | null {
  if (typeof shortCode === 'string' && shortCode.trim()) return shortCode.trim();

  const normalizedName = typeof name === 'string' ? name.trim().toLowerCase() : '';
  switch (normalizedName) {
    case 'alistair':
      return 'AW';
    case 'jayden':
      return 'JW';
    case 'jesse':
      return 'JI';
    case 'jordan':
      return 'JB';
    case 'steve':
      return 'SC';
    case 'bruce':
      return 'BB';
    case 'david':
      return 'DH';
    default:
      return null;
  }
}

export function getLatestRunningJobsEstimate(estimates: RunningJobsEstimateLite[]): RunningJobsEstimateLite | null {
  const schedulable = estimates.filter((estimate) => normalizeEstimateStatus(estimate.status) !== 'archived');
  if (!schedulable.length) return null;

  schedulable.sort(
    (a, b) =>
      (typeof b.version === 'number' ? b.version : 0) - (typeof a.version === 'number' ? a.version : 0) ||
      String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
  );

  return schedulable[0] ?? null;
}

export function deriveRunningJobFields(
  estimate: RunningJobsEstimateLite | null,
  manualLightsStatus?: RunningJobStatusValue | null,
): {
  snapshotContactName: string;
  derived: {
    pergola_type: string | null;
    lights_status: RunningJobStatusValue;
    blinds_status: RunningJobStatusValue;
    size_text: string | null;
    colour_text: string | null;
    roofing_text: string | null;
  };
  effectiveLightsStatus: RunningJobStatusValue;
} {
  const inputs = normalizeCalculatorInputs(estimate?.inputs ?? null);
  const module = getFirstModule(inputs);
  const blindsState = normalizeBlindsState((inputs as any)?.blinds);
  const blindItems = (blindsState?.items ?? []).filter((item) => isMeaningfulBlindItem(item as any));

  const derivedLights = 'TBC' as RunningJobStatusValue;
  const effectiveLightsStatus = normalizeLightsStatus(manualLightsStatus) ?? derivedLights;

  return {
    snapshotContactName: extractEstimateSnapshotContactName(estimate),
    derived: {
      pergola_type: derivePergolaType(module, inputs),
      lights_status: derivedLights,
      blinds_status: estimate ? (blindItems.length ? 'Yes' : 'No') : 'TBC',
      size_text: deriveSizeText(module),
      colour_text: deriveColourText(module),
      roofing_text: deriveRoofingText(estimate, module),
    },
    effectiveLightsStatus,
  };
}
