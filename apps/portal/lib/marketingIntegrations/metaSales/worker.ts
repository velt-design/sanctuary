import { z } from 'zod';
import { metaSaleSourceSchema, metaSaleEventSchema, prepareMetaSale, META_RETRY_WINDOW_MS } from './sales';
import { sendMetaSale, MetaSaleFailure } from './delivery';
export type MetaSaleCommand = (action: string, input?: Record<string, unknown>, runId?: string) => Promise<unknown>;
const runSchema = z.object({ runId: z.uuid(), datasetId: z.string().regex(/^[1-9]\d{0,19}$/).nullable(),
  contactMatchingApproved: z.boolean(), consentPolicyApproved: z.boolean(), disclosureVersion: z.string().min(1),
  allowedConsentBases: z.array(z.string()), consentEffectiveFrom: z.string().nullable(), historicalEnabled: z.boolean() });
const claimSchema = z.object({ quoteId: z.uuid(), event: metaSaleEventSchema, attempts: z.number().int().min(1).max(5), firstAttemptAt: z.iso.datetime({ offset: true }) });
export async function runMetaSales(input: { lane: 'sales' | 'assess'; store: MetaSaleCommand; signal: AbortSignal;
  credential?: { token: string; datasetId: string }; fetcher?: typeof fetch; now?: Date }) {
  const run = runSchema.parse(await input.store('begin', { lane: input.lane }));
  const command = (action: string, values?: Record<string, unknown>) => input.store(action, values, run.runId);
  try {
    if (input.lane === 'sales' && (!input.credential || run.datasetId !== input.credential.datasetId)) throw new Error('Destination mismatch');
    const sources = z.array(metaSaleSourceSchema).max(5000).parse(await command('sources'));
    for (const source of sources) {
      input.signal.throwIfAborted();
      const prepared = prepareMetaSale(source, { ...run, consentEffectiveFrom: run.consentEffectiveFrom ?? '' }, input.now);
      await command(input.lane === 'assess' ? 'assess' : 'freeze', { quoteId: source.quoteId, fingerprint: source.fingerprint, ...prepared });
    }
    if (input.lane === 'sales') for (let index = 0; index < 5; index++) {
      input.signal.throwIfAborted();
      const raw = await command('claim'); if (raw === null) break;
      const claim = claimSchema.parse(raw);
      let outcome: Record<string, unknown>;
      try {
        const result = await sendMetaSale({ ...input.credential!, signal: input.signal, fetcher: input.fetcher,
          before: async () => { await command('check', { quoteId: claim.quoteId }); } }, claim.event);
        outcome = { state: 'ACCEPTED', receiptId: result.receiptId, diagnostics: { warningCount: result.warningCount } };
      } catch (error) {
        const retryable = error instanceof MetaSaleFailure && error.retryable;
        const withinBudget = claim.attempts < 5 && (input.now ?? new Date()).getTime() - Date.parse(claim.firstAttemptAt) < META_RETRY_WINDOW_MS;
        outcome = { state: retryable && withinBudget ? 'RETRY' : 'REVIEW_REQUIRED',
          reason: retryable && !withinBudget ? 'RETRY_WINDOW_EXHAUSTED' : error instanceof MetaSaleFailure ? error.code : 'SOURCE_CHECK_FAILED',
          diagnostics: error instanceof MetaSaleFailure ? error.diagnostics : {}, delaySeconds: Math.min(21600, 300 * 2 ** claim.attempts) };
      }
      await command('complete', { quoteId: claim.quoteId, ...outcome });
    }
    await command('finish'); return { completed: true, assessed: sources.length };
  } catch {
    await command('finish', { error: 'META_SALE_RUN_REQUIRES_REVIEW' }).catch(() => undefined);
    throw new Error('Meta sale connection requires review');
  }
}
