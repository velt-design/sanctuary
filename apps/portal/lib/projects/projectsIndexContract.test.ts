import { describe, expect, it } from 'vitest';
import {
  isProjectsIndexJourneyFilter,
  isProjectsIndexStateFilter,
  isProjectsIndexStatusFilter,
} from './projectsIndexContract';

describe('projects index filter contract', () => {
  it('accepts only approved journey phases', () => {
    expect(isProjectsIndexJourneyFilter('PROPOSAL')).toBe(true);
    expect(isProjectsIndexJourneyFilter('all')).toBe(true);
    expect(isProjectsIndexJourneyFilter('QUOTING')).toBe(false);
  });

  it('accepts current effective states including archived', () => {
    expect(isProjectsIndexStateFilter('ACTIVE')).toBe(true);
    expect(isProjectsIndexStateFilter('WAITING')).toBe(true);
    expect(isProjectsIndexStateFilter('CLOSED')).toBe(true);
    expect(isProjectsIndexStateFilter('ARCHIVED')).toBe(true);
    expect(isProjectsIndexStateFilter('LOST')).toBe(false);
  });

  it('keeps detailed stages separate from journey and state', () => {
    expect(isProjectsIndexStatusFilter('SENT')).toBe(true);
    expect(isProjectsIndexStatusFilter('PROPOSAL')).toBe(false);
  });
});
