export type EnquiryAttachmentPayload = {
  path?: string;
  name: string;
  size: number;
  type: string;
};

export const ENQUIRY_ATTACHMENT_LIMITS = {
  maxFiles: 8,
  maxFileBytes: 20 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
} as const;

export function validateEnquiryAttachments(files: File[]): string | null {
  if (files.length > ENQUIRY_ATTACHMENT_LIMITS.maxFiles) {
    return `Add no more than ${ENQUIRY_ATTACHMENT_LIMITS.maxFiles} files.`;
  }

  if (files.some((file) => file.size <= 0 || file.size > ENQUIRY_ATTACHMENT_LIMITS.maxFileBytes)) {
    return 'Each file must be larger than 0 bytes and no larger than 20 MB.';
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > ENQUIRY_ATTACHMENT_LIMITS.maxTotalBytes) {
    return 'Attachments must be no larger than 20 MB in total.';
  }

  return null;
}

// Uploads directly to the existing private enquiry bucket with short-lived
// signed URLs. Metadata-only fallback keeps the enquiry submittable when local
// storage configuration is unavailable or an upload fails.
export async function uploadEnquiryAttachments(files: File[]): Promise<EnquiryAttachmentPayload[]> {
  const metaOnly: EnquiryAttachmentPayload[] = files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
  }));
  if (!files.length) return [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return metaOnly;

  try {
    const signResponse = await fetch('/api/enquiry/attachments/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: metaOnly }),
    });
    if (!signResponse.ok) return metaOnly;

    const signPayload = await signResponse.json().catch(() => null);
    const uploads = Array.isArray(signPayload?.uploads) ? signPayload.uploads : [];
    if (uploads.length !== files.length) return metaOnly;

    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(supabaseUrl, supabaseAnonKey);

    return await Promise.all(
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
  } catch {
    return metaOnly;
  }
}
