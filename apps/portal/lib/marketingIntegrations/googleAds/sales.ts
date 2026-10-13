import { createHash } from 'node:crypto';
import { z } from 'zod';

export const saleSourceSchema = z.object({ quoteId: z.uuid(), projectId: z.uuid(), receiptId: z.uuid().nullable(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/), occurredAt: z.iso.datetime({ offset: true }).nullable(),
  valueCents: z.number().int().positive().refine(Number.isSafeInteger).nullable(), currency: z.literal('NZD'),
  active: z.boolean(), marketingConsent: z.boolean(), consentBasis: z.string().nullable(), receivedAt: z.iso.datetime({ offset: true }).nullable(),
  email: z.string().nullable(), phone: z.string().nullable(),
  gclid: z.string().nullable(), gbraid: z.string().nullable(), wbraid: z.string().nullable(),
}).strict();
export type SaleSource = z.infer<typeof saleSourceSchema>;
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
export function emailHash(value: string | null): string | null {
  if (!value) return null;
  const clean = value.replace(/\s/g, '').toLowerCase();
  if (clean.length > 254 || !/^[^@]+@[^@]+\.[^@]+$/.test(clean)) return null;
  let [local, domain] = clean.split('@');
  if (domain === 'gmail.com' || domain === 'googlemail.com') local = local.split('+')[0].replace(/\./g, '');
  return local ? hash(`${local}@${domain}`) : null;
}
export function phoneHash(value: string | null): string | null {
  if (!value) return null;
  const phone = value.replace(/[\s().-]/g, '');
  // Do not invent country codes for old submissions. Missing E.164 stays unavailable.
  return /^\+[1-9]\d{7,14}$/.test(phone) ? hash(phone) : null;
}
export type SaleEvent = { transactionId: string; eventTimestamp: string; eventSource: 'OTHER'; conversionValue: number; currency: 'NZD';
  consent: { adUserData: 'CONSENT_GRANTED'; adPersonalization: 'CONSENT_DENIED' };
  adIdentifiers?: { gclid?: string; gbraid?: string; wbraid?: string };
  userData?: { userIdentifiers: Array<{ emailAddress: string } | { phoneNumber: string }> };
};
const hashed = z.string().regex(/^[a-f0-9]{64}$/), click = z.string().regex(/^[A-Za-z0-9_-]{1,600}$/);
export const saleEventSchema = z.object({ transactionId: z.string().regex(/^sanctuary-scope-[0-9a-f-]{36}$/), eventTimestamp: z.iso.datetime(),
  eventSource: z.literal('OTHER'), conversionValue: z.number().finite().positive(), currency: z.literal('NZD'),
  consent: z.object({ adUserData: z.literal('CONSENT_GRANTED'), adPersonalization: z.literal('CONSENT_DENIED') }).strict(),
  adIdentifiers: z.object({ gclid: click.optional(), gbraid: click.optional(), wbraid: click.optional() }).strict().refine(v=>Object.keys(v).length>0).optional(),
  userData: z.object({ userIdentifiers: z.array(z.union([z.object({emailAddress:hashed}).strict(),z.object({phoneNumber:hashed}).strict()])).min(1).max(2) }).strict().optional(),
}).strict().refine(v=>Boolean(v.adIdentifiers||v.userData));
export type SalePolicy = { enhancedMatchingApproved: boolean; allowedConsentBases: string[]; consentEffectiveFrom: string };
export function prepareSale(source: SaleSource, policy: SalePolicy, now = new Date()): { event: SaleEvent } | { reason: string } {
  if (!source.active || source.valueCents === null) return { reason: 'SALE_NO_LONGER_CURRENT' };
  if (!source.receiptId) return { reason: 'ORIGIN_ENQUIRY_MISSING' };
  if (!source.marketingConsent) return { reason: 'MARKETING_CONSENT_NOT_GRANTED' };
  if (!source.consentBasis || !policy.allowedConsentBases.includes(source.consentBasis)
    || !Number.isFinite(Date.parse(policy.consentEffectiveFrom)) || Date.parse(source.receivedAt ?? '') < Date.parse(policy.consentEffectiveFrom))
    return { reason: 'CONSENT_POLICY_NOT_APPROVED_FOR_RECEIPT' };
  const occurred = Date.parse(source.occurredAt ?? ''), received = Date.parse(source.receivedAt ?? '');
  if (!Number.isFinite(occurred) || !Number.isFinite(received) || occurred < received || occurred > now.getTime()) return { reason: 'SALE_DATE_UNVERIFIED' };
  if (now.getTime() - occurred > 90 * 86400000) return { reason: 'SALE_OUTSIDE_IMPORT_WINDOW' };
  const adIdentifiers: NonNullable<SaleEvent['adIdentifiers']> = {};
  for (const key of ['gclid', 'gbraid', 'wbraid'] as const) if (source[key] && /^[A-Za-z0-9_-]{1,600}$/.test(source[key]!)) adIdentifiers[key] = source[key]!;
  const userIdentifiers: NonNullable<SaleEvent['userData']>['userIdentifiers'] = [];
  // Saved marketing consent alone does not assert reviewed customer-data authority.
  if (policy.enhancedMatchingApproved) { const email = emailHash(source.email), phone = phoneHash(source.phone);
    if (email) userIdentifiers.push({ emailAddress: email }); if (phone) userIdentifiers.push({ phoneNumber: phone }); }
  if (!Object.keys(adIdentifiers).length && !userIdentifiers.length) return { reason: 'PERMITTED_MATCHING_ID_MISSING' };
  // User-provided data matches website interactions within Google's 63-day limit.
  // An older enquiry cannot establish eligible recent interaction. A recent enquiry
  // still does not prove a click date or Google's eventual matching.
  if (!Object.keys(adIdentifiers).length && now.getTime() - received > 63 * 86400000) return { reason: 'ENHANCED_MATCHING_WINDOW_EXCEEDED' };
  return { event: { transactionId: `sanctuary-scope-${source.quoteId}`, eventTimestamp: new Date(occurred).toISOString(), eventSource: 'OTHER',
    conversionValue: source.valueCents / 100, currency: 'NZD', consent: {
      adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_DENIED' },
    ...(Object.keys(adIdentifiers).length ? { adIdentifiers } : {}), ...(userIdentifiers.length ? { userData: { userIdentifiers } } : {}) } };
}
