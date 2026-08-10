import { describe, expect, it } from 'vitest';
import {
  coerceProjectTab,
  getAvailableProjectTabs,
  isProjectNavigationTabSelected,
} from './projectTabs';

describe('project tab contract', () => {
  it('exposes Commercial as the estimate-led project navigation owner', () => {
    expect(getAvailableProjectTabs(true).map((tab) => [tab.key, tab.label])).toEqual([
      ['activity', 'Overview'],
      ['estimates', 'Commercial'],
      ['job-packs', 'Job Packs'],
    ]);
    expect(getAvailableProjectTabs(false).map((tab) => tab.key)).toEqual(['activity', 'estimates']);
  });

  it('keeps quote and invoice URLs while grouping them under Commercial', () => {
    expect(coerceProjectTab('quotes', true)).toBe('quotes');
    expect(coerceProjectTab('invoices', true)).toBe('invoices');
    expect(isProjectNavigationTabSelected('estimates', 'quotes')).toBe(true);
    expect(isProjectNavigationTabSelected('estimates', 'invoices')).toBe(true);
  });

  it('retires Emails and normalizes invalid or unavailable routes', () => {
    expect(coerceProjectTab('emails', true)).toBe('activity');
    expect(coerceProjectTab('details', true)).toBe('activity');
    expect(coerceProjectTab('job-packs', false)).toBe('activity');
  });
});
