export type EstimateDrawingSheetView = 'plan' | 'section';

export const ESTIMATE_DRAWING_FIXED_SCALE_VALUES = [10, 20, 25, 50, 100] as const;

export type EstimateDrawingFixedScaleValue = (typeof ESTIMATE_DRAWING_FIXED_SCALE_VALUES)[number];

export type EstimateDrawingScale = { mode: 'fit' } | { mode: 'fixed'; ratio: EstimateDrawingFixedScaleValue };

export type EstimateDrawingSheetMeta = {
  drawingTitle: string;
  siteAddress: string;
  sheetCode: string;
  revision: string;
  scale: EstimateDrawingScale;
  date: string;
  client: string;
  issue: string;
  note: string;
};

export type BuildEstimateDrawingSheetMetaInput = {
  moduleLabel?: string | null;
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

export function buildEstimateDrawingSheetMeta(input: BuildEstimateDrawingSheetMetaInput): EstimateDrawingSheetMeta {
  const moduleLabel = trimOrNull(input.moduleLabel) ?? 'Module';
  const isPlan = input.view === 'plan';
  const projectName = trimOrNull(input.projectName);

  return {
    drawingTitle: `${moduleLabel} - ${isPlan ? 'Roof Plan' : 'Section'}`,
    siteAddress: trimOrNull(input.siteAddress) ?? projectName ?? 'Project address not set',
    sheetCode: isPlan ? 'P-01' : 'S-01',
    revision: trimOrNull(input.versionLabel) ?? 'V-',
    scale: DEFAULT_ESTIMATE_DRAWING_SCALE,
    date: formatSheetDate(input.estimateDate),
    client: trimOrNull(input.clientName) ?? 'Not set',
    issue: 'Portal preview',
    note: DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE,
  };
}
