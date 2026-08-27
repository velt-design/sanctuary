import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

import {
  createProjectEnquiryAttachmentSignedUrl,
} from "./server";

const projectUuid = "11111111-1111-4111-8111-111111111111";
const projectId = `proj_${projectUuid}`;
const attachmentId = "22222222-2222-4222-8222-222222222222";
const enquiryId = "33333333-3333-4333-8333-333333333333";
const path = "pending/44444444-4444-4444-8444-444444444444/0-plan.pdf";

function makeSupabase(options: { row?: Record<string, unknown> | null; auditError?: unknown } = {}) {
  const filters: Array<[string, unknown]> = [];
  const projectFilters: Array<[string, unknown]> = [];
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.row === undefined ? {
      id: attachmentId,
      project_id: projectUuid,
      enquiry_request_id: enquiryId,
      storage_bucket: "enquiry-attachments",
      storage_path: path,
      original_filename: "plan.pdf",
      content_type: "application/pdf",
      size_bytes: 500,
      created_at: "2026-08-27T00:00:00Z",
    } : options.row,
    error: null,
  });
  const attachmentBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return attachmentBuilder;
    }),
    maybeSingle,
  };
  const projectBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((column: string, value: unknown) => {
      projectFilters.push([column, value]);
      return projectBuilder;
    }),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: projectUuid }, error: null }),
  };
  const auditInsert = vi.fn().mockResolvedValue({ error: options.auditError ?? null });
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://storage.example/signed" },
    error: null,
  });
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "projects") return projectBuilder;
      if (table === "project_enquiry_attachments") return attachmentBuilder;
      if (table === "project_enquiry_attachment_events") return { insert: auditInsert };
      throw new Error(`Unexpected table ${table}`);
    }),
    storage: { from: vi.fn(() => ({ createSignedUrl })) },
  } as unknown as SupabaseClient;
  return { supabase, filters, projectFilters, createSignedUrl, auditInsert };
}

describe("createProjectEnquiryAttachmentSignedUrl", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires the exact attachment and project before generating a 60-second URL", async () => {
    const fake = makeSupabase();
    const result = await createProjectEnquiryAttachmentSignedUrl(fake.supabase, {
      projectId,
      attachmentId,
      disposition: "view",
      actorUserId: "55555555-5555-4555-8555-555555555555",
      requestId: "req-1",
    });
    expect(fake.projectFilters).toEqual([["id", projectUuid]]);
    expect(fake.filters).toEqual([["id", attachmentId], ["project_id", projectUuid]]);
    expect(fake.createSignedUrl).toHaveBeenCalledWith(path, 60, undefined);
    expect(result).toEqual({ signedUrl: "https://storage.example/signed", expiresInSeconds: 60 });
    expect(fake.auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: "view_url_issued",
      project_id: projectUuid,
      request_id: "req-1",
    }));
  });

  it("does not generate a URL for a file outside the requested project", async () => {
    const fake = makeSupabase({ row: null });
    await expect(createProjectEnquiryAttachmentSignedUrl(fake.supabase, {
      projectId,
      attachmentId,
      disposition: "view",
      actorUserId: "55555555-5555-4555-8555-555555555555",
      requestId: "req-2",
    })).rejects.toMatchObject({ status: 404, code: "attachment_not_found" });
    expect(fake.createSignedUrl).not.toHaveBeenCalled();
  });

  it("uses the original filename for downloads and fails closed if auditing fails", async () => {
    const fake = makeSupabase({ auditError: { message: "write failed" } });
    await expect(createProjectEnquiryAttachmentSignedUrl(fake.supabase, {
      projectId,
      attachmentId,
      disposition: "download",
      actorUserId: "55555555-5555-4555-8555-555555555555",
      requestId: "req-3",
    })).rejects.toMatchObject({ status: 503, code: "attachment_audit_failed" });
    expect(fake.createSignedUrl).toHaveBeenCalledWith(path, 60, { download: "plan.pdf" });
  });
});
