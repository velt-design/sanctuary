export const ENQUIRY_ATTACHMENT_BUCKET = "enquiry-attachments";

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type HistoricalEnquiry = {
  id: string;
  project_id: string | null;
  submission_id: string;
  files: unknown;
  created_at: string | null;
};

export type ExistingAttachment = {
  enquiry_request_id: string;
  project_id: string | null;
  submission_id: string;
  file_ordinal: number;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
};

export type StoredObject = {
  path: string;
  sizeBytes: number | null;
};

type BackfillCandidate = {
  enquiry_request_id: string;
  project_id: string;
  submission_id: string;
  file_ordinal: number;
  storage_path: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
};

type FileEvidence = BackfillCandidate & {
  reason?: string;
};

type BackfillClassification = {
  candidates: BackfillCandidate[];
  alreadyLinkedFiles: FileEvidence[];
  missingObjects: FileEvidence[];
  unmatchedObjects: StoredObject[];
  ambiguousMatches: FileEvidence[];
  projectsMergedOrChanged: Array<{
    enquiryRequestId: string;
    submissionId: string;
    recordedProjectId: string | null;
    linkedProjectId: string | null;
    reason: "missing_project" | "project_link_changed";
  }>;
  projectHistoryCoverage: {
    mergeHistoryAvailable: false;
    statement: string;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function fileEvidence(
  enquiry: HistoricalEnquiry,
  file: Record<string, unknown>,
  fileOrdinal: number,
): FileEvidence | null {
  if (!enquiry.project_id) return null;
  const storagePath = typeof file.path === "string" ? file.path : "";
  const originalFilename = typeof file.name === "string" ? file.name : "";
  const contentType = typeof file.type === "string" ? file.type : "";
  const sizeBytes = typeof file.size === "number" ? file.size : Number(file.size);
  return {
    enquiry_request_id: enquiry.id,
    project_id: enquiry.project_id,
    submission_id: enquiry.submission_id,
    file_ordinal: fileOrdinal,
    storage_path: storagePath,
    original_filename: originalFilename,
    content_type: contentType,
    size_bytes: sizeBytes,
  };
}

function evidenceProblem(evidence: FileEvidence): string | null {
  const escapedSubmission = evidence.submission_id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const canonicalPath = new RegExp(
    `^pending/${escapedSubmission}/[0-7]-[A-Za-z0-9._-]{1,160}$`,
  );
  if (!canonicalPath.test(evidence.storage_path)) return "non_canonical_storage_path";
  if (!evidence.original_filename) return "missing_original_filename";
  if (!ALLOWED_CONTENT_TYPES.has(evidence.content_type)) return "invalid_content_type";
  if (
    !Number.isSafeInteger(evidence.size_bytes)
    || evidence.size_bytes < 1
    || evidence.size_bytes > 20 * 1024 * 1024
  ) {
    return "invalid_size";
  }
  if (evidence.file_ordinal < 0 || evidence.file_ordinal > 7) return "invalid_ordinal";
  return null;
}

function isExactAttachment(existing: ExistingAttachment, candidate: BackfillCandidate): boolean {
  return existing.storage_bucket === ENQUIRY_ATTACHMENT_BUCKET
    && existing.storage_path === candidate.storage_path
    && existing.enquiry_request_id === candidate.enquiry_request_id
    && existing.project_id === candidate.project_id
    && existing.submission_id === candidate.submission_id
    && existing.file_ordinal === candidate.file_ordinal
    && existing.original_filename === candidate.original_filename
    && existing.content_type === candidate.content_type
    && Number(existing.size_bytes) === candidate.size_bytes;
}

export function classifyProjectEnquiryAttachments(input: {
  enquiries: HistoricalEnquiry[];
  projectIds: string[];
  existingAttachments: ExistingAttachment[];
  storedObjects: StoredObject[];
}): BackfillClassification {
  const projectIds = new Set(input.projectIds);
  const objectsByPath = new Map(input.storedObjects.map((object) => [object.path, object]));
  const existingByPath = new Map<string, ExistingAttachment[]>();
  for (const attachment of input.existingAttachments) {
    const rows = existingByPath.get(attachment.storage_path) ?? [];
    rows.push(attachment);
    existingByPath.set(attachment.storage_path, rows);
  }

  const referencedPathCounts = new Map<string, number>();
  for (const enquiry of input.enquiries) {
    if (!Array.isArray(enquiry.files)) continue;
    for (const raw of enquiry.files) {
      const file = asRecord(raw);
      const storagePath = file && typeof file.path === "string" ? file.path : "";
      if (storagePath) referencedPathCounts.set(storagePath, (referencedPathCounts.get(storagePath) ?? 0) + 1);
    }
  }

  const result: BackfillClassification = {
    candidates: [],
    alreadyLinkedFiles: [],
    missingObjects: [],
    unmatchedObjects: [],
    ambiguousMatches: [],
    projectsMergedOrChanged: [],
    projectHistoryCoverage: {
      mergeHistoryAvailable: false,
      statement:
        "No historical project-merge ledger exists. The report exposes current missing or changed project links but does not infer a merge from names, contacts, or filenames.",
    },
  };

  for (const enquiry of input.enquiries) {
    if (!Array.isArray(enquiry.files)) {
      if (enquiry.files !== null && enquiry.files !== undefined) {
        result.ambiguousMatches.push({
          enquiry_request_id: enquiry.id,
          project_id: enquiry.project_id ?? "",
          submission_id: enquiry.submission_id,
          file_ordinal: -1,
          storage_path: "",
          original_filename: "",
          content_type: "",
          size_bytes: 0,
          reason: "invalid_files_shape",
        });
      }
      continue;
    }
    if (enquiry.files.length === 0) continue;
    if (!enquiry.project_id || !projectIds.has(enquiry.project_id)) {
      result.projectsMergedOrChanged.push({
        enquiryRequestId: enquiry.id,
        submissionId: enquiry.submission_id,
        recordedProjectId: enquiry.project_id,
        linkedProjectId: null,
        reason: "missing_project",
      });
      continue;
    }

    enquiry.files.forEach((raw, fileOrdinal) => {
      const file = asRecord(raw);
      const evidence = file ? fileEvidence(enquiry, file, fileOrdinal) : null;
      if (!evidence) return;
      const problem = evidenceProblem(evidence);
      if (problem) {
        result.ambiguousMatches.push({ ...evidence, reason: problem });
        return;
      }
      if ((referencedPathCounts.get(evidence.storage_path) ?? 0) !== 1) {
        result.ambiguousMatches.push({ ...evidence, reason: "storage_path_referenced_more_than_once" });
        return;
      }
      const storedObject = objectsByPath.get(evidence.storage_path);
      if (!storedObject) {
        result.missingObjects.push(evidence);
        return;
      }
      if (storedObject.sizeBytes !== null && storedObject.sizeBytes !== evidence.size_bytes) {
        result.ambiguousMatches.push({ ...evidence, reason: "storage_object_size_mismatch" });
        return;
      }

      const existingRows = existingByPath.get(evidence.storage_path) ?? [];
      if (existingRows.length === 1 && isExactAttachment(existingRows[0]!, evidence)) {
        result.alreadyLinkedFiles.push(evidence);
        return;
      }
      if (existingRows.length > 0) {
        const linkedProjectId = existingRows[0]?.project_id ?? null;
        result.ambiguousMatches.push({ ...evidence, reason: "existing_attachment_conflicts" });
        if (linkedProjectId !== enquiry.project_id) {
          result.projectsMergedOrChanged.push({
            enquiryRequestId: enquiry.id,
            submissionId: enquiry.submission_id,
            recordedProjectId: enquiry.project_id,
            linkedProjectId,
            reason: "project_link_changed",
          });
        }
        return;
      }
      result.candidates.push(evidence);
    });
  }

  const referencedPaths = new Set(referencedPathCounts.keys());
  result.unmatchedObjects = input.storedObjects.filter((object) => !referencedPaths.has(object.path));
  return result;
}
