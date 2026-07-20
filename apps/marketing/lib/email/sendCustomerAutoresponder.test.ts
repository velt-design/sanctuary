import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResidentialOrCommercial } from '@/emails/types';

const h = vi.hoisted(() => ({
  render: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@react-email/render', () => ({
  render: h.render,
}));

vi.mock('@/lib/email/sendEmail', () => ({
  sendEmail: h.sendEmail,
}));

const enquiry: ResidentialOrCommercial = {
  leadId: 'enquiry-1',
  submittedAt: new Date('2026-07-20T01:00:00.000Z'),
  enquiryType: 'residential',
  name: 'Taylor',
  email: 'taylor@example.test',
  phone: '021000000',
  suburb: 'Mangere',
  widthM: 5,
  depthM: 3,
  heightM: 2.4,
  style: 'Pitched',
  roof: 'Acrylic',
  addons: [],
  blindsSelected: false,
  baseRange: { lowIncGst: 12_000, highIncGst: 12_000 },
};

describe('sendCustomerAutoresponder', () => {
  beforeEach(() => {
    h.render.mockReset();
    h.render.mockImplementation(async (_element: unknown, options?: { plainText?: boolean }) =>
      options?.plainText ? 'Rendered plain text' : '<p>Rendered HTML</p>',
    );
    h.sendEmail.mockReset();
  });

  it('returns the accepted provider message ID and forwards the frozen key and content', async () => {
    h.sendEmail.mockResolvedValue({ provider: 'resend', providerMessageId: 'provider-message-3' });
    const { sendCustomerAutoresponder } = await import('./sendCustomerAutoresponder');

    const providerMessageId = await sendCustomerAutoresponder(enquiry, {
      attachments: [{ filename: 'plan.pdf', content: 'UERGREFUQQ==', contentType: 'application/pdf' }],
      idempotencyKey: 'website:autoresponder:enquiry-1',
    });

    expect(h.sendEmail).toHaveBeenCalledWith({
      from: 'Sanctuary Pergolas <info@sanctuarypergolas.co.nz>',
      to: 'taylor@example.test',
      bcc: ['info@sanctuarypergolas.co.nz'],
      replyTo: 'info@sanctuarypergolas.co.nz',
      subject: 'Taylor, your Sanctuary Pergolas estimate is ready',
      html: '<p>Rendered HTML</p>',
      text: 'Rendered plain text',
      attachments: [{ filename: 'plan.pdf', content: 'UERGREFUQQ==', contentType: 'application/pdf' }],
      idempotencyKey: 'website:autoresponder:enquiry-1',
    });
    expect(providerMessageId).toBe('provider-message-3');
  });

  it('does not report a provider ID when delivery fails', async () => {
    const failure = Object.assign(new Error('Email delivery failed (RESEND_TIMEOUT).'), {
      code: 'RESEND_TIMEOUT',
    });
    h.sendEmail.mockRejectedValue(failure);
    const { sendCustomerAutoresponder } = await import('./sendCustomerAutoresponder');

    await expect(sendCustomerAutoresponder(enquiry)).rejects.toBe(failure);
  });
});
