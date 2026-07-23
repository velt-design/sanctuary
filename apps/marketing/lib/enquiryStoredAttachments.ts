import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  sniffEnquiryAttachmentType,
  validateEnquiryAttachmentDescriptors,
  type EnquiryAttachmentDescriptor,
} from './enquiryAttachmentPolicy';

const BUCKET = 'enquiry-attachments';
const MAX_NAME_LENGTH = 160;

export type VerifiedStoredAttachment = {
  path: string;
  filename: string;
  type: string;
  size: number;
  content: Buffer;
};

export class EnquiryAttachmentVerificationError extends Error {
  constructor(public readonly code: 'INVALID_ATTACHMENTS' | 'ATTACHMENT_UNAVAILABLE') {
    super(code);
    this.name = 'EnquiryAttachmentVerificationError';
  }
}

function safeName(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  const base = text.split(/[\\/]/).pop() || 'file';
  return base.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, MAX_NAME_LENGTH) || 'file';
}

export function normalizeEnquiryFiles(value: unknown): EnquiryAttachmentDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const row = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const path = typeof row.path === 'string' ? row.path.trim() : '';
    return {
      ...(path ? { path } : {}),
      name: safeName(row.name),
      size: typeof row.size === 'number' && Number.isFinite(row.size) ? row.size : 0,
      type: typeof row.type === 'string' ? row.type.trim().toLowerCase() : '',
    };
  });
}

export async function verifyStoredEnquiryAttachments(
  supabase: SupabaseClient,
  params: {
    files: EnquiryAttachmentDescriptor[];
    submissionId: string;
    uploadSessionToken: string;
  },
): Promise<VerifiedStoredAttachment[]> {
  const validationError = validateEnquiryAttachmentDescriptors(params.files);
  if (validationError) throw new EnquiryAttachmentVerificationError('INVALID_ATTACHMENTS');

  const storedFiles = params.files.filter((file) => Boolean(file.path));
  if (!storedFiles.length) return [];
  if (!params.uploadSessionToken) throw new EnquiryAttachmentVerificationError('INVALID_ATTACHMENTS');

  const pathPrefix = `pending/${params.submissionId}/`;
  if (storedFiles.some((file) => !file.path?.startsWith(pathPrefix))) {
    throw new EnquiryAttachmentVerificationError('INVALID_ATTACHMENTS');
  }

  const verified: VerifiedStoredAttachment[] = [];
  for (const file of storedFiles) {
    const path = file.path!;
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) throw new EnquiryAttachmentVerificationError('ATTACHMENT_UNAVAILABLE');

    let content: Buffer;
    try {
      content = Buffer.from(await data.arrayBuffer());
    } catch {
      throw new EnquiryAttachmentVerificationError('ATTACHMENT_UNAVAILABLE');
    }
    if (content.byteLength !== file.size || sniffEnquiryAttachmentType(content) !== file.type) {
      throw new EnquiryAttachmentVerificationError('INVALID_ATTACHMENTS');
    }
    verified.push({
      path,
      filename: file.name,
      type: file.type,
      size: file.size,
      content,
    });
  }
  return verified;
}

