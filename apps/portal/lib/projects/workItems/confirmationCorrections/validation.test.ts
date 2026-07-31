import { describe, expect, it } from 'vitest';
import {
  parseConfirmationCorrectionBody,
  parseConfirmationCorrectionReviewBody,
} from './validation';

const PROJECT_ID = 'proj_11111111-1111-4111-8111-111111111111';
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';
const EVENT_ID = '33333333-3333-4333-8333-333333333333';
const REPAIR_SIGNAL_ID = '44444444-4444-4444-8444-444444444444';

describe('confirmation correction validation', () => {
  it('requires stable ids and an explicit correction reason', () => {
    expect(
      parseConfirmationCorrectionBody({
        projectId: PROJECT_ID,
        commandId: COMMAND_ID,
        confirmationEventId: EVENT_ID,
        reason: ' The message was not sent ',
      }),
    ).toEqual({
      ok: true,
      value: {
        projectId: PROJECT_ID,
        commandId: COMMAND_ID,
        confirmationEventId: EVENT_ID,
        reason: 'The message was not sent',
      },
    });
    expect(
      parseConfirmationCorrectionBody({
        projectId: PROJECT_ID,
        commandId: COMMAND_ID,
        confirmationEventId: EVENT_ID,
      }),
    ).toEqual({
      ok: false,
      error: 'Record a correction reason of 1 to 1000 characters.',
    });
  });

  it('requires a reason before resolving the correction review', () => {
    expect(
      parseConfirmationCorrectionReviewBody({
        projectId: PROJECT_ID,
        repairSignalId: REPAIR_SIGNAL_ID,
        expectedSignalRowVersion: 3,
        commandId: COMMAND_ID,
        reason: ' Reviewed current state ',
      }),
    ).toEqual({
      ok: true,
      value: {
        projectId: PROJECT_ID,
        repairSignalId: REPAIR_SIGNAL_ID,
        expectedSignalRowVersion: 3,
        commandId: COMMAND_ID,
        reason: 'Reviewed current state',
      },
    });
    expect(
      parseConfirmationCorrectionReviewBody({
        projectId: PROJECT_ID,
        repairSignalId: REPAIR_SIGNAL_ID,
        expectedSignalRowVersion: 3,
        commandId: 'not-a-command-id',
        reason: 'Reviewed current state',
      }),
    ).toEqual({
      ok: false,
      error: 'A valid command id is required.',
    });
  });
});
