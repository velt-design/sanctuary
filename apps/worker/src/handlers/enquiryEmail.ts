import type { ResendEmailGateway } from '@sp/email-provider';
import { dispatchDurableEmailEffect, finaliseDurableEmailEffect } from '../effects/durableEmailEffect';
import type { BackgroundJobHandler, RuntimeBackgroundJobsRpc } from '../runtime/contracts';
import { BackgroundJobHandlerError } from '../runtime/errors';

export function createEnquiryEmailHandler(dependencies: {
  workerId: string;
  rpc: Pick<RuntimeBackgroundJobsRpc, 'readEnquiryDelivery' | 'finaliseEnquiryDelivery'>;
  gateway: ResendEmailGateway;
}): BackgroundJobHandler {
  return async ({ claim, payload, effects, signal, rpc, clock }) => {
    if (claim.kind !== 'email_outbox_deliver' || payload.contractVersion !== 1 ||
        payload.payload.workflow !== 'website_enquiry' ||
        typeof payload.payload.outboxId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.payload.outboxId)) {
      throw new BackgroundJobHandlerError({ code: 'ENQUIRY_EMAIL_PAYLOAD_INVALID', disposition: 'needs_attention' });
    }
    if (signal.aborted) throw signal.reason;
    const owned = { jobId: claim.jobId, workerId: dependencies.workerId, leaseToken: claim.leaseToken };
    const message = await dependencies.rpc.readEnquiryDelivery(owned);
    if (signal.aborted) throw signal.reason;
    if (effects.length === 0) {
      await rpc.progress({ status: 'running', phase: 'outbox_frozen', safeProgress: { phase: 'outbox_frozen' } });
    }
    const acceptance = await dispatchDurableEmailEffect({
      jobId: claim.jobId, effectKey: `outbox:${payload.payload.outboxId}`,
      message, effects, signal, rpc, clock, gateway: dependencies.gateway,
    });
    await finaliseDurableEmailEffect({
      acceptance, rpc,
      finalise: ({ providerMessageId }) => dependencies.rpc.finaliseEnquiryDelivery({ ...owned, providerMessageId }),
    });
    await rpc.progress({ status: 'finalising', phase: 'business_finalised', safeProgress: { phase: 'business_finalised' } });
    return { safeResult: { phase: 'business_finalised', processedCount: 1 } };
  };
}
