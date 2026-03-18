import type {
  RunningJobEditableCellKey,
  RunningJobRow,
  RunningJobsResponse,
  RunningJobStatusValue,
} from './types';

export type NormalizedRunningJobCellValue = string | number | boolean | RunningJobStatusValue | null;

export type RunningJobEditability = {
  editable: boolean;
  reason?: string;
};

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toNullableString(value: unknown): string | null {
  const trimmed = toTrimmedString(value);
  return trimmed ? trimmed : null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 'Y' || value === 'y' || value === 1 || value === '1') return true;
  if (value === '' || value === 0 || value === '0') return false;
  return null;
}

function toNullablePositiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const next = Math.trunc(value);
    return next > 0 ? next : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function normalizeRunningJobCellInput(
  key: RunningJobEditableCellKey,
  value: unknown,
): { ok: true; value: NormalizedRunningJobCellValue } | { ok: false; error: string } {
  switch (key) {
    case 'client_name': {
      const next = toTrimmedString(value);
      if (!next) return { ok: false, error: 'Client name is required.' };
      return { ok: true, value: next };
    }
    case 'phone_number':
    case 'site_address':
      return { ok: true, value: toTrimmedString(value) };
    case 'running_notes':
      return { ok: true, value: typeof value === 'string' ? value.trim() : '' };
    case 'site_visit_rep':
      return { ok: true, value: toNullableString(value) };
    case 'deposit_paid_date':
    case 'final_payment_date': {
      const next = toNullableString(value);
      if (next !== null && !isYmd(next)) return { ok: false, error: 'Date must use YYYY-MM-DD.' };
      return { ok: true, value: next };
    }
    case 'estimated_start_date': {
      const next = toNullableString(value);
      if (!next) return { ok: false, error: 'Estimated start date is required.' };
      if (!isYmd(next)) return { ok: false, error: 'Estimated start must use YYYY-MM-DD.' };
      return { ok: true, value: next };
    }
    case 'job_assigned_to': {
      const next = toNullableString(value);
      if (!next) return { ok: false, error: 'Crew is required.' };
      return { ok: true, value: next };
    }
    case 'install_days': {
      const next = toNullablePositiveInt(value);
      if (next === null) return { ok: false, error: 'Install days must be at least 1.' };
      return { ok: true, value: next };
    }
    case 'materials_ordered':
    case 'roofing_ordered':
    case 'job_completed': {
      const next = toBoolean(value);
      if (next === null) return { ok: false, error: 'Value must be a checkbox state.' };
      return { ok: true, value: next };
    }
    case 'lights_status':
      if (value === 'No' || value === 'Yes' || value === 'TBC') {
        return { ok: true, value };
      }
      return { ok: false, error: 'Lights must be No, Yes, or TBC.' };
    default: {
      const exhaustive: never = key;
      return { ok: false, error: `Unsupported cell ${exhaustive}` };
    }
  }
}

export function getRunningJobCellEditability(row: RunningJobRow, key: RunningJobEditableCellKey): RunningJobEditability {
  if (row.source === 'legacy') {
    return { editable: false, reason: 'Legacy import rows are read-only.' };
  }
  switch (key) {
    case 'estimated_start_date':
      return row.state.hasCrewAssigned ? { editable: true } : { editable: false, reason: 'Assign a crew first.' };
    case 'install_days':
    case 'job_completed':
      return row.state.hasSchedule ? { editable: true } : { editable: false, reason: 'Create schedule state first.' };
    default:
      return { editable: true };
  }
}

export function getRunningJobEditorValue(row: RunningJobRow, key: RunningJobEditableCellKey): NormalizedRunningJobCellValue {
  switch (key) {
    case 'client_name':
      return row.cells.client_name;
    case 'phone_number':
      return row.cells.phone_number;
    case 'site_address':
      return row.cells.site_address;
    case 'site_visit_rep':
      return row.state.siteVisit.salespersonId ?? null;
    case 'deposit_paid_date':
      return row.cells.deposit_paid_date;
    case 'materials_ordered':
      return row.cells.materials_ordered;
    case 'estimated_start_date':
      return row.cells.estimated_start_date;
    case 'final_payment_date':
      return row.cells.final_payment_date;
    case 'job_assigned_to':
      return row.state.schedule.crewId ?? null;
    case 'job_completed':
      return row.cells.job_completed;
    case 'lights_status':
      return row.cells.lights_status;
    case 'install_days':
      return row.cells.install_days;
    case 'roofing_ordered':
      return row.cells.roofing_ordered;
    case 'running_notes':
      return row.cells.running_notes;
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

export function isRunningJobCellValueUnchanged(
  row: RunningJobRow,
  key: RunningJobEditableCellKey,
  nextValue: NormalizedRunningJobCellValue,
): boolean {
  const current = normalizeRunningJobCellInput(key, getRunningJobEditorValue(row, key));
  return current.ok ? Object.is(current.value, nextValue) : false;
}

export function applyOptimisticRunningJobCellValue(
  row: RunningJobRow,
  key: RunningJobEditableCellKey,
  value: NormalizedRunningJobCellValue,
  lookups: RunningJobsResponse['lookups'],
): RunningJobRow {
  const salesById = new Map(lookups.salesPeople.map((person) => [person.id, person]));
  const crewsById = new Map(lookups.crews.map((crew) => [crew.id, crew]));

  const next: RunningJobRow = {
    ...row,
    sortDate: key === 'estimated_start_date' ? (typeof value === 'string' ? value : null) : row.sortDate,
    cells: { ...row.cells },
    state: {
      ...row.state,
      tasks: { ...row.state.tasks },
      siteVisit: { ...row.state.siteVisit },
      schedule: { ...row.state.schedule },
      meta: { ...row.state.meta },
    },
  };

  switch (key) {
    case 'client_name':
      next.cells.client_name = typeof value === 'string' ? value : '';
      break;
    case 'phone_number':
      next.cells.phone_number = typeof value === 'string' ? value : '';
      break;
    case 'site_address':
      next.cells.site_address = typeof value === 'string' ? value : '';
      break;
    case 'site_visit_rep':
      next.state.siteVisit.salespersonId = typeof value === 'string' ? value : null;
      next.cells.site_visit_rep = typeof value === 'string' ? (salesById.get(value)?.shortLabel ?? value) : null;
      break;
    case 'deposit_paid_date':
      next.cells.deposit_paid_date = typeof value === 'string' ? value : null;
      break;
    case 'materials_ordered':
      next.cells.materials_ordered = Boolean(value);
      next.state.tasks.materialsOrdered = Boolean(value);
      if (!value) next.state.tasks.jobComplete = false;
      break;
    case 'estimated_start_date':
      next.cells.estimated_start_date = typeof value === 'string' ? value : null;
      next.state.schedule.forecastStart = typeof value === 'string' ? value : null;
      next.state.hasEstimatedStartDate = Boolean(value);
      break;
    case 'final_payment_date':
      next.cells.final_payment_date = typeof value === 'string' ? value : null;
      break;
    case 'job_assigned_to': {
      const crewId = typeof value === 'string' ? value : null;
      const crew = crewId ? crewsById.get(crewId) ?? null : null;
      next.state.schedule.crewId = crewId;
      next.state.hasCrewAssigned = Boolean(crewId);
      next.state.hasSchedule = next.state.hasSchedule || Boolean(crewId);
      next.cells.job_assigned_to = crew ? crew.shortCode ?? crew.name : null;
      break;
    }
    case 'job_completed':
      next.cells.job_completed = Boolean(value);
      next.state.tasks.jobComplete = Boolean(value);
      break;
    case 'lights_status':
      next.cells.lights_status = value === 'No' || value === 'Yes' || value === 'TBC' ? value : 'TBC';
      next.state.meta.lightsStatus = next.cells.lights_status;
      break;
    case 'install_days':
      next.cells.install_days = typeof value === 'number' ? value : null;
      next.state.schedule.forecastDurationDays = typeof value === 'number' ? value : null;
      break;
    case 'roofing_ordered':
      next.cells.roofing_ordered = Boolean(value);
      next.state.tasks.roofingOrdered = Boolean(value);
      break;
    case 'running_notes':
      next.cells.running_notes = typeof value === 'string' ? value : '';
      break;
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }

  return next;
}
