import type { DesignListRow, DesignPackagesResponse, DesignRequestPriorityTier } from './types';

const DESIGN_LIST_PRIORITY_ORDER: readonly DesignRequestPriorityTier[] = ['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'UNPRICED'];

function requestedYear(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

export function yearForDesignListRow(row: DesignListRow): number {
  return requestedYear(row.requestedAt) ?? new Date().getFullYear();
}

export function compareDesignListRows(a: DesignListRow, b: DesignListRow): number {
  const yearDiff = yearForDesignListRow(a) - yearForDesignListRow(b);
  if (yearDiff !== 0) return yearDiff;
  if (a.requestedAt !== b.requestedAt) return a.requestedAt.localeCompare(b.requestedAt);
  const tierDiff = DESIGN_LIST_PRIORITY_ORDER.indexOf(a.priorityTier) - DESIGN_LIST_PRIORITY_ORDER.indexOf(b.priorityTier);
  if (tierDiff !== 0) return tierDiff;
  return a.quoteName.localeCompare(b.quoteName, undefined, { sensitivity: 'base' });
}

export function groupDesignListRows(rows: DesignListRow[]): Array<{ year: number; rows: DesignListRow[] }> {
  const byYear = new Map<number, DesignListRow[]>();
  for (const row of rows) {
    const year = yearForDesignListRow(row);
    const bucket = byYear.get(year) ?? [];
    bucket.push(row);
    byYear.set(year, bucket);
  }

  return Array.from(byYear.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, yearRows]) => ({
      year,
      rows: yearRows.slice().sort(compareDesignListRows),
    }));
}

export function updateDesignListRow(rows: DesignPackagesResponse['rows'], requestId: string, updater: (row: DesignListRow) => DesignListRow): DesignListRow[] {
  return rows.map((row) => (row.requestId === requestId ? updater(row) : row)).sort(compareDesignListRows);
}
