// @vitest-environment node
// Cross-app equivalence belongs to the root integration suite. Marketing's
// scoped build must not import Portal's schema/provider dependency graph.
import { webcrypto } from 'node:crypto';
import { expect, it } from 'vitest';
import { googleLeadHashes } from '../apps/marketing/lib/googleEnhancedLead';
import { emailHash, phoneHash } from '../apps/portal/lib/marketingIntegrations/googleAds/sales';

it.each([
  { email: ' Test.Person+project@Gmail.com ', phone: '+64 21 1234567' },
  { email: ' A.B+project@example.test ', phone: '0211234567' },
  { email: 'First.Last+tag@googlemail.com', phone: '+61 (412) 345-678' },
])('matches website and offline Google identity for $email', async (contact) => {
  const email=emailHash(contact.email),phone=phoneHash(contact.phone);
  expect(await googleLeadHashes(contact,webcrypto.subtle as SubtleCrypto)).toEqual({
    ...(email?{sha256_email_address:email}:{}),...(phone?{sha256_phone_number:phone}:{}),
  });
});
