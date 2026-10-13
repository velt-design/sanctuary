import { z } from 'zod';
import { id } from './contract';
import { googleJson, GoogleFailure } from './transport';
import type { SaleEvent } from './sales';
import { requestStatus, sanitizeCounts, recoveryFor } from './diagnostics';

export type Destination = { customerId: string; managerId?: string; actionId: string };
export function destination(config: Destination) {
  id.parse(config.customerId); id.parse(config.actionId); if (config.managerId) id.parse(config.managerId);
  return { operatingAccount: { accountType: 'GOOGLE_ADS', accountId: config.customerId },
    ...(config.managerId ? { loginAccount: { accountType: 'GOOGLE_ADS', accountId: config.managerId } } : {}), productDestinationId: config.actionId };
}
type ProviderInput = { config: Destination; token: string; signal: AbortSignal; before: () => Promise<void>; fetcher?: typeof fetch };
export async function ingestSale(input: ProviderInput, event: SaleEvent, validateOnly: boolean) {
  await input.before(); input.signal.throwIfAborted();
  const body = { destinations: [destination(input.config)], encoding: 'HEX', events: [event], validateOnly };
  const response = await googleJson(input.fetcher ?? fetch, 'https://datamanager.googleapis.com/v1/events:ingest', {
    method: 'POST', headers: { Authorization: `Bearer ${input.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: input.signal,
  }, 65536);
  if (validateOnly) { z.object({ requestId: z.string().optional() }).parse(response); return { requestId: null, validated: true as const }; }
  return { requestId: z.object({ requestId: z.string().min(1).max(2000) }).parse(response).requestId, validated: false as const };
}
export async function saleRequestStatus(input: ProviderInput, requestId: string) {
  if (!requestId || requestId.length > 2000) throw new GoogleFailure('REQUEST_ID_INVALID');
  await input.before(); input.signal.throwIfAborted();
  const count = z.string().regex(/^[01]$/); // Every request sent by this worker contains exactly one event.
  const counts = z.array(z.object({ reason:z.string().optional(),recordCount:count })).max(64);
  const response = z.object({ requestStatusPerDestination: z.array(z.object({ destination: z.unknown(),
    requestStatus,
    eventsIngestionStatus: z.object({ recordCount: count }).optional(),
    errorInfo: z.object({ errorCounts: counts.default([]) }).optional(),
    warningInfo: z.object({ warningCounts: counts.default([]) }).optional(),
  })).length(1) }).parse(await googleJson(input.fetcher ?? fetch,
    `https://datamanager.googleapis.com/v1/requestStatus:retrieve?requestId=${encodeURIComponent(requestId)}`,
    { headers: { Authorization: `Bearer ${input.token}` }, signal: input.signal }, 65536));
  const status = response.requestStatusPerDestination[0];
  if (JSON.stringify(status.destination) !== JSON.stringify(destination(input.config))) {
    // JSON field order is irrelevant; validate exact pinned identity field-by-field.
    const d = z.object({ operatingAccount: z.object({ accountType: z.literal('GOOGLE_ADS'), accountId: z.literal(input.config.customerId) }),
      loginAccount: z.object({ accountType: z.literal('GOOGLE_ADS'), accountId: z.literal(input.config.managerId ?? '') }).optional(), productDestinationId: z.literal(input.config.actionId) }).parse(status.destination);
    if ((d.loginAccount?.accountId ?? undefined) !== input.config.managerId) throw new GoogleFailure('DESTINATION_MISMATCH');
  }
  if (status.requestStatus === 'SUCCESS' && (status.eventsIngestionStatus?.recordCount !== '1' || status.errorInfo?.errorCounts.some(e => e.recordCount !== '0')))
    throw new GoogleFailure('INGESTION_COUNTS_UNCONFIRMED');
  if (status.requestStatus==='PROCESSING'&&(status.errorInfo||status.warningInfo)) throw new GoogleFailure('INGESTION_STATUS_INCONSISTENT');
  const errors=sanitizeCounts(status.errorInfo?.errorCounts??[],'errors'),warnings=sanitizeCounts(status.warningInfo?.warningCounts??[],'warnings');
  return { status: status.requestStatus, recordCount: status.eventsIngestionStatus?Number(status.eventsIngestionStatus.recordCount):null,
    errors,warnings,recovery:recoveryFor(status.requestStatus,errors,warnings) };
}
export async function retractSale(input: ProviderInput, event: SaleEvent, adjustedAt: Date, validateOnly: boolean) {
  if (event.adIdentifiers?.wbraid) throw new GoogleFailure('WBRAID_RETRACTION_REQUIRES_REVIEW');
  const conversionAction = `customers/${input.config.customerId}/conversionActions/${input.config.actionId}`;
  await input.before(); input.signal.throwIfAborted();
  const response = z.object({ partialFailureError: z.unknown().optional(), results: z.array(z.object({ orderId: z.string().optional(), conversionAction: z.string().optional(), adjustmentType: z.string().optional() })).optional() })
    .parse(await googleJson(input.fetcher ?? fetch, `https://googleads.googleapis.com/v25/customers/${input.config.customerId}:uploadConversionAdjustments`, {
      method: 'POST', headers: { Authorization: `Bearer ${input.token}`, 'Content-Type': 'application/json', ...(input.config.managerId ? { 'login-customer-id': input.config.managerId } : {}) },
      body: JSON.stringify({ partialFailure: true, validateOnly, conversionAdjustments: [{ conversionAction, orderId: event.transactionId,
        adjustmentDateTime: adjustedAt.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00:00'), adjustmentType: 'RETRACTION' }] }), signal: input.signal,
    }, 65536));
  if (response.partialFailureError) throw new GoogleFailure('RETRACTION_REJECTED');
  if (!validateOnly && (response.results?.length !== 1 || response.results[0].orderId !== event.transactionId
    || response.results[0].conversionAction !== conversionAction || response.results[0].adjustmentType !== 'RETRACTION')) throw new GoogleFailure('RETRACTION_UNCONFIRMED');
  return { validated: validateOnly, retracted: !validateOnly };
}
