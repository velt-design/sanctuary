import { describe, expect, it, vi } from "vitest";
import {
  runConfirmationCorrection,
  runConfirmationCorrectionReview,
  runLegacyContactedMigration,
} from "./commands";

const PROJECT_UUID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const COMMAND_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const REPAIR_SIGNAL_ID = "55555555-5555-4555-8555-555555555555";
const EVIDENCE_FINGERPRINT = "a".repeat(64);

describe("legacy triage command adapters", () => {
  it("maps the exact one-project reviewed migration RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        project_id: PROJECT_UUID,
        disposition: "ACTIVE_WORK",
        operational_state: "ACTIVE",
        state_row_version: 2,
        work_item_id: "44444444-4444-4444-8444-444444444444",
        project_updated_at: "2026-07-29T02:00:00Z",
        replayed: false,
        refresh_required: false,
      },
      error: null,
    });
    const supabase = { rpc } as any;

    const result = await runLegacyContactedMigration(supabase, {
      projectUuid: PROJECT_UUID,
      commandId: COMMAND_ID,
      expectedUpdatedAt: "2026-07-29T01:00:00.000Z",
      expectedEvidenceFingerprint: EVIDENCE_FINGERPRINT,
      disposition: "ACTIVE_WORK",
      reason: "Reviewed one project",
      title: "Email customer",
      responsibilityArea: "CUSTOMER",
      dueAt: "2026-07-30T04:00:00.000Z",
      waitingUntil: null,
      closedOutcome: null,
    });

    expect(rpc).toHaveBeenCalledWith(
      "project_work_migrate_legacy_contacted_v1",
      {
        p_project_id: PROJECT_UUID,
        p_command_id: COMMAND_ID,
        p_expected_updated_at: "2026-07-29T01:00:00.000Z",
        p_expected_evidence_fingerprint: EVIDENCE_FINGERPRINT,
        p_disposition: "ACTIVE_WORK",
        p_reason: "Reviewed one project",
        p_title: "Email customer",
        p_responsibility_area: "CUSTOMER",
        p_due_at: "2026-07-30T04:00:00.000Z",
        p_waiting_until: null,
        p_closed_outcome: null,
      },
    );
    expect(result).toEqual({
      projectId: PROJECT_ID,
      disposition: "ACTIVE_WORK",
      operationalState: "ACTIVE",
      stateRowVersion: 2,
      workItemId: "44444444-4444-4444-8444-444444444444",
      projectUpdatedAt: "2026-07-29T02:00:00Z",
      replayed: false,
      refreshRequired: false,
    });
  });

  it("maps correction and explicit review as separate durable commands", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          project_id: PROJECT_UUID,
          confirmation_event_id: EVENT_ID,
          retraction_event_id: "44444444-4444-4444-8444-444444444444",
          repair_signal_id: REPAIR_SIGNAL_ID,
          review_required: true,
          replayed: false,
          refresh_required: false,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          project_id: PROJECT_UUID,
          repair_signal_id: REPAIR_SIGNAL_ID,
          signal_row_version: 2,
          resolved_count: 1,
          replayed: true,
          refresh_required: false,
        },
        error: null,
      });
    const supabase = { rpc } as any;

    await expect(
      runConfirmationCorrection(supabase, {
        projectUuid: PROJECT_UUID,
        projectId: PROJECT_ID,
        commandId: COMMAND_ID,
        confirmationEventId: EVENT_ID,
        reason: "Incorrect confirmation",
      }),
    ).resolves.toEqual({
      projectId: PROJECT_ID,
      confirmationEventId: EVENT_ID,
      retractionEventId: "44444444-4444-4444-8444-444444444444",
      repairSignalId: REPAIR_SIGNAL_ID,
      reviewRequired: true,
      replayed: false,
      refreshRequired: false,
    });

    await expect(
      runConfirmationCorrectionReview(supabase, {
        projectUuid: PROJECT_UUID,
        projectId: PROJECT_ID,
        repairSignalId: REPAIR_SIGNAL_ID,
        expectedSignalRowVersion: 1,
        commandId: "66666666-6666-4666-8666-666666666666",
        reason: "Current work and lifecycle state checked",
      }),
    ).resolves.toEqual({
      projectId: PROJECT_ID,
      repairSignalId: REPAIR_SIGNAL_ID,
      signalRowVersion: 2,
      resolvedCount: 1,
      reviewRequired: false,
      replayed: true,
      refreshRequired: false,
    });

    expect(rpc.mock.calls).toEqual([
      [
        "project_confirmation_retraction_command",
        {
          p_project_id: PROJECT_UUID,
          p_command_id: COMMAND_ID,
          p_confirmation_event_id: EVENT_ID,
          p_reason: "Incorrect confirmation",
        },
      ],
      [
        "project_confirmation_retraction_review_command",
        {
          p_project_id: PROJECT_UUID,
          p_repair_signal_id: REPAIR_SIGNAL_ID,
          p_expected_signal_row_version: 1,
          p_command_id: "66666666-6666-4666-8666-666666666666",
          p_reason: "Current work and lifecycle state checked",
        },
      ],
    ]);
  });

  it("rejects incomplete correction results and preserves RPC error codes", async () => {
    const incomplete = {
      rpc: vi.fn().mockResolvedValue({
        data: { project_id: PROJECT_UUID },
        error: null,
      }),
    } as any;
    await expect(
      runConfirmationCorrection(incomplete, {
        projectUuid: PROJECT_UUID,
        projectId: PROJECT_ID,
        commandId: COMMAND_ID,
        confirmationEventId: EVENT_ID,
        reason: "Incorrect confirmation",
      }),
    ).rejects.toThrow(/incomplete result/i);

    const databaseError = {
      code: "40001",
      message: "STALE_PROJECT",
    };
    const failed = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: databaseError }),
    } as any;
    await expect(
      runLegacyContactedMigration(failed, {
        projectUuid: PROJECT_UUID,
        commandId: COMMAND_ID,
        expectedUpdatedAt: "2026-07-29T01:00:00.000Z",
        expectedEvidenceFingerprint: EVIDENCE_FINGERPRINT,
        disposition: "ACTIVE_TRIAGE",
        reason: "Reviewed",
      }),
    ).rejects.toMatchObject(databaseError);
  });
});
