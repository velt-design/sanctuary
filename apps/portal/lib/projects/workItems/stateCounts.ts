import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type ProjectOperationalStateCounts = {
  ACTIVE: number;
  WAITING: number;
  CLOSED: number;
  ARCHIVED: number;
  totalCount: number;
};

function nonNegativeInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Project state counts returned an invalid ${field} count`);
  }
  return parsed;
}

export function mapProjectOperationalStateCounts(
  value: unknown,
): ProjectOperationalStateCounts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Project state counts returned an invalid response');
  }
  const row = value as Record<string, unknown>;
  const counts = {
    ACTIVE: nonNegativeInteger(row.ACTIVE, 'Active'),
    WAITING: nonNegativeInteger(row.WAITING, 'Waiting'),
    CLOSED: nonNegativeInteger(row.CLOSED, 'Closed'),
    ARCHIVED: nonNegativeInteger(row.ARCHIVED, 'Archived'),
    totalCount: nonNegativeInteger(row.totalCount, 'total'),
  };
  const effectiveTotal =
    counts.ACTIVE + counts.WAITING + counts.CLOSED + counts.ARCHIVED;
  if (effectiveTotal !== counts.totalCount) {
    throw new Error('Project state counts returned an inconsistent total');
  }
  return counts;
}

export async function getProjectOperationalStateCounts(
  supabase: SupabaseClient,
): Promise<ProjectOperationalStateCounts> {
  const result = await supabase.rpc('staff_project_state_counts_v1');
  if (result.error) {
    throw Object.assign(
      new Error(result.error.message ?? 'Failed to load project state counts'),
      result.error,
    );
  }
  return mapProjectOperationalStateCounts(result.data);
}
