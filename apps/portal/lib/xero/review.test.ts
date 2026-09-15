import { describe, expect, it } from 'vitest';
import { reviewQuery } from './review';

describe('exact Xero review queries', () => {
  it.each(['Li', 'A', 'ABC (NZ) Ltd', 'Smith, Jones & Co.', 'Nguyễn / 李', 'A'.repeat(240)])(
    'accepts the invoice customer name %s', name => {
      expect(reviewQuery('receipt', name)).toEqual({
        resource: 'BankTransactions', where: `Type=="RECEIVE"&&Contact.Name=="${name}"`,
      });
    },
  );
  it.each(['Peter"||true', 'Quote " and \\ slash', 'Line\nBreak', 'Tab\tName'])('keeps %s inside one literal', name => {
    const { where } = reviewQuery('receipt', name);
    const literal = where.slice('Type=="RECEIVE"&&Contact.Name=='.length);
    // Xero's where parser escapes embedded quotes by doubling them.
    expect(literal).toMatch(/^"(?:[^"]|"")*"$/u);
    expect(literal.slice(1, -1).replaceAll('""', '"')).toBe(name);
  });
  it('trims search padding and rejects empty, oversized or unsupported queries', () => {
    expect(reviewQuery('receipt', ' Li ').where).toContain('Contact.Name=="Li"');
    for (const name of ['', '   ', 'A'.repeat(241)]) expect(() => reviewQuery('receipt', name)).toThrow('INVALID_QUERY');
    expect(() => reviewQuery('Payments', 'Li')).toThrow('INVALID_QUERY');
  });
});
