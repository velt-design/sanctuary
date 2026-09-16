import { expect, it } from 'vitest';
import { enquiryDeliveryStatus } from './enquiryDeliveryStatus';

it('does not hide a stopped job behind a queued or sent outbox record', () => {
  for (const job of ['needs_attention', 'permanent_failed', 'cancelled'])
    for (const outbox of ['QUEUED', 'SENT']) expect(enquiryDeliveryStatus(outbox, job)).toContain('Needs attention');
  expect(enquiryDeliveryStatus('QUEUED', 'retrying')).toBe('Retrying automatically');
  expect(enquiryDeliveryStatus('QUEUED', 'provider_accepted')).toContain('Accepted by email provider');
  expect(enquiryDeliveryStatus('QUEUED', 'queued')).toBe('Queued for delivery');
  expect(enquiryDeliveryStatus('SENT', 'succeeded')).toBe('Sent');
  expect(enquiryDeliveryStatus('QUEUED', 'succeeded')).toContain('needs review');
  expect(enquiryDeliveryStatus(null)).toContain('Legacy delivery');
});
