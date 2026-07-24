import {
  ENQUIRY_ATTACHMENT_ACCEPT,
  ENQUIRY_ATTACHMENT_LIMITS,
  validateEnquiryAttachmentDescriptors,
  type EnquiryAttachmentDescriptor,
} from './enquiryAttachmentPolicy';

type EnquiryAttachmentPayload = EnquiryAttachmentDescriptor;
export { ENQUIRY_ATTACHMENT_ACCEPT, ENQUIRY_ATTACHMENT_LIMITS };

type EnquiryAttachmentUploadResult = {
  files: EnquiryAttachmentPayload[];
  uploadSessionToken: string | null;
};

export function validateEnquiryAttachments(files: File[]): string | null {
  return validateEnquiryAttachmentDescriptors(files);
}

export function createEnquirySubmissionId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('A secure browser is required to submit this enquiry.');
  }
  return globalThis.crypto.randomUUID();
}

// Uploads directly to the existing private enquiry bucket with short-lived
// signed URLs. Metadata-only fallback keeps the enquiry submittable when local
// storage configuration is unavailable or an upload fails.
export async function uploadEnquiryAttachments(
  files: File[],
  submissionId: string,
): Promise<EnquiryAttachmentUploadResult> {
  const metaOnly: EnquiryAttachmentPayload[] = files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
  }));
  const validationError = validateEnquiryAttachmentDescriptors(metaOnly);
  if (validationError) throw new Error(validationError);
  if (!files.length) return { files: [], uploadSessionToken: null };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return { files: metaOnly, uploadSessionToken: null };

  try {
    const signResponse = await fetch('/api/enquiry/attachments/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, files: metaOnly }),
    });
    if (!signResponse.ok) return { files: metaOnly, uploadSessionToken: null };

    const signPayload = await signResponse.json().catch(() => null);
    const uploads = Array.isArray(signPayload?.uploads) ? signPayload.uploads : [];
    const uploadSessionToken =
      typeof signPayload?.uploadSessionToken === 'string' ? signPayload.uploadSessionToken : null;
    if (uploads.length !== files.length || !uploadSessionToken) {
      return { files: metaOnly, uploadSessionToken: null };
    }

    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(supabaseUrl, supabaseAnonKey);

    const uploadedFiles = await Promise.all(
      files.map(async (file, index): Promise<EnquiryAttachmentPayload> => {
        const upload = uploads[index];
        try {
          const { error } = await client.storage
            .from('enquiry-attachments')
            .uploadToSignedUrl(upload.path, upload.token, file, {
              contentType: file.type || undefined,
            });
          if (error) return metaOnly[index];
          return { ...metaOnly[index], path: upload.path };
        } catch {
          return metaOnly[index];
        }
      }),
    );
    return { files: uploadedFiles, uploadSessionToken };
  } catch {
    return { files: metaOnly, uploadSessionToken: null };
  }
}
