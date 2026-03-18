'use client';

import { useCallback, useMemo, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { MaterialsLineV1 } from '@sp/costing';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SpreadsheetAdapter, SpreadsheetColumn, SpreadsheetGroup } from '@/components/spreadsheet/types';
import spreadsheetStyles from '@/components/spreadsheet/spreadsheet.module.css';
import type { EstimateDetail } from '@/lib/estimates/types';
import {
  buildPowdercoatBaseRowId,
  buildPowdercoatOptionMap,
  normalizePowdercoatProfile,
  powdercoatStoredRowFromLine,
  summarizePowdercoatChanges,
} from '@/lib/jobPacks/powdercoating';
import type { JobPackPowdercoatOption, JobPackPowdercoatOverrideState, JobPackPowdercoatSheetResponse, JobPackPowdercoatStoredRow, JobPackPowdercoatUpdateResponse } from '@/lib/jobPacks/types';
import { buildJobPack } from '@/lib/outputs/jobPack';
import type { JobPack } from '@/lib/outputs/types';
import { jobPackPowdercoatingQueryOptions } from '@/lib/queries/jobPackPowdercoating';
import { ApiError, apiJson } from '@/lib/repo/apiClient';
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

type JobPackCellKey = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
type JobPackEditableCellKey = 'a' | 'c' | 'd';
type PowdercoatRowOrigin = 'base' | 'manual' | 'draft';

type PowdercoatSpreadsheetRow = {
  origin: PowdercoatRowOrigin;
  storedRow: JobPackPowdercoatStoredRow;
  baseRow: JobPackPowdercoatStoredRow | null;
  stockLengthOptionsM: number[];
  changeSummary: string | null;
};

type JobPackRow = {
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

const DEFAULT_SHEET: JobPackSheetKey = 'materials';
const POWDERCOAT_DRAFT_ROW_ID = '__powdercoating_draft__';

function emptyPowdercoatOverrideState(): JobPackPowdercoatOverrideState {
  return { version: null, rows: [] };
}

function emptyPowdercoatSheetResponse(): JobPackPowdercoatSheetResponse {
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

function formatMoney(value: number | null | undefined): string {
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

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatEstimateStatus(value: string): string {
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
        { label: 'Roof material', value: String(module.roofMaterial ?? '-') },
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
            { label: 'Roof material', value: String(inputs.roofMaterial ?? '-') },
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
      origin: override ? 'base' : 'base',
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

  if (includeChangesColumn) {
    cells.g = row.changeSummary || '';
  }

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
    tone: row.origin === 'draft' ? 'default' : 'default',
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

function getPowdercoatValidationMessage(key: JobPackEditableCellKey): string {
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

function buildPowdercoatWorkbookFromModel(
  detail: EstimateDetail,
  rows: JobPackPowdercoatStoredRow[],
  options: JobPackPowdercoatOption[],
) {
  return buildWorkbook(detail, { version: null, rows }, options);
}

function applyPowdercoatEditToModel(args: {
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
      { key: 'f', label: 'Notes', widthPx: 320 },
      ...(hasChangesColumn ? [{ key: 'g' as const, label: 'Changes', widthPx: 300 }] : []),
    ]),
    groups: [{ key: 'powdercoating-order', label: 'Powdercoating order', showHeader: false, rows }],
    defaultActiveKey: 'a',
    notesColumnKey: 'f',
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

function buildWorkbook(
  detail: EstimateDetail,
  powdercoatOverrides: JobPackPowdercoatOverrideState,
  powdercoatOptions: JobPackPowdercoatOption[],
): WorkbookContext & { sheets: Record<JobPackSheetKey, JobPackSheetModel>; powdercoatRows: PowdercoatSpreadsheetRow[] } {
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

function SheetToolbar({
  detail,
  sheet,
  trueCostExGst,
  estimateTotal,
  onSheetChange,
  onBackToList,
  onOpenEstimate,
  showHideNotesToggle,
  showNotesColumn,
  onShowNotesColumnChange,
  warningMessage,
}: {
  detail: EstimateDetail;
  sheet: JobPackSheetKey;
  trueCostExGst: number;
  estimateTotal: number | null | undefined;
  onSheetChange: (sheet: JobPackSheetKey) => void;
  onBackToList: () => void;
  onOpenEstimate: () => void;
  showHideNotesToggle: boolean;
  showNotesColumn: boolean;
  onShowNotesColumnChange: (checked: boolean) => void;
  warningMessage: string | null;
}) {
  return (
    <div className={spreadsheetStyles.toolbar}>
      <div className={spreadsheetStyles.toolbarPrimary}>
        <button type="button" className={spreadsheetStyles.toolbarAction} onClick={onBackToList}>
          Back to job packs
        </button>

        <select
          className={spreadsheetStyles.toolbarSelect}
          value={sheet}
          aria-label="Job pack sheet"
          onChange={(event) => onSheetChange(coerceJobPackSheet(event.target.value))}
        >
          {JOB_PACK_SHEETS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>

        {showHideNotesToggle ? (
          <label className={spreadsheetStyles.toolbarToggle}>
            <input
              type="checkbox"
              checked={showNotesColumn}
              onChange={(event) => onShowNotesColumnChange(event.target.checked)}
            />
            <span>Show notes</span>
          </label>
        ) : null}
      </div>

      <div className={spreadsheetStyles.toolbarSecondary}>
        <div className={spreadsheetStyles.toolbarMeta}>
          <span>{detail.versionLabel}</span>
          <span>{formatDate(detail.createdAt)}</span>
          <span>{formatEstimateStatus(detail.status)}</span>
          {estimateTotal !== null && estimateTotal !== undefined ? <span>{`Estimate ${formatMoney(estimateTotal)}`}</span> : null}
          <span>{`True cost ${formatMoney(trueCostExGst)}`}</span>
        </div>

        <button type="button" className={spreadsheetStyles.toolbarAction} onClick={onOpenEstimate}>
          Open estimate
        </button>
      </div>

      {warningMessage ? (
        <div className={spreadsheetStyles.toolbarWarning} role="status" aria-live="polite">
          {warningMessage}
        </div>
      ) : null}
    </div>
  );
}

export function coerceJobPackSheet(value: string | null | undefined): JobPackSheetKey {
  return (JOB_PACK_SHEETS.find((item) => item.key === value)?.key ?? DEFAULT_SHEET) as JobPackSheetKey;
}

export function useJobPackSpreadsheetAdapter({
  hostKey,
  detail,
  sheet,
  onSheetChange,
  onBackToList,
  onOpenEstimate,
  showNotesColumn,
  onShowNotesColumnChange,
}: {
  hostKey: string;
  detail: EstimateDetail | null;
  sheet: JobPackSheetKey;
  onSheetChange: (sheet: JobPackSheetKey) => void;
  onBackToList: () => void;
  onOpenEstimate: () => void;
  showNotesColumn: boolean;
  onShowNotesColumnChange: (checked: boolean) => void;
}): SpreadsheetAdapter<JobPackRow, JobPackCellKey, JobPackEditableCellKey, string, JobPackPowdercoatStoredRow[]> | null {
  const queryClient = useQueryClient();
  const powdercoatQueryOptions = useMemo(
    () => jobPackPowdercoatingQueryOptions(hostKey, detail?.id ?? '__pending__'),
    [detail?.id, hostKey],
  );
  const powdercoatQuery = useQuery({
    ...powdercoatQueryOptions,
    enabled: Boolean(detail?.id),
  });

  const powdercoatData = powdercoatQuery.data ?? emptyPowdercoatSheetResponse();
  const powdercoatWarningMessage = powdercoatQuery.isError
    ? powdercoatQuery.error instanceof Error
      ? powdercoatQuery.error.message
      : 'Powdercoating rows are available, but profile options could not be loaded.'
    : powdercoatData.warningMessage;

  const workbook = useMemo(() => {
    if (!detail) return null;
    try {
      return buildWorkbook(detail, powdercoatData.overrides, powdercoatData.options);
    } catch {
      return null;
    }
  }, [detail, powdercoatData.options, powdercoatData.overrides]);

  const readPowdercoatResponse = useCallback(
    () => queryClient.getQueryData<JobPackPowdercoatSheetResponse>(powdercoatQueryOptions.queryKey) ?? powdercoatData,
    [powdercoatData, powdercoatQueryOptions.queryKey, queryClient],
  );

  const setPowdercoatResponse = useCallback(
    (next: JobPackPowdercoatSheetResponse) => {
      queryClient.setQueryData<JobPackPowdercoatSheetResponse>(powdercoatQueryOptions.queryKey, next);
    },
    [powdercoatQueryOptions.queryKey, queryClient],
  );

  const setDisplayedPowdercoatRows = useCallback(
    (rows: JobPackPowdercoatStoredRow[]) => {
      const latest = readPowdercoatResponse();
      setPowdercoatResponse({
        ...latest,
        overrides: {
          ...latest.overrides,
          rows,
        },
      });
    },
    [readPowdercoatResponse, setPowdercoatResponse],
  );

  return useMemo(() => {
    if (!detail || !workbook) return null;

    const activeSheet = workbook.sheets[sheet] ?? workbook.sheets[DEFAULT_SHEET];
    const visibleColumns =
      !showNotesColumn && activeSheet.notesColumnKey
        ? activeSheet.columns.filter((column) => column.key !== activeSheet.notesColumnKey)
        : activeSheet.columns;
    const defaultActiveKey =
      !showNotesColumn && activeSheet.notesColumnKey === activeSheet.defaultActiveKey
        ? (visibleColumns[0]?.key ?? activeSheet.defaultActiveKey)
        : activeSheet.defaultActiveKey;
    const allRows = activeSheet.groups.flatMap((group) => group.rows);

    return {
      title: `Job Pack ${detail.versionLabel}`,
      toolbar: (
        <SheetToolbar
          detail={detail}
          sheet={sheet}
          trueCostExGst={workbook.jobPack.summary.totals.trueCostExGst}
          estimateTotal={detail.summary.total ?? null}
          onSheetChange={onSheetChange}
          onBackToList={onBackToList}
          onOpenEstimate={onOpenEstimate}
          showHideNotesToggle={Boolean(activeSheet.notesColumnKey)}
          showNotesColumn={showNotesColumn}
          onShowNotesColumnChange={onShowNotesColumnChange}
          warningMessage={sheet === 'powdercoating-order' ? powdercoatWarningMessage : null}
        />
      ),
      columns: visibleColumns,
      allRows,
      rowNumberRows: allRows,
      groups: activeSheet.groups,
      zoomStorageKey: `sp_job_pack_${sheet}_zoom_v1`,
      defaultActiveKey,
      loading: false,
      hasError: false,
      loadingMessage: 'Loading job pack...',
      errorMessage: 'Failed to load the job pack workbook.',
      emptyMessage: activeSheet.emptyMessage,
      getRowId: (row) => row.id,
      isEditableKey: (key): key is JobPackEditableCellKey => key === 'a' || key === 'c' || key === 'd',
      getRowClassName: () => '',
      getCellClassName: ({ row, column, active, editing, saving, conflict }) => {
        const classes = [spreadsheetStyles.bodyCell];
        if (column.frozen) classes.push(spreadsheetStyles.frozenCell);
        if (sheet === 'powdercoating-order' && row.powdercoat && (column.key === 'a' || column.key === 'd' || (column.key === 'c' && row.powdercoat.stockLengthOptionsM.length > 1))) {
          classes.push(spreadsheetStyles.editableCell);
        }
        if (active) classes.push(spreadsheetStyles.activeCell);
        if (editing) classes.push(spreadsheetStyles.editingCell);
        if (saving) classes.push(spreadsheetStyles.savingCell);
        if (conflict) classes.push(spreadsheetStyles.conflictCell);
        return classes.join(' ');
      },
      formatCellValue: (row, key) => row.cells[key] ?? '',
      renderCellContent: ({ row, column, text }) => {
        if (row.powdercoat?.origin === 'draft') {
          if (column.key === 'a') return <span className={spreadsheetStyles.muted}>Select profile...</span>;
          return '';
        }
        if (row.tone === 'total') return <strong>{text || '-'}</strong>;
        if (row.tone === 'muted') return <span className={spreadsheetStyles.muted}>{text || '-'}</span>;
        return text || '';
      },
      getEditorValue: (row, key) => {
        const powdercoat = row.powdercoat;
        if (!powdercoat) return '';
        if (key === 'a') return powdercoat.storedRow.profile;
        if (key === 'c') return typeof powdercoat.storedRow.stockLengthM === 'number' ? String(powdercoat.storedRow.stockLengthM) : '';
        if (key === 'd') return String(powdercoat.storedRow.qty);
        return '';
      },
      renderEditor: ({ row, key, value, setValue, commit, cancel, commitToNeighbor, editorRef, onBlur }) => {
        const powdercoat = row.powdercoat;
        if (!powdercoat) return null;

        const onKeyDown = async (event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
          if (event.key === 'Escape') {
            cancel();
            return;
          }
          if (event.key === 'Tab') {
            event.preventDefault();
            await commitToNeighbor(event.shiftKey ? -1 : 1);
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            await commit();
          }
        };

        if (key === 'a') {
          return (
            <select
              ref={editorRef}
              onBlur={onBlur}
              className={spreadsheetStyles.cellSelect}
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={onKeyDown}
            >
              <option value="" disabled>
                Select profile
              </option>
              {powdercoatData.options.map((option) => (
                <option key={option.profile} value={option.profile}>
                  {option.profile}
                </option>
              ))}
            </select>
          );
        }

        if (key === 'c') {
          return (
            <select
              ref={editorRef}
              onBlur={onBlur}
              className={spreadsheetStyles.cellSelect}
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={onKeyDown}
            >
              <option value="" disabled>
                Select length
              </option>
              {powdercoat.stockLengthOptionsM.map((stockLength) => (
                <option key={stockLength} value={stockLength}>
                  {formatStockLengthM(stockLength)}
                </option>
              ))}
            </select>
          );
        }

        return (
          <input
            ref={editorRef}
            onBlur={onBlur}
            className={spreadsheetStyles.cellInput}
            type="number"
            min={1}
            step={1}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
          />
        );
      },
      optimisticEditing: detail
        ? {
            getLatestConfirmedModel: () => readPowdercoatResponse().overrides.rows,
            displayModel: (_queueKey, model) => {
              setDisplayedPowdercoatRows(model);
            },
            prepareEdit: ({ row, rowId, key, value, displayedModel }) => {
              if (sheet !== 'powdercoating-order' || !row.powdercoat) {
                return { kind: 'noop' } as const;
              }

              const nextRows = applyPowdercoatEditToModel({
                detail,
                rows: displayedModel,
                options: powdercoatData.options,
                rowId,
                key,
                value,
              });

              if (!nextRows) {
                return { kind: 'error', message: getPowdercoatValidationMessage(key) } as const;
              }

              return {
                kind: 'enqueue',
                edit: {
                  applyToModel: (currentRows) =>
                    applyPowdercoatEditToModel({
                      detail,
                      rows: currentRows,
                      options: powdercoatData.options,
                      rowId,
                      key,
                      value,
                    }) ?? currentRows,
                  persist: async (currentRows) => {
                    const latest = readPowdercoatResponse();
                    const rowsForSave =
                      applyPowdercoatEditToModel({
                        detail,
                        rows: currentRows,
                        options: latest.options,
                        rowId,
                        key,
                        value,
                      }) ?? currentRows;

                    try {
                      const response = await apiJson<JobPackPowdercoatUpdateResponse>('/api/staff/v1/job-packs/powdercoating', {
                        method: 'POST',
                        body: JSON.stringify({
                          estimateId: detail.id,
                          expectedVersion: latest.overrides.version,
                          rows: rowsForSave,
                        }),
                      });

                      setPowdercoatResponse({
                        ...latest,
                        overrides: response.overrides,
                      });

                      return {
                        kind: 'success',
                        confirmedModel: response.overrides.rows,
                      } as const;
                    } catch (error) {
                      if (error instanceof ApiError && error.status === 409) {
                        const currentOverrides = (error.body as any)?.currentOverrides;
                        if (currentOverrides && typeof currentOverrides === 'object') {
                          setPowdercoatResponse({
                            ...latest,
                            overrides: currentOverrides as JobPackPowdercoatOverrideState,
                          });
                          return {
                            kind: 'drop',
                            confirmedModel: (currentOverrides as JobPackPowdercoatOverrideState).rows,
                            message: 'This powdercoating row changed in another tab. The latest values have been reloaded.',
                            conflict: true,
                          } as const;
                        }
                      }

                      return {
                        kind: 'drop',
                        confirmedModel: currentRows,
                        message: error instanceof Error ? error.message : 'Failed to save the powdercoating sheet.',
                      } as const;
                    }
                  },
                },
              } as const;
            },
          }
        : undefined,
      onCellActivated: async ({ trigger, row, key, seed, beginEdit }) => {
        if (sheet !== 'powdercoating-order' || !row.powdercoat) return 'noop';
        if (key !== 'a' && key !== 'c' && key !== 'd') return 'noop';
        if (!powdercoatData.options.length && key === 'a') return 'noop';
        if (row.powdercoat.origin === 'draft' && key !== 'a') return 'noop';
        if (key === 'c' && row.powdercoat.stockLengthOptionsM.length <= 1) return 'noop';

        if (trigger === 'click' || trigger === 'enter' || trigger === 'double_click') {
          beginEdit();
          return 'handled';
        }

        if (trigger === 'printable' && seed && key === 'd') {
          beginEdit(seed);
          return 'handled';
        }

        return 'noop';
      },
    };
  }, [
    detail,
    onBackToList,
    onOpenEstimate,
    onSheetChange,
    onShowNotesColumnChange,
    powdercoatData.options,
    powdercoatWarningMessage,
    sheet,
    showNotesColumn,
    workbook,
    readPowdercoatResponse,
    setDisplayedPowdercoatRows,
    setPowdercoatResponse,
  ]);
}
