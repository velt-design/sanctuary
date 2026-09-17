import { describe, expect, it } from 'vitest';
import { splitProjectEmailText, usefulEmailOpening } from './projectEmailText';

describe('email reading structure', () => {
  it('separates explicit quoted headers and preserves every source character', () => {
    const text = 'Hi Joe,\r\n\r\nPlease call me.\r\n\r\nCheers,\r\nAroha\r\n\r\nFrom: Aroha <customer@example.test>\r\nDate: Monday\r\nTo: Joe\r\nSubject: Quote\r\nQuestions about lighting.\r\n\r\nOn Sunday, Joe wrote:\r\nEarlier quote text.';
    const result = splitProjectEmailText(text);
    expect(result.history).toHaveLength(2);
    expect(result.latest + result.history.map(part => part.header + part.body).join('')).toBe(text);
    expect(usefulEmailOpening(result.latest, 'aroha@example.test')).toBe('Please call me.');
  });
  it.each(['From: the house to the boundary\nPlease measure this.', 'Hi Joe, can you call me?', 'Hello,\n', 'Cheers,\nAroha'])('does not lose ambiguous or greeting-only content: %s', text => {
    expect(splitProjectEmailText(text)).toEqual({ latest: text, history: [] });
    expect(usefulEmailOpening(text)).toBe(text.trim());
  });
  it('keeps actionable content following a sign-off rather than treating it as a name', () => {
    const text = 'Please call.\nCheers,\nCan you confirm the price?';
    expect(usefulEmailOpening(text)).toBe(text);
    const shortRequest = 'The price looks good.\nCheers,\nPlease call tomorrow';
    expect(usefulEmailOpening(shortRequest, 'aroha@example.test')).toBe(shortRequest);
    const openingRequest = 'Hi please do not order yet,\nI will confirm tomorrow.';
    expect(usefulEmailOpening(openingRequest, 'aroha@example.test')).toBe(openingRequest);
    expect(usefulEmailOpening('Hi Joe,\nPlease call.\nCheers,\nJosh', 'joshsurman@example.test')).toBe('Please call.\nCheers,\nJosh');
  });
});
