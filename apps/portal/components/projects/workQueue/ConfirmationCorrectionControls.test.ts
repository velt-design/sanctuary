import { describe, expect, it } from 'vitest';
import { confirmationFactLabel } from './ConfirmationCorrectionControls.client';

describe('confirmation correction presentation', () => {
  it('identifies the durable fact and its recorded occurrence time', () => {
    expect(confirmationFactLabel({
      type: 'FIRST_ENQUIRY_EMAIL_SENT',
      occurredAt: '2026-07-29T00:30:00.000Z',
    })).toMatch(/^First enquiry email sent - /);
  });

  it('does not include customer or contact details in the label', () => {
    const label = confirmationFactLabel({
      type: 'SITE_VISIT_COMPLETED',
      occurredAt: '2026-07-29T00:30:00.000Z',
    });
    expect(label).toContain('Site visit completed');
    expect(label).not.toMatch(/email address|phone|customer name/i);
  });
});
