import { describe, expect, it } from 'vitest';
import { projectLocation } from './projectLocation';

describe('saved project location summary', () => {
  it.each([
    ['12 Example Road, Albany, Auckland 0632, New Zealand', 'Albany'],
    ['12 Example Road, Mount Eden, Auckland', 'Mount Eden'],
    ['12 Example Road, St Heliers, Auckland', 'St Heliers'],
    ['12 Example Road, Auckland 1010', 'Auckland'],
    ['12 Example Road, Te Rapa, Hamilton 3200, NZ', 'Hamilton'],
    ['12 Example Road, Cambridge 3434', 'Cambridge'],
    ['12 Example Road\nŌtūmoetai\nTauranga 3110', 'Tauranga'],
    ['Albany', 'Albany'],
    ['Auckland 1010, New Zealand', 'Auckland'],
    ['12 Example Road Albany Auckland', '12 Example Road Albany Auckland'],
  ])('summarises %s without inventing geography', (siteAddress, expected) => {
    expect(projectLocation({ siteAddress })).toBe(expected);
  });
  it('uses a recorded region only as a fallback and removes a trailing matching region', () => {
    expect(projectLocation({ region: 'Auckland' })).toBe('Auckland');
    expect(projectLocation({ siteAddress: '12 Example Road, Hamilton, Waikato', region: 'Waikato' })).toBe('Hamilton');
    expect(projectLocation({})).toBe('Location not recorded');
  });
});
