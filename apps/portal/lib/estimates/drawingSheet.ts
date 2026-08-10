import type { CalculatorModuleInputs, LegacyCalculatorInputsV1 } from '@/lib/types/calculator';

type EstimateDrawingSheetView = 'plan' | 'section';

const ESTIMATE_DRAWING_FIXED_SCALE_VALUES = [10, 20, 25, 50, 100] as const;

export type EstimateDrawingFixedScaleValue = (typeof ESTIMATE_DRAWING_FIXED_SCALE_VALUES)[number];

export type EstimateDrawingScale = { mode: 'fit' } | { mode: 'fixed'; ratio: EstimateDrawingFixedScaleValue };

type EstimateDrawingSheetInfoRow = {
  label: string;
  value: string;
};

export type EstimateDrawingSheetMeta = {
  moduleTitle: string;
  drawingTitle: string;
  siteAddress: string;
  sheetCode: string;
  revision: string;
  scale: EstimateDrawingScale;
  date: string;
  client: string;
  issue: string;
  note: string;
  moduleInfoRows: EstimateDrawingSheetInfoRow[];
};

type BuildEstimateDrawingSheetMetaInput = {
  moduleLabel?: string | null;
  sheetLabel?: string | null;
  moduleTitleOverride?: string | null;
  sheetTitleOverride?: string | null;
  noteOverride?: string | null;
  moduleInfoRows?: EstimateDrawingSheetInfoRow[];
  sheetInfoRows?: EstimateDrawingSheetInfoRow[];
  view: EstimateDrawingSheetView;
  versionLabel?: string | null;
  estimateDate?: string | null;
  projectName?: string | null;
  siteAddress?: string | null;
  clientName?: string | null;
};

export const DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE = 'Do not scale off portal preview. Verify all dimensions on site.';

export const DEFAULT_ESTIMATE_DRAWING_SCALE: EstimateDrawingScale = { mode: 'fit' };

export function formatEstimateDrawingScale(scale: EstimateDrawingScale): string {
  return scale.mode === 'fit' ? 'NTS' : `1:${scale.ratio}`;
}

export function estimateDrawingScaleKey(scale: EstimateDrawingScale): string {
  return scale.mode === 'fit' ? 'fit' : `1:${scale.ratio}`;
}

export function parseEstimateDrawingScaleKey(value: string): EstimateDrawingScale {
  if (value === 'fit') return DEFAULT_ESTIMATE_DRAWING_SCALE;
  const match = value.match(/^1:(10|20|25|50|100)$/);
  if (!match) return DEFAULT_ESTIMATE_DRAWING_SCALE;
  return { mode: 'fixed', ratio: Number(match[1]) as EstimateDrawingFixedScaleValue };
}

export function getEstimateDrawingScaleOptions(view: EstimateDrawingSheetView): EstimateDrawingScale[] {
  if (view === 'section') {
    return [
      DEFAULT_ESTIMATE_DRAWING_SCALE,
      { mode: 'fixed', ratio: 10 },
      { mode: 'fixed', ratio: 20 },
      { mode: 'fixed', ratio: 25 },
      { mode: 'fixed', ratio: 50 },
    ];
  }

  return [
    DEFAULT_ESTIMATE_DRAWING_SCALE,
    { mode: 'fixed', ratio: 20 },
    { mode: 'fixed', ratio: 25 },
    { mode: 'fixed', ratio: 50 },
    { mode: 'fixed', ratio: 100 },
  ];
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatSheetDate(value: string | null | undefined): string {
  const trimmed = trimOrNull(value);
  if (!trimmed) return '-';
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) return '-';
  return new Intl.DateTimeFormat('en-NZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (match) => match.toUpperCase())
    .trim();
}

function formatDimensionValue(value: string | null | undefined): string | null {
  const trimmed = trimOrNull(value);
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return trimmed;
  const rounded = Math.round(parsed * 100) / 100;
  const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${display}m`;
}

function formatSizeLabel(length: string | null | undefined, projection: string | null | undefined): string | null {
  const formattedLength = formatDimensionValue(length);
  const formattedProjection = formatDimensionValue(projection);
  if (!formattedLength && !formattedProjection) return null;
  return `${formattedLength ?? '—'} x ${formattedProjection ?? '—'}`;
}

function formatRoofMaterialLabel(value: string | null | undefined): string | null {
  const trimmed = trimOrNull(value);
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  if (normalized === 'none') return 'No roof covering';
  if ((normalized.includes('acrylic') && normalized.includes('timber')) || normalized.includes('mixed') || normalized.includes('comb')) {
    return 'Combination';
  }
  return toTitleCase(trimmed);
}

function formatCountValue(value: string | null | undefined): string | null {
  const trimmed = trimOrNull(value);
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return trimmed;
  return Number.isInteger(parsed) ? String(parsed) : String(Math.round(parsed * 100) / 100);
}

function formatOverhangValue(module: { overhangEnabled?: boolean; overhangAmountM?: string }): string | null {
  if (!module.overhangEnabled) return null;
  return formatDimensionValue(module.overhangAmountM) ?? 'Enabled';
}

export function buildEstimateDrawingModuleInfoRows(
  module: CalculatorModuleInputs | LegacyCalculatorInputsV1 | null | undefined,
): EstimateDrawingSheetInfoRow[] {
  if (!module) return [];

  const rows: EstimateDrawingSheetInfoRow[] = [
    { label: 'Style', value: trimOrNull(module.pergolaStyle) ? toTitleCase(module.pergolaStyle) : '—' },
    { label: 'Roof material', value: formatRoofMaterialLabel(module.roofMaterial) ?? '—' },
    { label: 'Colour', value: trimOrNull(module.extrusionColour) ?? '—' },
    { label: 'House connection', value: trimOrNull(module.houseConnectionType) ? toTitleCase(module.houseConnectionType) : '—' },
    { label: 'Post connection', value: trimOrNull(module.postConnectionType) ? toTitleCase(module.postConnectionType) : '—' },
    { label: 'Posts', value: formatCountValue(module.postCount) ?? '—' },
  ];

  if ('overhangEnabled' in module) {
    const overhangValue = formatOverhangValue(module);
    if (overhangValue) {
      rows.push({ label: 'Overhang', value: overhangValue });
    }
  }

  if ('hipCornerLengthBM' in module && 'hipCornerProjectionBM' in module && module.pergolaStyle === 'hip_corner') {
    rows.push({
      label: 'Hip corner B',
      value: formatSizeLabel(module.hipCornerLengthBM, module.hipCornerProjectionBM) ?? '—',
    });
  }

  return rows;
}

export function buildEstimateDrawingSheetMeta(input: BuildEstimateDrawingSheetMetaInput): EstimateDrawingSheetMeta {
  const sheetLabel = trimOrNull(input.sheetLabel) ?? trimOrNull(input.moduleLabel) ?? 'Module';
  const moduleTitle = trimOrNull(input.sheetTitleOverride) ?? trimOrNull(input.moduleTitleOverride) ?? sheetLabel;
  const isPlan = input.view === 'plan';
  const projectName = trimOrNull(input.projectName);

  return {
    moduleTitle,
    drawingTitle: `${moduleTitle} - ${isPlan ? 'Roof Plan' : 'Section'}`,
    siteAddress: trimOrNull(input.siteAddress) ?? projectName ?? 'Project address not set',
    sheetCode: isPlan ? 'P-01' : 'S-01',
    revision: trimOrNull(input.versionLabel) ?? 'V-',
    scale: DEFAULT_ESTIMATE_DRAWING_SCALE,
    date: formatSheetDate(input.estimateDate),
    client: trimOrNull(input.clientName) ?? 'Not set',
    issue: 'Portal preview',
    note: trimOrNull(input.noteOverride) ?? DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE,
    moduleInfoRows: input.sheetInfoRows ?? input.moduleInfoRows ?? [],
  };
}
