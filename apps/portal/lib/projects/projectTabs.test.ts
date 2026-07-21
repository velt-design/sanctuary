import { describe, expect, it } from 'vitest';
import {
  coerceProjectTab,
  getAvailableProjectTabs,
  isProjectNavigationTabSelected,
} from './projectTabs';

describe('project tab contract', () => {
  it('exposes the four project navigation owners', () => {
    expect(getAvailableProjectTabs(true).map((tab) => [tab.key, tab.label])).toEqual([
      ['activity', 'Overview'],
      ['estimates', 'Calculator'],
      ['quotes', 'Commercial'],
      ['job-packs', 'Job Packs'],
    ]);
    expect(getAvailableProjectTabs(false).map((tab) => tab.key)).toEqual(['activity', 'estimates', 'quotes']);
  });

  it('keeps invoice URLs while grouping them under Commercial', () => {
    expect(coerceProjectTab('invoices', true)).toBe('invoices');
    expect(isProjectNavigationTabSelected('quotes', 'invoices')).toBe(true);
  });

  it('retires Emails and normalizes invalid or unavailable routes', () => {
    expect(coerceProjectTab('emails', true)).toBe('activity');
    expect(coerceProjectTab('details', true)).toBe('activity');
    expect(coerceProjectTab('job-packs', false)).toBe('activity');
  });
});
