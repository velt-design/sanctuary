import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

type ProjectWorkCommandResult = {
  replayed: boolean;
  projectId: string;
  workItemId: string | null;
  rowVersion: number | null;
  refreshRequired: boolean;
  raw: Record<string, unknown>;
};

function firstRow(value: unknown): Record<string, unknown> {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? row as Record<string, unknown> : {};
}

function normalizeResult(value: unknown, projectId: string): ProjectWorkCommandResult {
  const row = firstRow(value);
  const parsedVersion = Number(row.row_version ?? row.rowVersion);
  return {
    replayed: row.replayed === true,
    projectId: typeof row.project_id === 'string' ? row.project_id : projectId,
    workItemId: typeof row.work_item_id === 'string'
      ? row.work_item_id
      : typeof row.workItemId === 'string'
        ? row.workItemId
        : null,
    rowVersion: Number.isInteger(parsedVersion) && parsedVersion > 0 ? parsedVersion : null,
    refreshRequired: row.refresh_required === true || row.refreshRequired === true,
    raw: row,
  };
}

async function callCommand(
  supabase: SupabaseClient,
  rpc: string,
  params: Record<string, unknown>,
  projectId: string,
): Promise<ProjectWorkCommandResult> {
  const result = await supabase.rpc(rpc, params);
  if (result.error) {
    throw Object.assign(new Error(result.error.message ?? 'Project work command failed'), result.error);
  }
  return normalizeResult(result.data, projectId);
}

export function runProjectWorkItemCommand(
  supabase: SupabaseClient,
  input: {
    projectId: string;
    commandId: string;
    command: string;
    payload: Record<string, unknown>;
  },
): Promise<ProjectWorkCommandResult> {
  return callCommand(supabase, 'project_work_item_command', {
    p_project_id: input.projectId,
    p_command_id: input.commandId,
    p_command: input.command,
    p_payload: input.payload,
  }, input.projectId);
}

export function runProjectOperationalStateCommand(
  supabase: SupabaseClient,
  input: {
    projectId: string;
    commandId: string;
    command: string;
    payload: Record<string, unknown>;
  },
): Promise<ProjectWorkCommandResult> {
  return callCommand(supabase, 'project_operational_state_command', {
    p_project_id: input.projectId,
    p_command_id: input.commandId,
    p_command: input.command,
    p_payload: input.payload,
  }, input.projectId);
}

export function runProjectConfirmationCommand(
  supabase: SupabaseClient,
  input: {
    projectId: string;
    commandId: string;
    command: string;
    payload: Record<string, unknown>;
  },
): Promise<ProjectWorkCommandResult> {
  return callCommand(supabase, 'project_confirmation_command', {
    p_project_id: input.projectId,
    p_command_id: input.commandId,
    p_command: input.command,
    p_payload: input.payload,
  }, input.projectId);
}

export function runProjectArchiveCommand(
  supabase: SupabaseClient,
  input: {
    projectId: string;
    commandId: string;
    archived: boolean;
    expectedStateVersion: number;
    reason: string;
  },
): Promise<ProjectWorkCommandResult> {
  return callCommand(supabase, 'project_work_archive_command', {
    p_project_id: input.projectId,
    p_command_id: input.commandId,
    p_archived: input.archived,
    p_expected_state_version: input.expectedStateVersion,
    p_reason: input.reason,
  }, input.projectId);
}

export function reconcileProjectWork(
  serviceClient: SupabaseClient,
  input: {
    projectId: string;
    commandId: string;
    event:
      | 'QUOTE_SENT'
      | 'QUOTE_RESENT'
      | 'QUOTE_OUTCOME'
      | 'RECONCILE_PROJECT';
    payload: Record<string, unknown>;
  },
): Promise<ProjectWorkCommandResult> {
  return callCommand(serviceClient, 'project_work_item_reconcile', {
    p_project_id: input.projectId,
    p_command_id: input.commandId,
    p_event: input.event,
    p_payload: input.payload,
  }, input.projectId);
}

export function setQuoteCadenceRepairSignal(
  serviceClient: SupabaseClient,
  input: {
    projectId: string;
    commandId: string;
    event: 'QUOTE_SENT' | 'QUOTE_RESENT' | 'QUOTE_OUTCOME';
    quoteVersionId: string;
    action: 'OPEN' | 'RESOLVE';
    errorCode?: string;
    errorMessage?: string;
  },
): Promise<ProjectWorkCommandResult> {
  return callCommand(serviceClient, 'project_work_quote_repair_signal_command', {
    p_project_id: input.projectId,
    p_command_id: input.commandId,
    p_event: input.event,
    p_quote_version_id: input.quoteVersionId,
    p_action: input.action,
    p_error_code: input.errorCode ?? null,
    p_error_message: input.errorMessage ?? null,
  }, input.projectId);
}
