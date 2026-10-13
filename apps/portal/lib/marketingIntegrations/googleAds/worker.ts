import { z } from 'zod';
import { googleAccessToken } from './credentials';
import type { AdsConfig } from './config';
import { id } from './contract';
import { readAdsReport } from './report';
import { prepareSale, saleSourceSchema, saleEventSchema } from './sales';
import { ingestSale, retractSale, saleRequestStatus } from './delivery';
import { GoogleFailure } from './transport';
import type { GoogleCommand } from './store';
import type { Ga4Vault } from '../ga4/lifecycle';
import { checkSaleDestination } from './preflight';
import { diagnosticsSchema } from './diagnostics';

const runSchema = z.object({ runId: z.uuid(), customerId: id, conversionCustomerId: id.nullable(), managerId: id.nullable(), actionId: id.nullable(),
  enhancedMatchingApproved: z.boolean(), consentPolicyApproved: z.boolean(), allowedConsentBases: z.array(z.string()),
  consentEffectiveFrom: z.string().nullable(), retractionsEnabled: z.boolean(), disclosureVersion: z.string().min(1) });
const claimSchema = z.object({ quoteId: z.uuid(), state: z.enum(['SENDING','SUBMITTED','RETRACTING']),
  event: z.unknown(), requestId: z.string().nullable(), attempts: z.number().int(), submittedAt: z.string().nullable(), adjustmentAt: z.string().nullable() });
export async function runGoogleConnection(input: { lane: 'report' | 'sales'; config: AdsConfig; store: GoogleCommand; vault: Ga4Vault;
  signal: AbortSignal; fetcher?: typeof fetch; now?: Date }) {
  const { store, signal } = input, run = runSchema.parse(await store('begin', { lane: input.lane }));
  const command = (action: string, values?: Record<string, unknown>) => store(action, values, run.runId);
  try {
    const token = await googleAccessToken(input.config, input.vault, {
      before: async () => { await command('credential_pending'); }, settled: async () => { await command('credential_settled'); },
    }, signal, input.fetcher);
    const provider = { config: { customerId: input.lane === 'sales' ? run.conversionCustomerId ?? '' : run.customerId, ...(run.managerId ? { managerId: run.managerId } : {}), actionId: run.actionId ?? '' },
      token, signal, fetcher: input.fetcher, before: async () => { await command('check'); } };
    if (input.lane === 'report') {
      const report = await readAdsReport({ ...provider.config, ...(run.conversionCustomerId ? { conversionCustomerId: run.conversionCustomerId } : {}), token, signal, fetcher: input.fetcher, before: provider.before }, input.now);
      await command('report', { report });
    } else {
      if (!run.actionId || !run.conversionCustomerId || !run.consentPolicyApproved) throw new GoogleFailure('UPLOAD_POLICY_UNAPPROVED');
      await checkSaleDestination({ customerId: run.customerId, conversionCustomerId: run.conversionCustomerId,
        ...(run.managerId ? { managerId: run.managerId } : {}), actionId: run.actionId, token, signal, fetcher: input.fetcher, before: provider.before });
      const sources = z.array(saleSourceSchema).max(5000).parse(await command('sources'));
      for (const source of sources) {
        signal.throwIfAborted();
        const prepared = prepareSale(source, { enhancedMatchingApproved: run.enhancedMatchingApproved,
          allowedConsentBases: run.allowedConsentBases, consentEffectiveFrom: run.consentEffectiveFrom ?? '', disclosureVersion: run.disclosureVersion }, input.now);
        await command('freeze', { quoteId: source.quoteId, fingerprint: source.fingerprint, ...prepared });
      }
      // Small bounded batches. The scheduler resumes durable rows, not an in-memory queue.
      for (let i = 0; i < 5; i++) {
        signal.throwIfAborted(); const raw = await command('claim'); if (raw === null) break;
        const claim = claimSchema.parse(raw), event = saleEventSchema.parse(claim.event);
        const saleProvider = { ...provider, before: async () => { await command('check', { quoteId: claim.quoteId }); } };
        let outcome: Record<string, unknown>;
        try {
          if (claim.state === 'SUBMITTED') {
            if (!claim.requestId) throw new GoogleFailure('REQUEST_ID_MISSING');
            const status = await saleRequestStatus(saleProvider, claim.requestId);
            const expired = !claim.submittedAt || (input.now ?? new Date()).getTime() - Date.parse(claim.submittedAt) > 24 * 3600000;
            outcome = status.recovery === 'ACCEPTED' ? { state: 'ACCEPTED' }
              : status.recovery==='RETRY' ? { state:claim.attempts<8?'RETRY':'REVIEW_REQUIRED',reason:claim.attempts<8?'GOOGLE_TRANSIENT_REJECTION':'DELIVERY_RETRY_EXHAUSTED',delaySeconds:10800 }
              : status.recovery==='REVIEW' ? { state:'REVIEW_REQUIRED',reason:'GOOGLE_DIAGNOSTICS_REQUIRE_REVIEW' }
                : expired ? { state: 'REVIEW_REQUIRED', reason: 'GOOGLE_DIAGNOSTIC_TIMEOUT' }
                  : { state: 'SUBMITTED', delaySeconds: 3600, reason: 'GOOGLE_PROCESSING' };
            outcome.diagnostics={...diagnosticsSchema.parse(status),requestId:claim.requestId,destination:provider.config};
          } else if (claim.state === 'RETRACTING') {
            if (!run.retractionsEnabled || !claim.adjustmentAt) throw new GoogleFailure('RETRACTION_REQUIRES_OPERATOR');
            await retractSale(saleProvider, event, new Date(claim.adjustmentAt), false);
            outcome = { state: 'RETRACTED' };
          } else {
            const uploaded = await ingestSale(saleProvider, event, false);
            outcome = { state: 'SUBMITTED', requestId: uploaded.requestId, delaySeconds: 1800 };
          }
        } catch (error) {
          const reason = error instanceof GoogleFailure ? error.code : 'DELIVERY_UNCONFIRMED';
          if (claim.state === 'SUBMITTED') {
            const expired = !claim.submittedAt || (input.now ?? new Date()).getTime() - Date.parse(claim.submittedAt) > 24 * 3600000;
            outcome = expired ? { state: 'REVIEW_REQUIRED', reason: 'GOOGLE_DIAGNOSTIC_TIMEOUT' } : { state: 'SUBMITTED', reason, delaySeconds: 3600 };
          }
          else if (claim.state === 'RETRACTING') outcome = { state: 'REVIEW_REQUIRED', reason };
          else outcome = { state: error instanceof GoogleFailure && error.retryable ? (claim.attempts < 8 ? 'RETRY' : 'REVIEW_REQUIRED') : 'FAILED',
            reason:error instanceof GoogleFailure&&error.retryable&&claim.attempts>=8?'DELIVERY_RETRY_EXHAUSTED':reason,delaySeconds:Math.min(21600,60*2**claim.attempts) };
        }
        await command('complete', { quoteId: claim.quoteId, ...outcome });
      }
    }
    await command('finish'); return { completed: true };
  } catch {
    await command('finish', { error: 'GOOGLE_CONNECTION_REQUIRES_REVIEW' }).catch(() => undefined);
    throw new Error('Google connection requires review. No partial report is published.');
  }
}
