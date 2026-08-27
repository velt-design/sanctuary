import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/list/listLimits";
import { uuidFromAppId } from "@/lib/supabase/mappers";
import type { ProjectEnquiryAttachment } from "./types";

const BUCKET = "enquiry-attachments";
const SIGNED_URL_SECONDS = 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AttachmentRow = {
  id: string;
  project_id: string | null;
  enquiry_request_id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  content_type: ProjectEnquiryAttachment["contentType"];
  size_bytes: number;
  created_at: string;
};

export class ProjectEnquiryAttachmentError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ProjectEnquiryAttachmentError";
  }
}

function projectUuid(projectId: string): string {
  try {
    return uuidFromAppId(projectId, "proj");
  } catch {
    throw new ProjectEnquiryAttachmentError(
      "Invalid project ID.",
      400,
      "invalid_project_id",
    );
  }
}

function mapAttachment(row: AttachmentRow): ProjectEnquiryAttachment {
  return {
    id: row.id,
    filename: row.original_filename,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    submittedAt: row.created_at,
  };
}

async function assertProjectAccess(
  supabase: SupabaseClient,
  projectId: string,
): Promise<string> {
  const uuid = projectUuid(projectId);
  const result = await supabase
    .from("projects")
    .select("id")
    .eq("id", uuid)
    .maybeSingle();
  if (result.error) {
    throw new ProjectEnquiryAttachmentError(
      "Project files could not be loaded.",
      500,
      "project_access_failed",
    );
  }
  if (!result.data) {
    throw new ProjectEnquiryAttachmentError(
      "Project not found.",
      404,
      "project_not_found",
    );
  }
  return uuid;
}

export async function listProjectEnquiryAttachments(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectEnquiryAttachment[]> {
  const uuid = await assertProjectAccess(supabase, projectId);
  const result = await fetchAllPages<AttachmentRow>((from, to) =>
    supabase
      .from("project_enquiry_attachments")
      .select(
        "id,project_id,enquiry_request_id,storage_bucket,storage_path,original_filename,content_type,size_bytes,created_at",
        { count: "exact" },
      )
      .eq("project_id", uuid)
      .order("created_at", { ascending: false })
      .order("file_ordinal", { ascending: true })
      .range(from, to),
  );
  if (result.truncated) {
    throw new ProjectEnquiryAttachmentError(
      "Project files exceed the supported list size.",
      503,
      "attachment_list_incomplete",
    );
  }
  return result.rows.map(mapAttachment);
}

export async function createProjectEnquiryAttachmentSignedUrl(
  supabase: SupabaseClient,
  input: {
    projectId: string;
    attachmentId: string;
    disposition: "view" | "download";
    actorUserId: string;
    requestId: string;
  },
): Promise<{ signedUrl: string; expiresInSeconds: number }> {
  const uuid = await assertProjectAccess(supabase, input.projectId);
  if (!UUID_PATTERN.test(input.attachmentId)) {
    throw new ProjectEnquiryAttachmentError(
      "Attachment not found.",
      404,
      "attachment_not_found",
    );
  }
  const result = await supabase
    .from("project_enquiry_attachments")
    .select(
      "id,project_id,enquiry_request_id,storage_bucket,storage_path,original_filename,content_type,size_bytes,created_at",
    )
    .eq("id", input.attachmentId)
    .eq("project_id", uuid)
    .maybeSingle();
  if (result.error) {
    throw new ProjectEnquiryAttachmentError(
      "Attachment access could not be verified.",
      500,
      "attachment_access_failed",
    );
  }
  if (!result.data) {
    throw new ProjectEnquiryAttachmentError(
      "Attachment not found.",
      404,
      "attachment_not_found",
    );
  }
  const row = result.data as AttachmentRow;
  if (row.storage_bucket !== BUCKET || row.project_id !== uuid) {
    throw new ProjectEnquiryAttachmentError(
      "Attachment not found.",
      404,
      "attachment_not_found",
    );
  }

  const signed = await supabase.storage.from(BUCKET).createSignedUrl(
    row.storage_path,
    SIGNED_URL_SECONDS,
    input.disposition === "download"
      ? { download: row.original_filename }
      : undefined,
  );
  if (signed.error || !signed.data?.signedUrl) {
    throw new ProjectEnquiryAttachmentError(
      "The attachment could not be opened.",
      503,
      "attachment_sign_failed",
    );
  }

  const audit = await supabase.from("project_enquiry_attachment_events").insert({
    attachment_id: row.id,
    enquiry_request_id: row.enquiry_request_id,
    event_type:
      input.disposition === "download"
        ? "download_url_issued"
        : "view_url_issued",
    previous_project_id: null,
    project_id: uuid,
    actor_user_id: input.actorUserId,
    request_id: input.requestId,
    link_origin: null,
  });
  if (audit.error) {
    throw new ProjectEnquiryAttachmentError(
      "Attachment access could not be recorded.",
      503,
      "attachment_audit_failed",
    );
  }

  return {
    signedUrl: signed.data.signedUrl,
    expiresInSeconds: SIGNED_URL_SECONDS,
  };
}
