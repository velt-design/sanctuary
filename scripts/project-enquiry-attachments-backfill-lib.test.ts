import { describe, expect, it } from "vitest";
import { classifyProjectEnquiryAttachments } from "./project-enquiry-attachments-backfill-lib";

const projectId = "11111111-1111-4111-8111-111111111111";
const submissionId = "22222222-2222-4222-8222-222222222222";
const enquiryId = "33333333-3333-4333-8333-333333333333";
const storagePath = `pending/${submissionId}/0-plan.pdf`;

function enquiry(overrides: Record<string, unknown> = {}) {
  return {
    id: enquiryId,
    project_id: projectId,
    submission_id: submissionId,
    created_at: "2026-01-01T00:00:00Z",
    files: [{ path: storagePath, name: "plan.pdf", type: "application/pdf", size: 400 }],
    ...overrides,
  };
}

describe("project enquiry attachment backfill classifier", () => {
  it("links only an exact enquiry JSON and Storage path match", () => {
    const report = classifyProjectEnquiryAttachments({
      enquiries: [enquiry()],
      projectIds: [projectId],
      existingAttachments: [],
      storedObjects: [{ path: storagePath, sizeBytes: 400 }],
    });
    expect(report.candidates).toEqual([
      expect.objectContaining({
        enquiry_request_id: enquiryId,
        project_id: projectId,
        file_ordinal: 0,
        storage_path: storagePath,
      }),
    ]);
    expect(report.ambiguousMatches).toEqual([]);
  });

  it("reports missing and unmatched objects without matching by filename", () => {
    const unmatchedPath = "pending/99999999-9999-4999-8999-999999999999/0-plan.pdf";
    const report = classifyProjectEnquiryAttachments({
      enquiries: [enquiry()],
      projectIds: [projectId],
      existingAttachments: [],
      storedObjects: [{ path: unmatchedPath, sizeBytes: 400 }],
    });
    expect(report.candidates).toEqual([]);
    expect(report.missingObjects).toEqual([expect.objectContaining({ storage_path: storagePath })]);
    expect(report.unmatchedObjects).toEqual([{ path: unmatchedPath, sizeBytes: 400 }]);
  });

  it("quarantines duplicate paths and changed project links", () => {
    const report = classifyProjectEnquiryAttachments({
      enquiries: [enquiry()],
      projectIds: [projectId],
      storedObjects: [{ path: storagePath, sizeBytes: 400 }],
      existingAttachments: [{
        enquiry_request_id: enquiryId,
        project_id: "44444444-4444-4444-8444-444444444444",
        submission_id: submissionId,
        file_ordinal: 0,
        storage_bucket: "enquiry-attachments",
        storage_path: storagePath,
        original_filename: "plan.pdf",
        content_type: "application/pdf",
        size_bytes: 400,
      }],
    });
    expect(report.candidates).toEqual([]);
    expect(report.ambiguousMatches[0]?.reason).toBe("existing_attachment_conflicts");
    expect(report.projectsMergedOrChanged[0]).toEqual(expect.objectContaining({
      reason: "project_link_changed",
    }));
    expect(report.projectHistoryCoverage.mergeHistoryAvailable).toBe(false);
  });

  it("does not report project history noise for enquiries with no files", () => {
    const report = classifyProjectEnquiryAttachments({
      enquiries: [enquiry({ project_id: null, files: [] })],
      projectIds: [],
      existingAttachments: [],
      storedObjects: [],
    });
    expect(report.projectsMergedOrChanged).toEqual([]);
    expect(report.ambiguousMatches).toEqual([]);
  });
});
