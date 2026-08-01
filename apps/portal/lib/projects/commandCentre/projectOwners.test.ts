import { describe, expect, it } from 'vitest';
import {
  DELIVERY_OWNER_KEY,
  ENQUIRY_OWNER_KEY,
  PROJECT_OWNER_OPTIONS,
  buildProjectOwnerSummary,
  projectOwnerHandoffGuidance,
  projectOwnerOption,
} from './projectOwners';

describe('project owner policy', () => {
  it('keeps Ellen and Dave as stable named owner options', () => {
    expect(ENQUIRY_OWNER_KEY).toBe('ellen');
    expect(DELIVERY_OWNER_KEY).toBe('dave');
    expect(projectOwnerOption('ellen')).toEqual({
      key: 'ellen',
      displayName: 'Ellen',
    });
    expect(projectOwnerOption('dave')).toEqual({
      key: 'dave',
      displayName: 'Dave',
    });
    expect(PROJECT_OWNER_OPTIONS.map((owner) => owner.key)).toEqual(['ellen', 'jordan', 'jp', 'joe', 'bruce', 'dave']);
  });

  it('explains the manual owner handoff at each journey phase', () => {
    expect(projectOwnerHandoffGuidance('new')).toContain('Ellen');
    expect(projectOwnerHandoffGuidance('contacted')).toContain('Change the stage manually');
    expect(projectOwnerHandoffGuidance('site_visit')).toContain('Assign the Proposal owner manually');
    expect(projectOwnerHandoffGuidance('sent')).toContain('assign Dave');
    expect(projectOwnerHandoffGuidance('deposit')).toContain('Dave');
    expect(projectOwnerHandoffGuidance('scheduled')).toContain('delivery');
  });

  it('keeps an accountable owner required through delivery', () => {
    expect(
      buildProjectOwnerSummary({
        stage: 'scheduled',
        assignment: null,
        isAdmin: true,
      }),
    ).toMatchObject({ required: true, missing: true });
    expect(
      buildProjectOwnerSummary({
        stage: 'completed',
        assignment: null,
        isAdmin: true,
      }),
    ).toMatchObject({ required: true, missing: true });
    expect(
      buildProjectOwnerSummary({
        stage: 'paid',
        assignment: null,
        isAdmin: true,
      }),
    ).toMatchObject({ required: false, missing: false });
  });
});
