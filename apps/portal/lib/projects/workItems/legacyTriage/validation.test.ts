import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseConfirmationCorrectionBody,
  parseConfirmationCorrectionReviewBody,
  parseLegacyContactedMigrationBody,
  parseLegacyContactedReviewQuery,
} from "./validation";

const PROJECT_UUID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const COMMAND_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const REPAIR_SIGNAL_ID = "44444444-4444-4444-8444-444444444444";
const EVIDENCE_FINGERPRINT = "A".repeat(64);

describe("legacy Contacted review validation", () => {
  it("accepts a bounded query and a scope-bound cursor", () => {
    const cursor = {
      dueRank: 1,
      followUpDate: "2026-07-31",
      updatedAt: "2026-07-29T01:00:00.000Z",
      projectId: PROJECT_UUID,
      scope: "all",
    };
    const result = parseLegacyContactedReviewQuery(
      new Request(
        `http://localhost/review?scope=all&limit=25&asOf=2026-07-29&cursor=${encodeURIComponent(JSON.stringify(cursor))}`,
      ),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        asOf: "2026-07-29",
        limit: 25,
        cursor,
        scope: "all",
      },
    });
  });

  it.each([
    ["scope=archive", "Scope must be due or all."],
    ["limit=0", "Limit must be between 1 and 100."],
    ["limit=20items", "Limit must be between 1 and 100."],
    ["asOf=2026-02-31", "asOf must be a calendar date."],
  ])("rejects malformed query input %s", (query, error) => {
    expect(
      parseLegacyContactedReviewQuery(
        new Request(`http://localhost/review?${query}`),
      ),
    ).toEqual({ ok: false, error });
  });

  it("rejects a cursor copied from another scope", () => {
    const cursor = encodeURIComponent(
      JSON.stringify({
        dueRank: 0,
        followUpDate: "2026-07-29",
        updatedAt: "2026-07-29T01:00:00.000Z",
        projectId: PROJECT_UUID,
        scope: "all",
      }),
    );
    expect(
      parseLegacyContactedReviewQuery(
        new Request(`http://localhost/review?scope=due&cursor=${cursor}`),
      ),
    ).toEqual({
      ok: false,
      error: "Cursor is invalid for this review.",
    });
  });
});

describe("one-project reviewed migration validation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T02:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes ACTIVE_WORK and clears fields from other dispositions", () => {
    expect(
      parseLegacyContactedMigrationBody({
        commandId: ` ${COMMAND_ID} `,
        expectedUpdatedAt: "2026-07-29T00:00:00Z",
        expectedEvidenceFingerprint: EVIDENCE_FINGERPRINT,
        disposition: " active_work ",
        reason: " Reviewed active obligation ",
        title: " Email the customer ",
        responsibilityArea: " customer ",
        dueAt: "2026-07-30T04:00:00Z",
        waitingUntil: "2026-08-30T00:00:00Z",
        closedOutcome: "CANCELLED",
      }),
    ).toEqual({
      ok: true,
      value: {
        commandId: COMMAND_ID,
        expectedUpdatedAt: "2026-07-29T00:00:00.000Z",
        expectedEvidenceFingerprint: EVIDENCE_FINGERPRINT.toLowerCase(),
        disposition: "ACTIVE_WORK",
        reason: "Reviewed active obligation",
        title: "Email the customer",
        responsibilityArea: "CUSTOMER",
        dueAt: "2026-07-30T04:00:00.000Z",
        waitingUntil: null,
        closedOutcome: null,
      },
    });
  });

  it.each([
    [
      {
        commandId: COMMAND_ID,
        expectedUpdatedAt: "2026-07-29T00:00:00Z",
        expectedEvidenceFingerprint: EVIDENCE_FINGERPRINT,
        disposition: "ACTIVE_WORK",
        reason: "Reviewed",
      },
      "Active work requires a title, responsibility, and due time.",
    ],
    [
      {
        commandId: COMMAND_ID,
        expectedUpdatedAt: "2026-07-29T00:00:00Z",
        expectedEvidenceFingerprint: EVIDENCE_FINGERPRINT,
        disposition: "WAITING",
        reason: "Reviewed",
        waitingUntil: "2026-07-29T01:00:00Z",
      },
      "Waiting requires a future wake-up time.",
    ],
    [
      {
        commandId: COMMAND_ID,
        expectedUpdatedAt: "2026-07-29T00:00:00Z",
        expectedEvidenceFingerprint: EVIDENCE_FINGERPRINT,
        disposition: "CLOSED",
        reason: "Reviewed",
        closedOutcome: "COMPLETE",
      },
      "Closed requires a valid outcome.",
    ],
  ])("requires disposition-specific evidence", (input, error) => {
    expect(parseLegacyContactedMigrationBody(input)).toEqual({
      ok: false,
      error,
    });
  });
});

describe("confirmation correction validation", () => {
  it("requires stable ids and an explicit correction reason", () => {
    expect(
      parseConfirmationCorrectionBody({
        projectId: PROJECT_ID,
        commandId: COMMAND_ID,
        confirmationEventId: EVENT_ID,
        reason: " The message was not sent ",
      }),
    ).toEqual({
      ok: true,
      value: {
        projectId: PROJECT_ID,
        commandId: COMMAND_ID,
        confirmationEventId: EVENT_ID,
        reason: "The message was not sent",
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
      error: "Record a correction reason of 1 to 1000 characters.",
    });
  });

  it("requires a reason before resolving the correction review", () => {
    expect(
      parseConfirmationCorrectionReviewBody({
        projectId: PROJECT_ID,
        repairSignalId: REPAIR_SIGNAL_ID,
        expectedSignalRowVersion: 3,
        commandId: COMMAND_ID,
        reason: " Reviewed current state ",
      }),
    ).toEqual({
      ok: true,
      value: {
        projectId: PROJECT_ID,
        repairSignalId: REPAIR_SIGNAL_ID,
        expectedSignalRowVersion: 3,
        commandId: COMMAND_ID,
        reason: "Reviewed current state",
      },
    });
    expect(
      parseConfirmationCorrectionReviewBody({
        projectId: PROJECT_ID,
        repairSignalId: REPAIR_SIGNAL_ID,
        expectedSignalRowVersion: 3,
        commandId: "not-a-command-id",
        reason: "Reviewed current state",
      }),
    ).toEqual({
      ok: false,
      error: "A valid command id is required.",
    });
  });
});
