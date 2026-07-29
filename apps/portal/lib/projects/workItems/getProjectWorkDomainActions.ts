import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProjectCommandCentreCurrentDesign } from '@/lib/projects/commandCentre/types';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import {
  commercialProjectWorkActions,
  type ProjectWorkDomainActions,
} from './domainActionAdapters';
import type { RecoveryActionCandidate } from './primaryAction';

type RepairSignalRow = {
  id?: unknown;
  quote_version_id?: unknown;
  error_message?: unknown;
};

function requiredText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function quoteRepairRecoveryAction(
  row: RepairSignalRow | null,
  projectId: string,
): RecoveryActionCandidate | null {
  if (!row) return null;
  const id = requiredText(row.id);
  const quoteVersionUuid = requiredText(row.quote_version_id);
  const reason = requiredText(row.error_message);
  if (!id || !quoteVersionUuid || !reason) {
    throw new Error('Open quote cadence repair signal is incomplete');
  }
  const quoteVersionId = appIdFromUuid('qv', quoteVersionUuid);
  const basePath = `/staff/projects/${encodeURIComponent(projectId)}`;
  return {
    kind: 'recovery',
    key: `quote-cadence-repair:${id}`,
    title: 'Repair quote follow-up sync',
    reason,
    href: `${basePath}?tab=quotes&quoteId=${encodeURIComponent(quoteVersionId)}`,
  };
}

/**
 * Joins durable recovery facts to the pure specialist-domain adapter.
 *
 * The repair table contains bounded staff-safe messages. Provider errors and
 * commercial state are deliberately not re-derived here.
 */
export async function getProjectWorkDomainActions(params: {
  supabase: SupabaseClient;
  projectId: string;
  projectUuid: string;
  currentDesign: ProjectCommandCentreCurrentDesign;
}): Promise<ProjectWorkDomainActions> {
  const result = await params.supabase
    .from('project_work_repair_signals')
    .select('id,quote_version_id,error_message')
    .eq('project_id', params.projectUuid)
    .eq('status', 'OPEN')
    .order('first_detected_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1);
  if (result.error) {
    throw Object.assign(
      new Error(result.error.message ?? 'Failed to load project work recovery signals'),
      result.error,
    );
  }
  const row = Array.isArray(result.data)
    ? (result.data[0] as RepairSignalRow | undefined) ?? null
    : null;
  return commercialProjectWorkActions(
    params.currentDesign,
    quoteRepairRecoveryAction(row, params.projectId),
  );
}
