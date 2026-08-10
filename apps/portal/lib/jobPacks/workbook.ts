import type { MaterialsLineV1 } from '@sp/costing';
import type { SpreadsheetColumn, SpreadsheetGroup } from '@/components/spreadsheet/types';
import type { EstimateDetail } from '@/lib/estimates/types';
import {
  buildPowdercoatOptionMap,
  normalizePowdercoatProfile,
  powdercoatStoredRowFromLine,
  summarizePowdercoatChanges,
} from '@/lib/jobPacks/powdercoating';
import type {
  JobPackPowdercoatOption,
  JobPackPowdercoatOverrideState,
  JobPackPowdercoatSheetResponse,
  JobPackPowdercoatStoredRow,
} from '@/lib/jobPacks/types';
import { buildJobPack } from '@/lib/outputs/jobPack';
import type { JobPack } from '@/lib/outputs/types';
import type { Estimate } from '@/lib/types/estimate';
import type { CalculatorInputs } from '@/lib/types/calculator';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1 } from '@/lib/types/calculator';

export const JOB_PACK_SHEETS = [
  { key: 'materials', label: 'Materials' },
  { key: 'powdercoating-order', label: 'Powdercoating Order' },
  { key: 'labour', label: 'Labour' },
  { key: 'overheads', label: 'Overheads' },
  { key: 'inputs', label: 'Inputs' },
  { key: 'summary', label: 'Summary' },
] as const;

export type JobPackSheetKey = (typeof JOB_PACK_SHEETS)[number]['key'];
export type JobPackCellKey = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
export type JobPackEditableCellKey = 'a' | 'c' | 'd';
type PowdercoatRowOrigin = 'base' | 'manual' | 'draft';

function formatRoofMaterial(value: unknown): string {
  return value === 'none' ? 'No roof covering' : String(value ?? '-');
}

type PowdercoatSpreadsheetRow = {
  origin: PowdercoatRowOrigin;
  storedRow: JobPackPowdercoatStoredRow;
  baseRow: JobPackPowdercoatStoredRow | null;
  stockLengthOptionsM: number[];
  changeSummary: string | null;
};

export type JobPackRow = {
  id: string;
  cells: Partial<Record<JobPackCellKey, string>>;
  tone?: 'default' | 'muted' | 'total';
  powdercoat?: PowdercoatSpreadsheetRow | null;
};

type JobPackSheetModel = {
  title: string;
  columns: readonly SpreadsheetColumn<JobPackCellKey>[];
  groups: readonly SpreadsheetGroup<JobPackRow>[];
  defaultActiveKey: JobPackCellKey;
  notesColumnKey?: JobPackCellKey;
  notesToggleColumnKeys?: readonly JobPackCellKey[];
  emptyMessage: string;
};

type ReadableInputs = {
  modules: Array<{
    title: string;
    rows: Array<{ label: string; value: string }>;
  }>;
  jobRows: Array<{ label: string; value: string }>;
};

type SnapshotFields = {
  contact: { displayName: string; email: string; phone: string };
  project: { projectName: string; region?: string; siteAddress?: string; quoteRef?: string };
};

type WorkbookContext = {
  detail: EstimateDetail;
  estimate: Estimate;
  jobPack: JobPack;
  readableInputs: ReadableInputs;
  snapshot: SnapshotFields;
};

export type JobPackWorkbook = WorkbookContext & {
  sheets: Record<JobPackSheetKey, JobPackSheetModel>;
  powdercoatRows: PowdercoatSpreadsheetRow[];
};

export const DEFAULT_JOB_PACK_SHEET: JobPackSheetKey = 'materials';
const POWDERCOAT_DRAFT_ROW_ID = '__powdercoating_draft__';

function emptyPowdercoatOverrideState(): JobPackPowdercoatOverrideState {
  return { version: null, rows: [] };
}

export function emptyPowdercoatSheetResponse(): JobPackPowdercoatSheetResponse {
  return {
    overrides: emptyPowdercoatOverrideState(),
    options: [],
    persistenceAvailable: true,
    profileOptionsAvailable: true,
    warningMessage: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function formatMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `$${value.toFixed(2)}`;
}

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatEstimateStatus(value: string): string {
  return value === 'archived' ? 'Archived' : 'Draft';
}

function withUnit(value: number | null | undefined, unit: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${formatNumber(value)} ${unit}`.trim();
}

function toEstimate(detail: EstimateDetail): Estimate | null {
  const snapshot = isRecord(detail.calculatorSnapshot) ? detail.calculatorSnapshot : null;
  if (!snapshot) return null;

  const root = isRecord(snapshot.calculator_snapshot) ? snapshot.calculator_snapshot : snapshot;
  const inputs = root.inputs;
  const outputs = isRecord(root.outputs) ? root.outputs : null;
  if (!inputs || !outputs) return null;

  const configVersions = isRecord(outputs.configVersions) ? outputs.configVersions : null;
  const warnings = Array.isArray(root.warnings) ? root.warnings : Array.isArray((outputs as any).warnings) ? (outputs as any).warnings : [];

  return {
    id: detail.id,
    projectId: detail.projectId,
    createdAt: detail.createdAt,
    status: detail.status,
    inputs: inputs as Estimate['inputs'],
    derived: (isRecord(outputs.derived) ? outputs.derived : {}) as Estimate['derived'],
    projectSnapshot: (isRecord(outputs.projectSnapshot) ? outputs.projectSnapshot : undefined) as Estimate['projectSnapshot'],
    snapshot: (isRecord(outputs.snapshot) ? outputs.snapshot : undefined) as Estimate['snapshot'],
    outputs: {
      ...(outputs as Estimate['outputs']),
      warnings: warnings as Estimate['outputs']['warnings'],
    },
    configVersions: {
      pricebook: readText(configVersions?.pricebook) ?? '',
      installActions: readText(configVersions?.installActions) ?? '',
      overheads: readText(configVersions?.overheads) ?? '',
      rules: readText(configVersions?.rules) ?? readText(root.costing_rules) ?? '',
      manifest: readText(configVersions?.manifest) ?? readText(root.costing_manifest) ?? '',
    },
  };
}

function getSnapshot(estimate: Estimate): SnapshotFields {
  const snap = (estimate as any).snapshot;
  if (snap && typeof snap === 'object' && snap.contact && snap.project) {
    const contact = snap.contact as any;
    const project = snap.project as any;
    const projectName = typeof project.projectName === 'string' ? project.projectName : '';
    if (projectName.trim()) {
      return {
        contact: {
          displayName: String(contact.displayName ?? ''),
          email: String(contact.email ?? ''),
          phone: String(contact.phone ?? ''),
        },
        project: {
          projectName,
          region: typeof project.region === 'string' ? project.region : undefined,
          siteAddress: typeof project.siteAddress === 'string' ? project.siteAddress : undefined,
          quoteRef: typeof project.quoteRef === 'string' ? project.quoteRef : undefined,
        },
      };
    }
  }

  const legacy = (estimate as any).projectSnapshot as any;
  return {
    contact: {
      displayName: typeof legacy?.clientName === 'string' ? legacy.clientName : '',
      email: typeof legacy?.email === 'string' ? legacy.email : '',
      phone: typeof legacy?.phone === 'string' ? legacy.phone : '',
    },
    project: {
      projectName: typeof legacy?.name === 'string' ? legacy.name : (estimate as any).inputs?.projectName ?? '-',
      region: typeof legacy?.region === 'string' ? legacy.region : undefined,
      siteAddress: typeof legacy?.address === 'string' ? legacy.address : undefined,
      quoteRef: typeof legacy?.quoteRef === 'string' ? legacy.quoteRef : undefined,
    },
  };
}

function buildReadableInputs(inputs: unknown): ReadableInputs {
  if (!inputs) return { modules: [], jobRows: [] };

  if (isCalculatorInputsV2(inputs)) {
    const job = inputs as CalculatorInputs;
    const jobRows: Array<{ label: string; value: string }> = [
      { label: 'Access', value: String(job.access ?? '-') },
      { label: 'Height', value: String(job.height ?? '-') },
      { label: 'Job type', value: String(job.jobType ?? '-') },
      { label: 'Travel (ex GST)', value: String(job.travelExGst ?? '0') },
      { label: 'Extras allowance (ex GST)', value: String(job.extrasAllowanceExGst ?? '0') },
      { label: 'Discount (%)', value: String(job.quoteDiscountPct ?? '0') },
    ];

    const modules = (job.modules ?? []).map((module, index) => ({
      title: `Module ${index + 1}`,
      rows: [
        { label: 'Style', value: String(module.pergolaStyle ?? '-') },
        { label: 'Roof material', value: formatRoofMaterial(module.roofMaterial) },
        { label: 'Extrusion colour', value: String(module.extrusionColour ?? '-') },
        { label: 'Roof length (m)', value: String(module.lengthM ?? '-') },
        { label: 'Roof span (m)', value: String(module.projectionM ?? '-') },
        ...(module.pergolaStyle === 'hip_corner'
          ? [
              { label: 'Roof length B (m)', value: String((module as any).hipCornerLengthBM ?? '-') },
              { label: 'Roof span B (m)', value: String((module as any).hipCornerProjectionBM ?? '-') },
            ]
          : []),
        { label: 'Roof pitch (deg)', value: String(module.roofPitchDeg?.trim() ? module.roofPitchDeg : 'default') },
        { label: 'House connection', value: String(module.houseConnectionType ?? '-') },
        { label: 'Post connection', value: String(module.postConnectionType ?? '-') },
        { label: 'Post count', value: String(module.postCount ?? '-') },
      ],
    }));

    return { modules, jobRows };
  }

  if (isLegacyCalculatorInputsV1(inputs)) {
    return {
      jobRows: [
        { label: 'Access', value: String(inputs.access ?? '-') },
        { label: 'Height', value: String(inputs.height ?? '-') },
        { label: 'Travel (ex GST)', value: String(inputs.travelExGst ?? '0') },
        { label: 'Extras allowance (ex GST)', value: String(inputs.extrasAllowanceExGst ?? '0') },
        { label: 'Discount (%)', value: String(inputs.quoteDiscountPct ?? '0') },
      ],
      modules: [
        {
          title: 'Module 1',
          rows: [
            { label: 'Style', value: String(inputs.pergolaStyle ?? '-') },
            { label: 'Roof material', value: formatRoofMaterial(inputs.roofMaterial) },
            { label: 'Extrusion colour', value: String(inputs.extrusionColour ?? '-') },
            { label: 'Roof length (m)', value: String(inputs.lengthM ?? '-') },
            { label: 'Roof span (m)', value: String(inputs.projectionM ?? '-') },
            { label: 'Roof pitch (deg)', value: String(inputs.roofPitchDeg?.trim() ? inputs.roofPitchDeg : 'default') },
            { label: 'House connection', value: String(inputs.houseConnectionType ?? '-') },
            { label: 'Post connection', value: String(inputs.postConnectionType ?? '-') },
            { label: 'Post count', value: String(inputs.postCount ?? '-') },
          ],
        },
      ],
    };
  }

  return { modules: [], jobRows: [] };
}

function makeColumns(
  defs: Array<{ key: JobPackCellKey; label: string; widthPx: number; frozen?: boolean; sourceLabel?: string | null }>,
): SpreadsheetColumn<JobPackCellKey>[] {
  return defs.map((def, index) => ({
    ...def,
    editable: false,
    frozen: def.frozen ?? index === 0,
    letter: String.fromCharCode(65 + index),
    sourceLabel: def.sourceLabel ?? null,
  }));
}

function makeRow(id: string, cells: Partial<Record<JobPackCellKey, string>>, tone: JobPackRow['tone'] = 'default'): JobPackRow {
  return { id, cells, tone };
}

function ensureRows(rows: JobPackRow[], groupKey: string, message: string): JobPackRow[] {
  return rows.length ? rows : [makeRow(`${groupKey}-empty`, { a: message }, 'muted')];
}

function stripMaterialPrefix(label: string): string {
  return label.replace(/^\[[^\]]+\]\s*/g, '').trim();
}

function inferMaterialColour(label: string): string {
  const match = label.match(/\(([^)]+)\)(?!.*\([^)]*\))/);
  return match?.[1]?.trim() || '-';
}

function inferMaterialStockLength(label: string): string {
  const match = label.match(/(\d+(?:\.\d+)?)m\b/i);
  if (!match) return '-';
  const parsed = Number.parseFloat(match[1] ?? '');
  return Number.isFinite(parsed) ? `${formatNumber(parsed)}m` : '-';
}

function buildMaterialItemLabel(line: MaterialsLineV1): string {
  const strippedLabel = stripMaterialPrefix(line.label ?? '');
  const withoutTrailingColour = strippedLabel.replace(/\s*\(([^)]+)\)\s*$/, '').trim();
  const profile = typeof line.profile === 'string' ? line.profile.trim() : '';
  return withoutTrailingColour || profile || '-';
}

function isPowdercoatMaterialLine(line: MaterialsLineV1): boolean {
  return String(line.id ?? '')
    .toLowerCase()
    .includes('aluminium-extrusion');
}

function formatStockLengthM(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${formatNumber(value)}m` : '-';
}

function buildBasePowdercoatRows(jobPack: JobPack): JobPackPowdercoatStoredRow[] {
  return jobPack.orderLists.powdercoat.map(powdercoatStoredRowFromLine);
}

function resolvePowdercoatStockLengthOptions(
  optionMap: Map<string, JobPackPowdercoatOption>,
  row: JobPackPowdercoatStoredRow,
): number[] {
  const options = optionMap.get(normalizePowdercoatProfile(row.profile))?.stockLengthsM ?? [];
  if (options.length) return options;
  return typeof row.stockLengthM === 'number' && Number.isFinite(row.stockLengthM) ? [row.stockLengthM] : [];
}

function mergePowdercoatRows(
  baseRows: JobPackPowdercoatStoredRow[],
  overrides: JobPackPowdercoatOverrideState,
  optionMap: Map<string, JobPackPowdercoatOption>,
): PowdercoatSpreadsheetRow[] {
  const overrideByBaseId = new Map(
    overrides.rows
      .filter((row) => row.source === 'base' && row.baseRowId)
      .map((row) => [row.baseRowId as string, row]),
  );
  const consumedOverrideIds = new Set<string>();

  const mergedBaseRows = baseRows.map((baseRow) => {
    const override = overrideByBaseId.get(baseRow.baseRowId ?? baseRow.id) ?? null;
    if (override) consumedOverrideIds.add(override.id);
    const storedRow = override ?? baseRow;
    return {
      origin: 'base',
      storedRow,
      baseRow,
      stockLengthOptionsM: resolvePowdercoatStockLengthOptions(optionMap, storedRow),
      changeSummary: summarizePowdercoatChanges(baseRow, storedRow),
    } satisfies PowdercoatSpreadsheetRow;
  });

  const manualRows = overrides.rows
    .filter((row) => row.source === 'manual' || !consumedOverrideIds.has(row.id))
    .map((row) => ({
      origin: 'manual' as const,
      storedRow: row,
      baseRow: row.source === 'base' ? baseRows.find((item) => item.baseRowId === row.baseRowId) ?? null : null,
      stockLengthOptionsM: resolvePowdercoatStockLengthOptions(optionMap, row),
      changeSummary: summarizePowdercoatChanges(
        row.source === 'base' ? baseRows.find((item) => item.baseRowId === row.baseRowId) ?? null : null,
        row,
      ),
    }));

  return [...mergedBaseRows, ...manualRows];
}

function createPowdercoatDraftRow(defaultColour: string): PowdercoatSpreadsheetRow {
  return {
    origin: 'draft',
    storedRow: {
      id: POWDERCOAT_DRAFT_ROW_ID,
      source: 'manual',
      baseRowId: null,
      profile: '',
      colour: defaultColour,
      stockLengthM: null,
      qty: 1,
      unit: 'bar',
      notes: '',
    },
    baseRow: null,
    stockLengthOptionsM: [],
    changeSummary: null,
  };
}

function buildPowdercoatSheetRow(row: PowdercoatSpreadsheetRow, includeChangesColumn: boolean): JobPackRow {
  const cells: Partial<Record<JobPackCellKey, string>> = {
    a: row.storedRow.profile,
    b: row.storedRow.colour || '-',
    c: formatStockLengthM(row.storedRow.stockLengthM),
    d: formatNumber(row.storedRow.qty),
    e: row.storedRow.unit || '-',
    f: row.storedRow.notes || '',
  };

  if (includeChangesColumn) cells.g = row.changeSummary || '';

  if (row.origin === 'draft') {
    cells.a = '';
    cells.b = '';
    cells.c = '';
    cells.d = '';
    cells.e = '';
    cells.f = '';
    if (includeChangesColumn) cells.g = '';
  }

  return {
    id: row.storedRow.id,
    cells,
    tone: 'default',
    powdercoat: row,
  };
}

function nextPowdercoatRowsForPersist(
  rows: PowdercoatSpreadsheetRow[],
  editedRow: PowdercoatSpreadsheetRow,
  key: JobPackEditableCellKey,
  value: string,
  defaultColour: string,
  optionMap: Map<string, JobPackPowdercoatOption>,
): JobPackPowdercoatStoredRow[] | null {
  const persistedRows = rows
    .filter((row) => row.origin !== 'draft')
    .map((row) => row.storedRow);

  if (editedRow.origin === 'draft') {
    if (key !== 'a') return null;
    const profile = normalizePowdercoatProfile(value);
    if (!profile) return null;
    const stockLengthOptionsM = optionMap.get(profile)?.stockLengthsM ?? [];
    const manualRow: JobPackPowdercoatStoredRow = {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? `manual:${crypto.randomUUID()}` : `manual:${Date.now()}`,
      source: 'manual',
      baseRowId: null,
      profile,
      colour: defaultColour,
      stockLengthM: stockLengthOptionsM.length === 1 ? stockLengthOptionsM[0] ?? null : null,
      qty: 1,
      unit: 'bar',
      notes: '',
    };
    return [...persistedRows, manualRow];
  }

  const nextRow: JobPackPowdercoatStoredRow = { ...editedRow.storedRow };

  if (key === 'a') {
    const profile = normalizePowdercoatProfile(value);
    if (!profile) return null;
    nextRow.profile = profile;
    const profileOptions = optionMap.get(profile)?.stockLengthsM ?? [];
    const currentStockLength = nextRow.stockLengthM;
    if (profileOptions.length === 1) {
      nextRow.stockLengthM = profileOptions[0] ?? null;
    } else if (
      profileOptions.length > 1 &&
      (typeof currentStockLength !== 'number' || !profileOptions.some((option) => Math.abs(option - currentStockLength) < 1e-6))
    ) {
      nextRow.stockLengthM = null;
    }
  }

  if (key === 'c') {
    const parsed = value.trim() ? Number.parseFloat(value) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    nextRow.stockLengthM = Math.round(parsed * 1000) / 1000;
  }

  if (key === 'd') {
    const parsed = value.trim() ? Number.parseFloat(value) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    nextRow.qty = Math.round(parsed * 1000) / 1000;
  }

  const nextPersistedRows = persistedRows.filter((row) => row.id !== editedRow.storedRow.id);
  if (editedRow.baseRow && summarizePowdercoatChanges(editedRow.baseRow, nextRow) === null) {
    return nextPersistedRows;
  }

  return [...nextPersistedRows, nextRow];
}

export function getPowdercoatValidationMessage(key: JobPackEditableCellKey): string {
  switch (key) {
    case 'a':
      return 'Profile is required.';
    case 'c':
      return 'Stock length must be greater than 0.';
    case 'd':
      return 'Qty must be greater than 0.';
    default:
      return 'This edit could not be applied.';
  }
}

function buildSummarySheet({ detail, estimate, jobPack, snapshot }: WorkbookContext): JobPackSheetModel {
  const summaryRows = ensureRows(
    [
      makeRow('project-name', { a: 'Project', b: snapshot.project.projectName || '-' }),
      makeRow('site-address', { a: 'Site address', b: snapshot.project.siteAddress || '-' }),
      makeRow('region', { a: 'Region', b: snapshot.project.region || '-' }),
      makeRow('quote-ref', { a: 'Quote ref', b: snapshot.project.quoteRef || '-' }),
      makeRow('contact-name', { a: 'Contact', b: snapshot.contact.displayName || '-' }),
      makeRow('contact-email', { a: 'Email', b: snapshot.contact.email || '-' }),
      makeRow('contact-phone', { a: 'Phone', b: snapshot.contact.phone || '-' }),
    ],
    'summary-project',
    'No project snapshot is available.',
  );

  const estimateRows = ensureRows(
    [
      makeRow('version-label', { a: 'Version', b: detail.versionLabel }),
      makeRow('created-at', { a: 'Created', b: formatDateTime(detail.createdAt) }),
      makeRow('roof-type', { a: 'Roof type', b: jobPack.summary.roofType || '-' }),
      makeRow('roof-material', { a: 'Roof material', b: jobPack.summary.roofMaterialMode || '-' }),
      makeRow('roof-pitch', { a: 'Roof pitch', b: withUnit(jobPack.summary.pitchDeg ?? null, 'deg') }),
      makeRow('module-count', { a: 'Modules', b: formatNumber(jobPack.summary.moduleCount ?? null) }),
      makeRow(
        'geometry',
        {
          a: 'Geometry',
          b:
            typeof jobPack.summary.lengthM === 'number' && typeof jobPack.summary.projectionM === 'number'
              ? `${formatNumber(jobPack.summary.lengthM)}m x ${formatNumber(jobPack.summary.projectionM)}m`
              : '-',
        },
      ),
      makeRow('status', { a: 'Estimate status', b: detail.status }),
      makeRow('notes', { a: 'Internal notes', b: detail.internalNotes?.trim() || '-' }),
    ],
    'summary-estimate',
    'No estimate summary is available.',
  );

  const totalsRows = ensureRows(
    [
      makeRow('materials-total', { a: 'Materials ex GST', b: formatMoney(jobPack.summary.totals.materialsExGst) }),
      makeRow('install-total', { a: 'Labour ex GST', b: formatMoney(jobPack.summary.totals.installExGst) }),
      makeRow('overhead-total', { a: 'Overheads ex GST', b: formatMoney(jobPack.summary.totals.overheadExGst) }),
      makeRow('true-cost-total', { a: 'True cost ex GST', b: formatMoney(jobPack.summary.totals.trueCostExGst) }, 'total'),
      makeRow('customer-total', { a: 'Estimate total', b: formatMoney(detail.summary.total ?? null) }),
      makeRow('margin', { a: 'Margin value', b: formatMoney(detail.summary.marginValue ?? null) }),
    ],
    'summary-totals',
    'No totals are available.',
  );

  const configRows = ensureRows(
    [
      makeRow('pricebook', { a: 'Pricebook', b: estimate.configVersions.pricebook || '-' }),
      makeRow('install-actions', { a: 'Install actions', b: estimate.configVersions.installActions || '-' }),
      makeRow('overheads', { a: 'Overheads', b: estimate.configVersions.overheads || '-' }),
      makeRow('rules', { a: 'Rules', b: estimate.configVersions.rules || '-' }),
      makeRow('manifest', { a: 'Manifest', b: estimate.configVersions.manifest || '-' }),
    ],
    'summary-config',
    'No config versions are available.',
  );

  return {
    title: 'Summary',
    columns: makeColumns([
      { key: 'a', label: 'Field', widthPx: 220 },
      { key: 'b', label: 'Value', widthPx: 360 },
      { key: 'c', label: 'Notes', widthPx: 240 },
    ]),
    groups: [
      { key: 'summary-project', label: 'Project snapshot', rows: summaryRows },
      { key: 'summary-estimate', label: 'Estimate', rows: estimateRows },
      { key: 'summary-totals', label: 'Totals', rows: totalsRows },
      { key: 'summary-config', label: 'Config versions', rows: configRows },
    ],
    defaultActiveKey: 'a',
    notesColumnKey: 'c',
    emptyMessage: 'No job pack summary is available.',
  };
}

function buildMaterialsSheet({
  estimate,
  powdercoatRows,
}: {
  estimate: Estimate;
  powdercoatRows: JobPackPowdercoatStoredRow[];
}): JobPackSheetModel {
  const groupedRows = new Map<
    string,
    {
      item: string;
      colour: string;
      stockLength: string;
      qty: number;
      unit: string;
      notes: string;
    }
  >();

  for (const line of (estimate.outputs.materials.lines ?? []).filter((item) => !isPowdercoatMaterialLine(item))) {
    const item = buildMaterialItemLabel(line);
    const colour = inferMaterialColour(line.label ?? '');
    const stockLength = inferMaterialStockLength(line.label ?? '');
    const unit = line.unit || '-';
    const notes = line.notes?.trim() || '';
    const key = [item, colour, stockLength, unit, notes].join('|');
    const existing = groupedRows.get(key);
    if (existing) {
      existing.qty += line.qty;
      continue;
    }
    groupedRows.set(key, {
      item,
      colour,
      stockLength,
      qty: line.qty,
      unit,
      notes,
    });
  }

  for (const line of powdercoatRows) {
    const key = [line.profile, line.colour || '-', formatStockLengthM(line.stockLengthM), line.unit || '-', line.notes || ''].join('|');
    const existing = groupedRows.get(key);
    if (existing) {
      existing.qty += line.qty;
      continue;
    }
    groupedRows.set(key, {
      item: line.profile || '-',
      colour: line.colour || '-',
      stockLength: formatStockLengthM(line.stockLengthM),
      qty: line.qty,
      unit: line.unit || '-',
      notes: line.notes || '',
    });
  }

  const rows = ensureRows(
    Array.from(groupedRows.values())
      .sort((left, right) => {
        const itemCompare = left.item.localeCompare(right.item);
        if (itemCompare !== 0) return itemCompare;
        const colourCompare = left.colour.localeCompare(right.colour);
        if (colourCompare !== 0) return colourCompare;
        return left.stockLength.localeCompare(right.stockLength);
      })
      .map((line, index) =>
        makeRow(`material-${index}`, {
          a: line.item,
          b: line.colour,
          c: line.stockLength,
          d: formatNumber(line.qty),
          e: line.unit,
          f: line.notes,
        }),
      ),
    'materials',
    'No material rows are available.',
  );

  return {
    title: 'Materials',
    columns: makeColumns([
      { key: 'a', label: 'Item', widthPx: 280 },
      { key: 'b', label: 'Colour', widthPx: 160 },
      { key: 'c', label: 'Stock length', widthPx: 140 },
      { key: 'd', label: 'Qty', widthPx: 110 },
      { key: 'e', label: 'Unit', widthPx: 100 },
      { key: 'f', label: 'Notes', widthPx: 320 },
    ]),
    groups: [{ key: 'materials', label: 'Materials', showHeader: false, rows }],
    defaultActiveKey: 'a',
    notesColumnKey: 'f',
    emptyMessage: 'No material rows are available for this job pack.',
  };
}

function buildPowdercoatingOrderSheet(powdercoatRows: PowdercoatSpreadsheetRow[]): JobPackSheetModel {
  const hasChangesColumn = powdercoatRows.some((row) => Boolean(row.changeSummary));
  const rows = ensureRows(
    powdercoatRows.map((row) => buildPowdercoatSheetRow(row, hasChangesColumn)),
    'powdercoating-order',
    'No powdercoating rows are available.',
  );

  return {
    title: 'Powdercoating Order',
    columns: makeColumns([
      { key: 'a', label: 'Profile', widthPx: 280 },
      { key: 'b', label: 'Colour', widthPx: 160 },
      { key: 'c', label: 'Stock length', widthPx: 140 },
      { key: 'd', label: 'Qty', widthPx: 110 },
      { key: 'e', label: 'Unit', widthPx: 100 },
      ...(hasChangesColumn ? [{ key: 'g' as const, label: 'Changes', widthPx: 300 }] : []),
      { key: 'f', label: 'Notes', widthPx: 320 },
    ]),
    groups: [{ key: 'powdercoating-order', label: 'Powdercoating order', showHeader: false, rows }],
    defaultActiveKey: 'a',
    notesColumnKey: 'f',
    notesToggleColumnKeys: hasChangesColumn ? ['g', 'f'] : ['f'],
    emptyMessage: 'No powdercoating order rows are available for this job pack.',
  };
}

function buildLabourSheet({ jobPack }: WorkbookContext): JobPackSheetModel {
  const phaseGroups = jobPack.installPhases.phases.map((phase, phaseIndex) => {
    const actionRows = phase.actions.map((action, actionIndex) =>
      makeRow(`phase-${phaseIndex}-action-${actionIndex}`, {
        a: String(action.label ?? action.id ?? 'Install action'),
        b: String(action.scope ?? ''),
        c: formatNumber(typeof action.qty === 'number' ? action.qty : null),
        d: String(action.unit ?? '-'),
        e: formatNumber(action.minutes),
        f: formatMoney(action.cost_ex_gst),
        g: String(action.category ?? ''),
      }),
    );

    return {
      key: `labour-phase-${phase.phaseId}`,
      label: phase.label,
      rows: ensureRows(
        [
          ...actionRows,
          makeRow(
            `phase-${phase.phaseId}-total`,
            {
              a: 'Phase total',
              e: formatNumber(phase.minutes),
              f: formatMoney(phase.costExGst),
            },
            'total',
          ),
        ],
        `labour-phase-${phase.phaseId}`,
        'No labour rows are available.',
      ),
    };
  });

  phaseGroups.push({
    key: 'labour-totals',
    label: 'Totals',
    rows: [
      makeRow('labour-total-minutes', { a: 'Minutes', b: formatNumber(jobPack.installPhases.totals.minutes) }),
      makeRow('labour-total-hours', { a: 'Crew hours', b: formatNumber(jobPack.installPhases.totals.crewHours) }),
      makeRow('labour-total-days', { a: 'Site days (9h)', b: formatNumber(jobPack.installPhases.totals.siteDaysAt9h) }, 'total'),
    ],
  });

  return {
    title: 'Labour',
    columns: makeColumns([
      { key: 'a', label: 'Action', widthPx: 280 },
      { key: 'b', label: 'Scope', widthPx: 240 },
      { key: 'c', label: 'Qty', widthPx: 100 },
      { key: 'd', label: 'Unit', widthPx: 90 },
      { key: 'e', label: 'Minutes', widthPx: 110 },
      { key: 'f', label: 'Cost ex GST', widthPx: 150 },
      { key: 'g', label: 'Category', widthPx: 180 },
    ]),
    groups: phaseGroups,
    defaultActiveKey: 'a',
    emptyMessage: 'No labour rows are available for this job pack.',
  };
}

function buildOverheadsSheet({ estimate }: WorkbookContext): JobPackSheetModel {
  const overhead = estimate.outputs.overhead;
  return {
    title: 'Overheads',
    columns: makeColumns([
      { key: 'a', label: 'Field', widthPx: 220 },
      { key: 'b', label: 'Value', widthPx: 220 },
      { key: 'c', label: 'Notes', widthPx: 320 },
    ]),
    groups: [
      {
        key: 'overheads',
        label: 'Overheads',
        rows: ensureRows(
          [
            makeRow('overhead-method', { a: 'Method', b: overhead.method || '-' }),
            makeRow('overhead-ops', { a: 'Operations ex GST', b: formatMoney(overhead.ops_ex_gst) }),
            makeRow('overhead-sales', { a: 'Sales ex GST', b: formatMoney(overhead.sales_ex_gst) }),
            makeRow('overhead-total', { a: 'Total ex GST', b: formatMoney(overhead.total_ex_gst) }, 'total'),
          ],
          'overheads',
          'No overhead rows are available.',
        ),
      },
    ],
    defaultActiveKey: 'a',
    notesColumnKey: 'c',
    emptyMessage: 'No overhead data is available for this job pack.',
  };
}

function buildInputsSheet({ readableInputs }: WorkbookContext): JobPackSheetModel {
  const groups: SpreadsheetGroup<JobPackRow>[] = [];

  groups.push({
    key: 'inputs-job',
    label: 'Job',
    rows: ensureRows(
      readableInputs.jobRows.map((row, index) => makeRow(`job-input-${index}`, { a: row.label, b: row.value })),
      'inputs-job',
      'No job level inputs are available.',
    ),
  });

  readableInputs.modules.forEach((module) => {
    groups.push({
      key: `inputs-${module.title.toLowerCase().replace(/\s+/g, '-')}`,
      label: module.title,
      rows: ensureRows(
        module.rows.map((row, index) => makeRow(`${module.title}-row-${index}`, { a: row.label, b: row.value })),
        module.title,
        `No inputs are available for ${module.title.toLowerCase()}.`,
      ),
    });
  });

  return {
    title: 'Inputs',
    columns: makeColumns([
      { key: 'a', label: 'Field', widthPx: 240 },
      { key: 'b', label: 'Value', widthPx: 260 },
      { key: 'c', label: 'Notes', widthPx: 260 },
    ]),
    groups,
    defaultActiveKey: 'a',
    notesColumnKey: 'c',
    emptyMessage: 'No calculator inputs are available for this job pack.',
  };
}

export function buildWorkbook(
  detail: EstimateDetail,
  powdercoatOverrides: JobPackPowdercoatOverrideState,
  powdercoatOptions: JobPackPowdercoatOption[],
): JobPackWorkbook {
  const estimate = toEstimate(detail);
  if (!estimate) {
    throw new Error('This estimate snapshot is missing the data needed to build a job pack workbook.');
  }

  const jobPack = buildJobPack(estimate);
  const readableInputs = buildReadableInputs((estimate as any).inputs);
  const snapshot = getSnapshot(estimate);
  const context = { detail, estimate, jobPack, readableInputs, snapshot };
  const optionMap = buildPowdercoatOptionMap(powdercoatOptions);
  const mergedPowdercoatRows = mergePowdercoatRows(buildBasePowdercoatRows(jobPack), powdercoatOverrides, optionMap);
  const defaultPowdercoatColour = mergedPowdercoatRows.find((row) => row.storedRow.colour)?.storedRow.colour || '';
  const powdercoatRows = [...mergedPowdercoatRows, createPowdercoatDraftRow(defaultPowdercoatColour)];

  return {
    ...context,
    powdercoatRows,
    sheets: {
      summary: buildSummarySheet(context),
      materials: buildMaterialsSheet({
        estimate,
        powdercoatRows: mergedPowdercoatRows.map((row) => row.storedRow),
      }),
      'powdercoating-order': buildPowdercoatingOrderSheet(powdercoatRows),
      labour: buildLabourSheet(context),
      overheads: buildOverheadsSheet(context),
      inputs: buildInputsSheet(context),
    },
  };
}

function buildPowdercoatWorkbookFromModel(
  detail: EstimateDetail,
  rows: JobPackPowdercoatStoredRow[],
  options: JobPackPowdercoatOption[],
): JobPackWorkbook {
  return buildWorkbook(detail, { version: null, rows }, options);
}

export function applyPowdercoatEditToModel(args: {
  detail: EstimateDetail;
  rows: JobPackPowdercoatStoredRow[];
  options: JobPackPowdercoatOption[];
  rowId: string;
  key: JobPackEditableCellKey;
  value: string;
}): JobPackPowdercoatStoredRow[] | null {
  const workbook = buildPowdercoatWorkbookFromModel(args.detail, args.rows, args.options);
  const editedRow = workbook.powdercoatRows.find((item) => item.storedRow.id === args.rowId) ?? null;
  if (!editedRow) return null;

  const defaultColour =
    workbook.powdercoatRows.find((item) => item.origin !== 'draft' && item.storedRow.colour)?.storedRow.colour ?? '';
  const optionMap = buildPowdercoatOptionMap(args.options);
  return nextPowdercoatRowsForPersist(workbook.powdercoatRows, editedRow, args.key, args.value, defaultColour, optionMap);
}

export function coerceJobPackSheet(value: string | null | undefined): JobPackSheetKey {
  return (JOB_PACK_SHEETS.find((item) => item.key === value)?.key ?? DEFAULT_JOB_PACK_SHEET) as JobPackSheetKey;
}

export function resolveVisibleJobPackColumns(
  sheet: JobPackSheetModel,
  showNotesColumn: boolean,
): readonly SpreadsheetColumn<JobPackCellKey>[] {
  if (showNotesColumn) return sheet.columns;

  const hiddenKeys = new Set<JobPackCellKey>(sheet.notesToggleColumnKeys ?? []);
  if (sheet.notesColumnKey) hiddenKeys.add(sheet.notesColumnKey);
  if (!hiddenKeys.size) return sheet.columns;

  return sheet.columns.filter((column) => !hiddenKeys.has(column.key));
}

export function resolveVisibleJobPackDefaultActiveKey(
  sheet: JobPackSheetModel,
  showNotesColumn: boolean,
): JobPackCellKey {
  const visibleColumns = resolveVisibleJobPackColumns(sheet, showNotesColumn);
  return visibleColumns.some((column) => column.key === sheet.defaultActiveKey)
    ? sheet.defaultActiveKey
    : (visibleColumns[0]?.key ?? sheet.defaultActiveKey);
}

export function buildJobPackPdfGroups(sheet: JobPackSheetModel): SpreadsheetGroup<JobPackRow>[] {
  return sheet.groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) => row.powdercoat?.origin !== 'draft'),
    }))
    .filter((group) => group.rows.length > 0);
}
