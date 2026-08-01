import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProjectCommandCentreCurrentDesign } from '@/lib/projects/commandCentre/types';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { projectWorkDomainActions, type ProjectWorkDomainActions } from './domainActionAdapters';
import { hasActiveProjectConfirmation } from './confirmationFacts';
import type { RecoveryActionCandidate } from './primaryAction';

type RepairSignalRow = {
  id?: unknown;
  repair_kind?: unknown;
  quote_version_id?: unknown;
  confirmation_event_id?: unknown;
  error_message?: unknown;
};
type ConfirmationIdentityRow = Record<string, unknown>;

function requiredText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function repairRecoveryAction(row: RepairSignalRow | null, projectId: string): RecoveryActionCandidate | null {
  if (!row) return null;
  const id = requiredText(row.id);
  const repairKind = requiredText(row.repair_kind);
  const reason = requiredText(row.error_message);
  if (!id || !repairKind || !reason) {
    throw new Error('Open project work repair signal is incomplete');
  }
  const basePath = `/staff/projects/${encodeURIComponent(projectId)}`;

  if (repairKind === 'CONFIRMATION_RETRACTION_REVIEW') {
    if (!requiredText(row.confirmation_event_id)) {
      throw new Error('Open confirmation correction review signal is incomplete');
    }
    return {
      kind: 'recovery',
      key: `confirmation-retraction-review:${id}`,
      title: 'Review corrected confirmation',
      reason,
      href: `${basePath}?tab=activity`,
      actionLabel: 'Review correction',
    };
  }

  if (repairKind !== 'QUOTE_CADENCE_RECONCILIATION') {
    throw new Error(`Unsupported project work repair signal: ${repairKind}`);
  }
  const quoteVersionUuid = requiredText(row.quote_version_id);
  if (!quoteVersionUuid) {
    throw new Error('Open quote cadence repair signal is incomplete');
  }
  const quoteVersionId = appIdFromUuid('qv', quoteVersionUuid);
  return {
    kind: 'recovery',
    key: `quote-cadence-repair:${id}`,
    title: 'Repair quote follow-up sync',
    reason,
    href: `${basePath}?tab=quotes&quoteId=${encodeURIComponent(quoteVersionId)}`,
    actionLabel: 'Repair quote follow-up',
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
  stage: string;
  currentDesign: ProjectCommandCentreCurrentDesign;
}): Promise<ProjectWorkDomainActions> {
  const stage = params.stage.trim().toLowerCase();
  const confirmationRead =
    stage === 'contacted' || stage === 'site_visit'
      ? params.supabase
          .from('project_confirmation_events')
          .select('id,project_id,event_kind,confirmation_type,retracts_event_id')
          .eq('project_id', params.projectUuid)
          .eq('confirmation_type', 'SITE_VISIT_COMPLETED')
          .limit(100)
      : Promise.resolve({ data: [], error: null });
  const [result, confirmationResult] = await Promise.all([
    params.supabase
      .from('project_work_repair_signals')
      .select('id,repair_kind,quote_version_id,confirmation_event_id,error_message')
      .eq('project_id', params.projectUuid)
      .eq('status', 'OPEN')
      .order('first_detected_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(1),
    confirmationRead,
  ]);
  if (result.error) {
    throw Object.assign(
      new Error(result.error.message ?? 'Failed to load project work recovery signals'),
      result.error,
    );
  }
  if (confirmationResult.error) {
    throw Object.assign(
      new Error(confirmationResult.error.message ?? 'Failed to load project site visit confirmation'),
      confirmationResult.error,
    );
  }
  const row = Array.isArray(result.data) ? ((result.data[0] as RepairSignalRow | undefined) ?? null) : null;
  const confirmationRows = Array.isArray(confirmationResult.data)
    ? (confirmationResult.data as ConfirmationIdentityRow[])
    : [];
  return projectWorkDomainActions(
    {
      projectId: params.projectId,
      stage,
      siteVisitCompleted: hasActiveProjectConfirmation(confirmationRows, params.projectUuid, 'SITE_VISIT_COMPLETED'),
      currentDesign: params.currentDesign,
    },
    repairRecoveryAction(row, params.projectId),
  );
}
