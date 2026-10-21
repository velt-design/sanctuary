import { z } from 'zod';
import { creativeHash, creativeScopeSchema } from './contract';

const id = z.string().regex(/^[1-9]\d{0,19}$/);
/** Source ledger vocabulary, not a claim about Meta endpoint fields. */
export const creativePlanSchema = z.object({ scope: creativeScopeSchema,
  originalAds: z.array(id).length(4).refine(ids => new Set(ids).size === 4),
  approvalHash: creativeHash, catalogueHash: creativeHash, controlHash: creativeHash,
  budgetHash: creativeHash, nativeContractHash: creativeHash,
  generator: z.string().min(1).max(150), reviewer: z.string().min(1).max(150),
}).strict().refine(plan => plan.generator !== plan.reviewer);
export const creativeLedgerEffectSchema = z.object({ command: z.uuid(), experiment: z.uuid(),
  requestHash: creativeHash, generation: z.number().int().positive(),
  kind: z.enum(['create_paused_ad', 'create_study', 'activate_ad', 'pause_ad', 'end_study']),
  objectId: id.nullable(), preStateHash: creativeHash, observedAt: z.iso.datetime({ offset: true }),
}).strict();
export type CreativeLedgerEffect = z.infer<typeof creativeLedgerEffectSchema>;
export type CreativePlan = z.infer<typeof creativePlanSchema>;
/** Separate capability seam. No credential implementation, loader or provider
 * dispatcher is exported. A future scoped broker must supply current authority
 * and an exact verified principal; report/sale leases are not assignable here. */
export interface CreativeCredentialLease {
  readonly capability: 'creatives';
  readonly scope: CreativePlan['scope'];
  readonly enrollmentReceiptHash: string;
  check(): Promise<void>;
  close(): Promise<void>;
}
export interface CreativeEffectJournal {
  read(command: string): Promise<{ state: 'uncertain' | 'confirmed'; requestHash: string; objectId: string | null } | null>;
  admit(effect: CreativeLedgerEffect): Promise<{ dispatch: true } | { dispatch: false; reconcile: true }>;
  confirm(command: string, requestHash: string, objectId: string, evidenceHash: string): Promise<void>;
}
/** No automatic retry is implied by a lost response or an expired worker. */
export function nextCreativeEffect(receipt: Awaited<ReturnType<CreativeEffectJournal['read']>>, requestHash: string) {
  if (!receipt) return 'requires_source_admission' as const;
  if (receipt.requestHash !== requestHash) return 'conflict' as const;
  return receipt.state === 'confirmed' ? 'read_confirmed' as const : 'reconcile_only' as const;
}
