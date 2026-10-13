import { createHash } from 'node:crypto';
import { z } from 'zod';
export const META_SALE_WINDOW_MS = 7 * 86400000;
export const META_RETRY_WINDOW_MS = 24 * 3600000;
const nullableText = z.string().nullable();
export const metaSaleSourceSchema = z.object({ quoteId: z.uuid(), projectId: z.uuid(), receiptId: z.uuid().nullable(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/), occurredAt: z.iso.datetime({ offset: true }).nullable(),
  receivedAt: z.iso.datetime({ offset: true }).nullable(), valueCents: z.number().int().positive().refine(Number.isSafeInteger).nullable(),
  active: z.boolean(), marketingConsent: z.boolean(), marketingDenied: z.boolean(), suppressed: z.boolean(), consentBasis: nullableText, disclosureVersion: nullableText,
  email: nullableText, phone: nullableText, crmEmail: nullableText, crmPhone: nullableText, fbc: nullableText, fbp: nullableText,
  historicalApproval: z.object({ identitySource: z.enum(['original','crm']), approvedAt: z.iso.datetime({ offset: true }) }).strict().nullable(),
}).strict();
export type MetaSaleSource = z.infer<typeof metaSaleSourceSchema>;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function metaEmailHash(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  // Meta does not share Google's Gmail dot/+ canonicalization.
  return normalized && normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? hash(normalized) : null;
}
export function metaPhoneHash(value: string | null): string | null {
  const normalized = value?.replace(/[\s().-]/g, '');
  return normalized && /^\+[1-9]\d{7,14}$/.test(normalized) ? hash(normalized.slice(1)) : null;
}
const hashed = z.string().regex(/^[a-f0-9]{64}$/);
export const metaSaleEventSchema = z.object({ event_name: z.literal('Purchase'), event_id: z.string().regex(/^sanctuary-scope-[0-9a-f-]{36}$/),
  event_time: z.number().int().positive(), action_source: z.literal('other'),
  user_data: z.object({ em: z.array(hashed).length(1).optional(), ph: z.array(hashed).length(1).optional(),
    fbc: z.string().regex(/^fb\.\d\.\d{13}\.[A-Za-z0-9_-]+$/).max(640).optional(),
    fbp: z.string().regex(/^fb\.\d\.\d{13}\.\d+$/).max(640).optional() }).strict().refine(value => Object.keys(value).length > 0),
  custom_data: z.object({ currency: z.literal('NZD'), value: z.number().finite().positive(),
    order_id: z.string().regex(/^sanctuary-scope-[0-9a-f-]{36}$/) }).strict(),
}).strict().refine(value => value.event_id === value.custom_data.order_id);
export type MetaSaleEvent = z.infer<typeof metaSaleEventSchema>;
export type MetaSalePolicy = { consentPolicyApproved: boolean; contactMatchingApproved: boolean; disclosureVersion: string;
  allowedConsentBases: string[]; consentEffectiveFrom: string; historicalEnabled: boolean };
export type MetaAssessment = { reasons: string[]; matching: { originalEmail: boolean; originalPhone: boolean; crmEmail: boolean; crmPhone: boolean; fbc: boolean; fbp: boolean } };
function validCookie(value: string | null, kind: 'fbc' | 'fbp', source: MetaSaleSource, now: number): string | undefined {
  const pattern = kind === 'fbc' ? /^fb\.\d\.(\d{13})\.[A-Za-z0-9_-]+$/ : /^fb\.\d\.(\d{13})\.\d+$/;
  const match = value && value.length <= 640 ? pattern.exec(value) : null;
  const time = match ? Number(match[1]) : NaN;
  return value && Number.isFinite(time) && time <= Date.parse(source.receivedAt ?? '') && time <= now && now - time < 90 * 86400000 ? value : undefined;
}
/** Assessment includes all exclusions. CRM presence is evidence to review, never implicit permission. */
export function assessMetaSale(source: MetaSaleSource, policy: MetaSalePolicy, now = new Date()): MetaAssessment {
  const reasons: string[] = [], occurred = Date.parse(source.occurredAt ?? ''), received = Date.parse(source.receivedAt ?? '');
  const historical = policy.historicalEnabled && Boolean(source.historicalApproval) && !source.marketingDenied;
  if (!source.active || source.valueCents === null) reasons.push('NOT_CURRENT_PAID_SCOPE');
  if (!source.receiptId && !historical) reasons.push('ORIGIN_ENQUIRY_MISSING');
  if (source.suppressed) reasons.push('CUSTOMER_SUPPRESSED');
  if ((!source.marketingConsent && !historical) || source.marketingDenied) reasons.push('MARKETING_CONSENT_NOT_GRANTED');
  if ((policy.disclosureVersion !== '2026-10-sale-measurement-v2' || source.disclosureVersion !== policy.disclosureVersion) && !historical) reasons.push('META_DISCLOSURE_NOT_PRESENT');
  if (!policy.consentPolicyApproved || (!historical && (!source.consentBasis || !policy.allowedConsentBases.includes(source.consentBasis)
    || !Number.isFinite(received) || !Number.isFinite(Date.parse(policy.consentEffectiveFrom)) || received < Date.parse(policy.consentEffectiveFrom)))) reasons.push('CONTACT_POLICY_NOT_APPROVED');
  if (!Number.isFinite(occurred) || occurred > now.getTime() || (Number.isFinite(received) && occurred < received)) reasons.push('SALE_DATE_UNVERIFIED');
  else if (now.getTime() - occurred >= META_SALE_WINDOW_MS) reasons.push('META_EVENT_WINDOW_EXCEEDED');
  const matching = { originalEmail: Boolean(metaEmailHash(source.email)), originalPhone: Boolean(metaPhoneHash(source.phone)),
    crmEmail: Boolean(metaEmailHash(source.crmEmail)), crmPhone: Boolean(metaPhoneHash(source.crmPhone)),
    fbc: Boolean(validCookie(source.fbc, 'fbc', source, now.getTime())), fbp: Boolean(validCookie(source.fbp, 'fbp', source, now.getTime())) };
  const contactAvailable = historical && source.historicalApproval?.identitySource === 'crm' ? matching.crmEmail || matching.crmPhone : matching.originalEmail || matching.originalPhone;
  if (!matching.fbc && !matching.fbp && !(policy.contactMatchingApproved && contactAvailable)) reasons.push('PERMITTED_MATCHING_ID_MISSING');
  return { reasons, matching };
}
export function prepareMetaSale(source: MetaSaleSource, policy: MetaSalePolicy, now = new Date()): { assessment: MetaAssessment; event?: MetaSaleEvent } {
  const assessment = assessMetaSale(source, policy, now);
  if (assessment.reasons.length) return { assessment };
  const user_data: MetaSaleEvent['user_data'] = {};
  if (policy.contactMatchingApproved) {
    const crm = policy.historicalEnabled && source.historicalApproval?.identitySource === 'crm';
    const email = metaEmailHash(crm ? source.crmEmail : source.email), phone = metaPhoneHash(crm ? source.crmPhone : source.phone);
    if (email) user_data.em = [email]; if (phone) user_data.ph = [phone];
  }
  const fbc = validCookie(source.fbc, 'fbc', source, now.getTime()), fbp = validCookie(source.fbp, 'fbp', source, now.getTime());
  if (fbc) user_data.fbc = fbc; if (fbp) user_data.fbp = fbp;
  const identity = `sanctuary-scope-${source.quoteId}`;
  return { assessment, event: metaSaleEventSchema.parse({ event_name: 'Purchase', event_id: identity,
    event_time: Math.floor(Date.parse(source.occurredAt!) / 1000), action_source: 'other', user_data,
    custom_data: { currency: 'NZD', value: source.valueCents! / 100, order_id: identity } }) };
}
