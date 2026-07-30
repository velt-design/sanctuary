import { describe, expect, it } from 'vitest';
import type { LegacyContactedProject } from '@/lib/projects/workItems/legacyTriage/types';
import {
  defaultLegacyMigrationDraft,
  legacyFollowUpDateLabel,
  legacyMigrationDraftError,
  legacyReasonLabel,
} from './legacyContactedPresentation';

const baseProject: LegacyContactedProject = {
  projectId: 'proj_11111111-1111-4111-8111-111111111111',
  projectName: 'A reviewed project',
  pipelineStage: 'contacted',
  updatedAt: '2026-07-28T00:00:00.000Z',
  evidenceFingerprint: 'a'.repeat(64),
  followUpDate: null,
  recommendation: 'MANUAL_CLASSIFICATION',
  reasonCodes: ['FOLLOW_UP_DATE_MISSING'],
  evidence: {
    currentQuote: false,
    currentInvoice: false,
    currentDesign: false,
    currentSchedule: false,
    runningJob: false,
    openObligation: false,
    sentEmail: false,
  },
};

describe('legacy Contacted review presentation', () => {
  it('defaults evidence to triage without creating a task or sending an email', () => {
    expect(defaultLegacyMigrationDraft({
      ...baseProject,
      recommendation: 'ACTIVE_EVIDENCE',
    })).toMatchObject({
      disposition: 'ACTIVE_TRIAGE',
      title: '',
      dueAt: '',
    });
  });

  it('defaults only strong no-response evidence to a reviewed close disposition', () => {
    expect(defaultLegacyMigrationDraft({
      ...baseProject,
      recommendation: 'LOST_NO_RESPONSE_CANDIDATE',
    })).toMatchObject({
      disposition: 'CLOSED',
      closedOutcome: 'LOST_NO_RESPONSE',
    });
  });

  it('requires an explicit reason and complete disposition-specific fields', () => {
    const draft = defaultLegacyMigrationDraft(baseProject);
    expect(legacyMigrationDraftError(draft)).toBe(
      'Record why this disposition is correct.',
    );
    expect(legacyMigrationDraftError({
      ...draft,
      disposition: 'WAITING',
      reason: 'Customer asked us to wait.',
      waitingUntil: '2026-07-28T00:00',
    }, new Date('2026-07-29T00:00:00.000Z'))).toBe(
      'The wake-up time must be in the future.',
    );
  });

  it('translates machine evidence without customer or contact content', () => {
    expect(legacyReasonLabel('SENT_EMAIL_EVIDENCE')).toBe(
      'Follow-up email recorded sent',
    );
  });

  it('formats date-only follow-up values without advancing the Auckland day', () => {
    expect(legacyFollowUpDateLabel('2026-07-29')).toBe('29 Jul 2026');
    expect(legacyFollowUpDateLabel('2026-02-31')).toBe('Not recorded');
  });
});
