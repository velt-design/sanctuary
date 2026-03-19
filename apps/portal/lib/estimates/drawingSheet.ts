export type EstimateDrawingSheetView = 'plan' | 'section';

export type EstimateDrawingSheetMeta = {
  drawingTitle: string;
  siteAddress: string;
  sheetCode: string;
  revision: string;
  scale: string;
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
    scale: 'NTS',
    date: formatSheetDate(input.estimateDate),
    client: trimOrNull(input.clientName) ?? 'Not set',
    issue: 'Portal preview',
    note: DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE,
  };
}
