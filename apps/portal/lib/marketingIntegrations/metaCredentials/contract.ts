import { z } from 'zod';
const stamp = z.iso.datetime({ offset: true }).nullable();
export const credentialHealthSchema = z.object({ state: z.enum(['DISABLED','AUTHORITY_REQUIRED','RECONCILIATION_REQUIRED','EXPIRED','REVIEW_REQUIRED','RENEWAL_DISABLED','READY']),
  tokenExpiresAt: stamp, dataAccessExpiresAt: stamp, approvalEndsAt: stamp, assetVerifiedAt: stamp, checkedAt: stamp }).strict();
export const credentialHealthMap = z.object({ reports: credentialHealthSchema.optional(), sales: credentialHealthSchema.optional() }).strict();
export type MetaCredentialHealth = z.infer<typeof credentialHealthMap>;
export function credentialAttention(health: MetaCredentialHealth = {}) {
  return Object.entries(health).flatMap(([capability, value]) => {
    const name = capability === 'reports' ? 'Meta report access' : 'Meta sale access';
    const text = { DISABLED: '', READY: '', AUTHORITY_REQUIRED: 'needs its permission or asset assignment checked.',
      RECONCILIATION_REQUIRED: 'has an uncertain credential update. Reconcile the saved vault revision before using it.',
      EXPIRED: 'has expired. Restore a verified credential before using it.', REVIEW_REQUIRED: 'needs a credential maintenance check.',
      RENEWAL_DISABLED: 'has automatic renewal disabled and will stop when its token expires.' }[value.state];
    return text ? [`${name} ${text}`] : [];
  });
}
