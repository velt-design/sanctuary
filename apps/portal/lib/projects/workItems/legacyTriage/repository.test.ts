import { describe, expect, it, vi } from "vitest";
import { getLegacyContactedReview } from "./repository";

const PROJECT_UUID = "11111111-1111-4111-8111-111111111111";
const EVIDENCE_FINGERPRINT = "a".repeat(64);

describe("legacy Contacted classifier repository", () => {
  it("maps the read-only RPC payload without introducing contact fields", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        projects: [
          {
            projectId: PROJECT_UUID,
            projectName: "Reviewed fixture",
            pipelineStage: "contacted",
            updatedAt: "2026-07-29T01:00:00Z",
            evidenceFingerprint: EVIDENCE_FINGERPRINT,
            followUpDate: "2026-07-29",
            recommendation: "ACTIVE_EVIDENCE",
            reasonCodes: ["CURRENT_QUOTE", "OPEN_OBLIGATION"],
            evidence: {
              currentQuote: true,
              currentInvoice: false,
              currentDesign: false,
              currentSchedule: false,
              runningJob: false,
              openObligation: true,
              sentEmail: false,
            },
          },
        ],
        summary: {
          total: 1,
          due: 1,
          archived: 0,
          byRecommendation: {
            ACTIVE_EVIDENCE: 1,
            WAITING_CANDIDATE: 0,
            LOST_NO_RESPONSE_CANDIDATE: 0,
            MANUAL_CLASSIFICATION: 0,
          },
        },
        generatedAt: "2026-07-29T02:00:00Z",
        nextCursor: {
          dueRank: 0,
          followUpDate: "2026-07-29",
          updatedAt: "2026-07-29T01:00:00Z",
          projectId: PROJECT_UUID,
          scope: "due",
        },
      },
      error: null,
    });
    const supabase = { rpc } as any;

    const result = await getLegacyContactedReview(supabase, {
      asOf: "2026-07-29",
      limit: 25,
      scope: "due",
    });

    expect(rpc).toHaveBeenCalledWith(
      "project_work_classify_legacy_contacted_v1",
      {
        p_as_of: "2026-07-29",
        p_limit: 25,
        p_cursor: null,
        p_scope: "due",
      },
    );
    expect(result).toEqual({
      projects: [
        expect.objectContaining({
          projectId: `proj_${PROJECT_UUID}`,
          projectName: "Reviewed fixture",
          recommendation: "ACTIVE_EVIDENCE",
          evidenceFingerprint: EVIDENCE_FINGERPRINT,
          reasonCodes: ["CURRENT_QUOTE", "OPEN_OBLIGATION"],
        }),
      ],
      summary: {
        total: 1,
        due: 1,
        archived: 0,
        byRecommendation: {
          ACTIVE_EVIDENCE: 1,
          WAITING_CANDIDATE: 0,
          LOST_NO_RESPONSE_CANDIDATE: 0,
          MANUAL_CLASSIFICATION: 0,
        },
      },
      generatedAt: "2026-07-29T02:00:00.000Z",
      nextCursor: {
        dueRank: 0,
        followUpDate: "2026-07-29",
        updatedAt: "2026-07-29T01:00:00.000Z",
        projectId: PROJECT_UUID,
        scope: "due",
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /customerEmail|contactEmail|phone|contactId/i,
    );
  });

  it("rejects an unknown recommendation instead of inventing state", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          projects: [
            {
              projectId: PROJECT_UUID,
              projectName: "Unknown fixture",
              updatedAt: "2026-07-29T01:00:00Z",
              evidenceFingerprint: EVIDENCE_FINGERPRINT,
              recommendation: "ARCHIVE_AUTOMATICALLY",
            },
          ],
          summary: {},
          generatedAt: "2026-07-29T02:00:00Z",
        },
        error: null,
      }),
    } as any;

    await expect(getLegacyContactedReview(supabase)).rejects.toThrow(
      /unknown recommendation/i,
    );
  });

  it("propagates the database error code for route-level mapping", async () => {
    const error = {
      code: "PGRST202",
      message: "function is not in the schema cache",
    };
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error }),
    } as any;

    await expect(getLegacyContactedReview(supabase)).rejects.toMatchObject(
      error,
    );
  });
});
