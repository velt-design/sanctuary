import { describe, expect, it } from 'vitest';
import { projectEmailGroups, referencesProjectQuote, type EmailMessage } from './projectEmailGroups';
const message: EmailMessage = { id: 'one', from: 'staff@example.test', subject: 'Quote Q-0100',
  sentAt: '2026-09-15T10:00:00Z', receivedAt: '2026-09-15T10:00:00Z', observedAt: '2026-09-15T11:00:00Z',
  url: 'https://outlook.office.com/mail/id/one', bodyText: 'Please review the revised quote.', truncated: false, association: 'customer_address_only' };

describe('project email priorities', () => {
  it('features the latest email and the latest customer reply, retaining other mail and duplicate sources', () => {
    const reply = { ...message, id: 'reply', from: 'customer@example.test', sentAt: '2026-09-14T10:00:00Z' };
    const old = { ...message, id: 'old', sentAt: '2026-09-13T10:00:00Z' };
    const grouped = projectEmailGroups([old, reply, message, { ...message, id: 'copy', url: 'https://outlook.office.com/mail/id/copy' }], 'CUSTOMER@example.test');
    expect(grouped.featured.map(group => group.message.id)).toEqual(['one', 'reply']);
    expect(grouped.featured[0].copies[0].id).toBe('copy');
    expect(grouped.earlier.map(group => group.message.id)).toEqual(['old']);
  });
  it('does not group incomplete excerpts or distinct quote versions', () => {
    const result = projectEmailGroups([message, { ...message, id: 'v2', subject: 'Quote Q-0100 v2' },
      { ...message, id: 'partial-a', truncated: true }, { ...message, id: 'partial-b', truncated: true }]);
    expect([...result.featured, ...result.earlier]).toHaveLength(4);
    expect(result.featured[0].copies).toEqual([]);
  });
  it('matches an exact subject quote reference, not a prefix or quoted body history', () => {
    expect(referencesProjectQuote(message, 'Q-0100')).toBe(true);
    expect(referencesProjectQuote({ ...message, subject: 'Quote Q-01001' }, 'Q-0100')).toBe(false);
    expect(referencesProjectQuote({ ...message, subject: 'Another job', bodyText: 'Earlier quote Q-0100' }, 'Q-0100')).toBe(false);
    expect(referencesProjectQuote(message, null)).toBe(false);
  });
});
