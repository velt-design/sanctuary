import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  reconcileProjectWork,
  setQuoteCadenceRepairSignal,
} from './commands';
import { isProjectWorkModelV2 } from './modelBoundary';
import { projectWorkSystemCommandId } from './systemCommandId';

type QuoteDeliveryCadenceEvent = 'QUOTE_SENT' | 'QUOTE_RESENT';
type QuoteCadenceOutcome = 'ACCEPTED' | 'DECLINED' | 'SUPERSEDED';

type QuoteCadenceReconciliationResult =
  | Readonly<{
      status: 'reconciled';
      workModel: 'v2';
      commandId: string;
      replayed: boolean;
    }>
  | Readonly<{
      status: 'not_applicable';
      workModel: 'legacy';
      commandId: string;
    }>
  | Readonly<{
      status: 'repair_required';
      workModel: 'v2' | 'unknown';
      commandId: string;
      message: string;
      repairRecorded: boolean;
    }>;

const STAFF_SAFE_REPAIR_CODE = 'QUOTE_CADENCE_RECONCILIATION_FAILED';
const STAFF_SAFE_REPAIR_MESSAGE =
  'Quote follow-up work is out of sync and needs repair.';

function stableIdentity(parts: readonly string[]): string {
  return JSON.stringify(parts);
}

export function quoteDeliveryCadenceCommandId(params: {
  event: QuoteDeliveryCadenceEvent;
  quoteVersionId: string;
  deliveryIntentId: string;
}): string {
  return projectWorkSystemCommandId(
    `quote-delivery:${params.event.toLowerCase()}`,
    stableIdentity([params.quoteVersionId, params.deliveryIntentId]),
  );
}

export function quoteOutcomeCadenceCommandId(params: {
  outcome: QuoteCadenceOutcome;
  quoteVersionId: string;
  supersedingQuoteVersionId?: string;
}): string {
  return projectWorkSystemCommandId(
    `quote-outcome:${params.outcome.toLowerCase()}`,
    stableIdentity([
      params.quoteVersionId,
      params.supersedingQuoteVersionId ?? '',
    ]),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Project work reconciliation failed';
}

function modelMarkerSchemaUnavailable(error: unknown): boolean {
  const record =
    error && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : null;
  const code = typeof record?.code === 'string' ? record.code : '';
  const message = errorMessage(error).toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (
      message.includes('project_work_model_versions') &&
      (
        message.includes('does not exist') ||
        message.includes('schema cache')
      )
    )
  );
}

function reportRepair(params: {
  event: QuoteDeliveryCadenceEvent | 'QUOTE_OUTCOME';
  quoteVersionId: string;
  commandId: string;
  workModel: 'v2' | 'unknown';
  error: unknown;
  repairRecorded?: boolean;
}): QuoteCadenceReconciliationResult {
  const message = errorMessage(params.error);
  console.error('[project_work] quote cadence reconciliation requires repair', {
    event: params.event,
    quoteVersionId: params.quoteVersionId,
    commandId: params.commandId,
    message,
  });
  return {
    status: 'repair_required',
    workModel: params.workModel,
    commandId: params.commandId,
    message,
    repairRecorded: params.repairRecorded ?? false,
  };
}

async function openRepairSignal(params: {
  serviceClient: SupabaseClient;
  projectId: string;
  quoteVersionId: string;
  commandId: string;
  event: QuoteDeliveryCadenceEvent | 'QUOTE_OUTCOME';
  error: unknown;
}): Promise<QuoteCadenceReconciliationResult> {
  let repairRecorded = false;
  try {
    await setQuoteCadenceRepairSignal(params.serviceClient, {
      projectId: params.projectId,
      commandId: params.commandId,
      event: params.event,
      quoteVersionId: params.quoteVersionId,
      action: 'OPEN',
      errorCode: STAFF_SAFE_REPAIR_CODE,
      errorMessage: STAFF_SAFE_REPAIR_MESSAGE,
    });
    repairRecorded = true;
  } catch (signalError) {
    console.error('[project_work] quote cadence repair signal could not be recorded', {
      event: params.event,
      quoteVersionId: params.quoteVersionId,
      commandId: params.commandId,
      message: errorMessage(signalError),
    });
  }
  return reportRepair({
    event: params.event,
    quoteVersionId: params.quoteVersionId,
    commandId: params.commandId,
    workModel: 'v2',
    error: params.error,
    repairRecorded,
  });
}

async function reconcileIfV2(params: {
  serviceClient: SupabaseClient;
  projectId: string;
  quoteVersionId: string;
  commandId: string;
  event: QuoteDeliveryCadenceEvent | 'QUOTE_OUTCOME';
  payload: Record<string, unknown>;
}): Promise<QuoteCadenceReconciliationResult> {
  let usesV2: boolean;
  try {
    usesV2 = await isProjectWorkModelV2(
      params.serviceClient,
      params.projectId,
    );
  } catch (error) {
    if (modelMarkerSchemaUnavailable(error)) {
      return {
        status: 'not_applicable',
        workModel: 'legacy',
        commandId: params.commandId,
      };
    }
    return reportRepair({
      event: params.event,
      quoteVersionId: params.quoteVersionId,
      commandId: params.commandId,
      workModel: 'unknown',
      error,
    });
  }
  if (!usesV2) {
    return {
      status: 'not_applicable',
      workModel: 'legacy',
      commandId: params.commandId,
    };
  }

  try {
    const result = await reconcileProjectWork(params.serviceClient, {
      projectId: params.projectId,
      commandId: params.commandId,
      event: params.event,
      payload: params.payload,
    });
    try {
      await setQuoteCadenceRepairSignal(params.serviceClient, {
        projectId: params.projectId,
        commandId: params.commandId,
        event: params.event,
        quoteVersionId: params.quoteVersionId,
        action: 'RESOLVE',
      });
    } catch (error) {
      return reportRepair({
        event: params.event,
        quoteVersionId: params.quoteVersionId,
        commandId: params.commandId,
        workModel: 'v2',
        error: new Error('Quote follow-up repair state could not be cleared'),
      });
    }
    return {
      status: 'reconciled',
      workModel: 'v2',
      commandId: params.commandId,
      replayed: result.replayed,
    };
  } catch (error) {
    return openRepairSignal({ ...params, error });
  }
}

export function reconcileQuoteDeliveryCadence(params: {
  serviceClient: SupabaseClient;
  projectId: string;
  quoteVersionId: string;
  deliveryIntentId: string;
  event: QuoteDeliveryCadenceEvent;
}): Promise<QuoteCadenceReconciliationResult> {
  const commandId = quoteDeliveryCadenceCommandId(params);
  return reconcileIfV2({
    serviceClient: params.serviceClient,
    projectId: params.projectId,
    quoteVersionId: params.quoteVersionId,
    commandId,
    event: params.event,
    payload: { quote_version_id: params.quoteVersionId },
  });
}

export function reconcileQuoteOutcomeCadence(params: {
  serviceClient: SupabaseClient;
  projectId: string;
  quoteVersionId: string;
  outcome: QuoteCadenceOutcome;
  supersedingQuoteVersionId?: string;
}): Promise<QuoteCadenceReconciliationResult> {
  const commandId = quoteOutcomeCadenceCommandId(params);
  return reconcileIfV2({
    serviceClient: params.serviceClient,
    projectId: params.projectId,
    quoteVersionId: params.quoteVersionId,
    commandId,
    event: 'QUOTE_OUTCOME',
    payload: {
      quote_version_id: params.quoteVersionId,
      outcome: params.outcome,
    },
  });
}
