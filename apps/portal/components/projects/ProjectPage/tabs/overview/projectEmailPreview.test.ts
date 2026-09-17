import { describe, expect, it } from 'vitest';
import { projectEmailPreview } from './projectEmailPreview';

describe('email preview selection', () => {
  it('shows the generated invoice summary without repeating its branded document', () => {
    const body = 'Invoice INV-0123 for $500.00, due 20 Sept 2026.\nSanctuary Pergolas\nInvoice\nInvoice INV-0123\nHi Aroha, here is your invoice.';
    expect(projectEmailPreview(body, 'website@sanctuarypergolas.co.nz')).toBe('Invoice INV-0123 for $500.00, due 20 Sept 2026.');
    expect(projectEmailPreview(body, 'customer@example.test')).toBe(body.slice(0, 200));
  });
  it('does not remove human-authored content merely mentioning the company', () => {
    const body = 'Please check this detail.\nSanctuary Pergolas\nThe dimensions seem wrong.';
    expect(projectEmailPreview(body, 'info@sanctuarypergolas.co.nz')).toBe(body);
  });
  it('keeps the newest reply and leaves a header-only message readable', () => {
    expect(projectEmailPreview('Thanks, Monday works.\nFrom: Aroha\nOlder text', 'customer@example.test')).toBe('Thanks, Monday works.');
    expect(projectEmailPreview('From: Aroha\nForwarded detail', 'customer@example.test')).toBe('From: Aroha\nForwarded detail');
  });
});
