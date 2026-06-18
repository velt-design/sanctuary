import type { RunningJobCellKey, RunningJobStatusValue } from './types';

export const LEGACY_RUNNING_JOB_SOURCE_COLUMNS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
] as const;

type LegacyRunningJobSourceColumn = (typeof LEGACY_RUNNING_JOB_SOURCE_COLUMNS)[number];
export type LegacyRunningJobSourceCells = Record<LegacyRunningJobSourceColumn, string | null>;
export type LegacyRunningJobDisplayCells = Partial<Record<RunningJobCellKey, string>>;

const LEGACY_RUNNING_JOB_CELL_BY_COLUMN: Record<LegacyRunningJobSourceColumn, RunningJobCellKey> = {
  A: 'client_name',
  B: 'phone_number',
  C: 'site_address',
  D: 'site_visit_rep',
  E: 'deposit_paid_date',
  F: 'materials_ordered',
  G: 'pergola_type',
  H: 'estimated_start_date',
  I: 'final_payment_date',
  J: 'job_assigned_to',
  K: 'job_completed',
  L: 'lights_status',
  M: 'blinds_status',
  N: 'install_days',
  O: 'size_text',
  P: 'colour_text',
  Q: 'roofing_text',
  R: 'roofing_ordered',
  S: 'running_notes',
};

const IGNORED_LABELS = new Set([
  'colour legend',
  'black',
  'brown (neutral)',
  'yellow',
  'blue',
  'all blue',
  'green',
  'grey',
  'hide',
  'job list',
  'client name',
  'blinds to install',
]);

function trimToNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\u00a0/g, ' ').trim();
  return text ? text : null;
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeMatchText(value: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || null;
}

function parseNumericString(value: string): number | null {
  if (!/^-?\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const next = Number.parseFloat(value.trim());
  return Number.isFinite(next) ? next : null;
}

export function emptyLegacySourceCells(): LegacyRunningJobSourceCells {
  return {
    A: null,
    B: null,
    C: null,
    D: null,
    E: null,
    F: null,
    G: null,
    H: null,
    I: null,
    J: null,
    K: null,
    L: null,
    M: null,
    N: null,
    O: null,
    P: null,
    Q: null,
    R: null,
    S: null,
  };
}

export function isLegacyYearDividerText(value: string | null): boolean {
  return Boolean(value && /^\d{4}$/.test(value.trim()));
}

export function isLegacyProjectRow(sourceRowNumber: number, cells: LegacyRunningJobSourceCells): boolean {
  if (sourceRowNumber <= 11) return false;

  const clientName = trimToNull(cells.A);
  if (!clientName) return false;

  if (isLegacyYearDividerText(clientName)) return false;

  const label = clientName.toLowerCase();
  if (IGNORED_LABELS.has(label)) return false;

  const hasAnyOtherValue = LEGACY_RUNNING_JOB_SOURCE_COLUMNS.some((column) => column !== 'A' && trimToNull(cells[column]));
  return hasAnyOtherValue;
}

export function normalizeLegacyClientName(value: string | null): string | null {
  return normalizeMatchText(trimToNull(value));
}

export function normalizeLegacyPhone(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D+/g, '');
  return digits || null;
}

export function normalizeLegacyAddress(value: string | null): string | null {
  return normalizeMatchText(trimToNull(value));
}

export function parseLegacyExcelDateYmd(value: string | null): string | null {
  const trimmed = trimToNull(value);
  if (!trimmed) return null;

  const directYmd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (directYmd) return `${directYmd[1]}-${directYmd[2]}-${directYmd[3]}`;

  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    const first = Number.parseInt(dmy[1], 10);
    const second = Number.parseInt(dmy[2], 10);
    const [dayNum, monthNum] = first > 12 ? [first, second] : second > 12 ? [second, first] : [first, second];
    const month = String(monthNum).padStart(2, '0');
    const day = String(dayNum).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const numeric = parseNumericString(trimmed);
  if (numeric === null) return null;
  if (numeric < 20000 || numeric > 80000) return null;

  const excelEpochUtc = Date.UTC(1899, 11, 30);
  const millis = excelEpochUtc + Math.round(numeric) * 24 * 60 * 60 * 1000;
  const date = new Date(millis);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLegacyPositiveInt(value: string | null): number | null {
  const trimmed = trimToNull(value);
  if (!trimmed) return null;
  const next = parseNumericString(trimmed);
  if (next === null) return null;
  const whole = Math.trunc(next);
  return whole > 0 ? whole : null;
}

export function parseLegacyBoolean(value: string | null): boolean {
  const trimmed = trimToNull(value)?.toLowerCase() ?? '';
  if (!trimmed) return false;
  if (trimmed === 'y' || trimmed === 'yes' || trimmed === 'true') return true;
  if (trimmed === '1') return true;
  return false;
}

export function parseLegacyStatusValue(value: string | null): RunningJobStatusValue {
  const trimmed = trimToNull(value);
  if (!trimmed) return 'No';

  const lower = trimmed.toLowerCase();
  if (lower === 'no' || lower === 'n' || lower === '0') return 'No';
  if (lower === 'yes' || lower === 'y') return 'Yes';
  const numeric = parseNumericString(trimmed);
  if (numeric !== null) return numeric > 0 ? 'Yes' : 'No';
  return 'TBC';
}

export function inferLegacyGroupYear(params: {
  explicitYear: number | null;
  estimatedStart: string | null;
  finalPayment: string | null;
  depositPaid: string | null;
}): number | null {
  if (params.explicitYear) return params.explicitYear;
  const candidate = params.estimatedStart ?? params.finalPayment ?? params.depositPaid;
  if (!candidate) return null;
  const match = candidate.match(/^(\d{4})-/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function toLegacyDisplayCells(sourceCells: LegacyRunningJobSourceCells): LegacyRunningJobDisplayCells {
  const display: LegacyRunningJobDisplayCells = {};
  for (const column of LEGACY_RUNNING_JOB_SOURCE_COLUMNS) {
    const key = LEGACY_RUNNING_JOB_CELL_BY_COLUMN[column];
    const value = trimToNull(sourceCells[column]);
    if (value) display[key] = collapseSpaces(value);
  }
  return display;
}

