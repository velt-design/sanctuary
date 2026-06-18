import type { RunningJobRow, RunningJobsResponse } from './types';

function firstYear(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

export function yearForRunningJobRow(row: RunningJobRow): number {
  return row.groupYear ?? firstYear(row.cells.estimated_start_date) ?? firstYear(row.state.projectCreatedAt) ?? new Date().getFullYear();
}

export function compareRunningJobRows(a: RunningJobRow, b: RunningJobRow): number {
  const aDate = firstYear(a.sortDate) ? a.sortDate : a.cells.estimated_start_date;
  const bDate = firstYear(b.sortDate) ? b.sortDate : b.cells.estimated_start_date;
  if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate);
  if (aDate && !bDate) return -1;
  if (!aDate && bDate) return 1;
  if (a.source === 'legacy' && b.source === 'legacy') {
    const aRow = a.sourceRowNumber ?? Number.MAX_SAFE_INTEGER;
    const bRow = b.sourceRowNumber ?? Number.MAX_SAFE_INTEGER;
    if (aRow !== bRow) return aRow - bRow;
  }
  return a.cells.client_name.localeCompare(b.cells.client_name, undefined, { sensitivity: 'base' });
}

export function flattenRunningJobGroups(groups: RunningJobsResponse['groups']): RunningJobRow[] {
  return groups.flatMap((group) => group.rows);
}

export function groupRunningJobRows(rows: RunningJobRow[]): RunningJobsResponse['groups'] {
  const groupsMap = new Map<number, RunningJobRow[]>();
  for (const row of rows) {
    const year = yearForRunningJobRow(row);
    const bucket = groupsMap.get(year) ?? [];
    bucket.push(row);
    groupsMap.set(year, bucket);
  }

  return Array.from(groupsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, yearRows]) => ({
      year,
      rows: yearRows.slice().sort(compareRunningJobRows),
    }));
}

export function updateRunningJobRowInGroups(
  groups: RunningJobsResponse['groups'],
  projectId: string,
  updater: (row: RunningJobRow) => RunningJobRow,
): RunningJobsResponse['groups'] {
  const rows = flattenRunningJobGroups(groups);
  const next = rows.map((row) => (row.projectId === projectId ? updater(row) : row));
  return groupRunningJobRows(next);
}
