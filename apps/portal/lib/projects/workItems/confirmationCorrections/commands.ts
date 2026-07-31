import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import type {
  ConfirmationCorrectionInput,
  ConfirmationCorrectionResult,
  ConfirmationCorrectionReviewInput,
  ConfirmationCorrectionReviewResult,
} from './types';

type Row = Record<string, unknown>;

function firstRow(value: unknown): Row {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? (row as Row) : {};
}

function text(row: Row, snake: string, camel: string): string | null {
  const value = row[snake] ?? row[camel];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function positiveInteger(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

async function callRpc(
  supabase: SupabaseClient,
  name: string,
  params: Record<string, unknown>,
): Promise<Row> {
  const result = await supabase.rpc(name, params);
  if (result.error) {
    throw Object.assign(
      new Error(result.error.message ?? 'Project work correction failed'),
      result.error,
    );
  }
  return firstRow(result.data);
}

export async function runConfirmationCorrection(
  supabase: SupabaseClient,
  input: ConfirmationCorrectionInput & { projectUuid: string },
): Promise<ConfirmationCorrectionResult> {
  const row = await callRpc(supabase, 'project_confirmation_retraction_command', {
    p_project_id: input.projectUuid,
    p_command_id: input.commandId,
    p_confirmation_event_id: input.confirmationEventId,
    p_reason: input.reason,
  });
  const projectId = text(row, 'project_id', 'projectId') ?? input.projectUuid;
  const retractionEventId = text(
    row,
    'retraction_event_id',
    'retractionEventId',
  );
  const repairSignalId = text(row, 'repair_signal_id', 'repairSignalId');
  if (!retractionEventId || !repairSignalId) {
    throw new Error('Confirmation correction returned an incomplete result');
  }
  return {
    projectId: appIdFromUuid('proj', projectId),
    confirmationEventId:
      text(row, 'confirmation_event_id', 'confirmationEventId')
      ?? input.confirmationEventId,
    retractionEventId,
    repairSignalId,
    reviewRequired: true,
    replayed: row.replayed === true,
    refreshRequired:
      row.refresh_required === true || row.refreshRequired === true,
  };
}

export async function runConfirmationCorrectionReview(
  supabase: SupabaseClient,
  input: ConfirmationCorrectionReviewInput & { projectUuid: string },
): Promise<ConfirmationCorrectionReviewResult> {
  const row = await callRpc(
    supabase,
    'project_confirmation_retraction_review_command',
    {
      p_project_id: input.projectUuid,
      p_repair_signal_id: input.repairSignalId,
      p_expected_signal_row_version: input.expectedSignalRowVersion,
      p_command_id: input.commandId,
      p_reason: input.reason,
    },
  );
  const projectId = text(row, 'project_id', 'projectId') ?? input.projectUuid;
  const repairSignalId = text(row, 'repair_signal_id', 'repairSignalId');
  if (!repairSignalId) {
    throw new Error('Confirmation correction review returned no signal identity');
  }
  return {
    projectId: appIdFromUuid('proj', projectId),
    repairSignalId,
    signalRowVersion: positiveInteger(
      row.signal_row_version ?? row.signalRowVersion,
    ),
    resolvedCount: positiveInteger(row.resolved_count ?? row.resolvedCount),
    reviewRequired: false,
    replayed: row.replayed === true,
    refreshRequired:
      row.refresh_required === true || row.refreshRequired === true,
  };
}
