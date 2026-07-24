import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  validateEnquiryAttachmentDescriptors,
  type EnquiryAttachmentDescriptor,
} from '@/lib/enquiryAttachmentPolicy';
import {
  isAllowedMarketingOrigin,
  isUuid,
  marketingAbuseKey,
  readBoundedJson,
} from '@/lib/marketingPublicRequest';
import { getServiceSupabase } from '@/lib/supabaseService';

const BUCKET = 'enquiry-attachments';
const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_NAME_LENGTH = 160;

type IncomingFile = { name?: unknown; size?: unknown; type?: unknown };

function safeDisplayName(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'file';
  return base.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, MAX_NAME_LENGTH) || 'file';
}

function safePathName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, MAX_NAME_LENGTH) || 'file';
}

function normalizeFiles(value: unknown): EnquiryAttachmentDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const file = entry as IncomingFile;
    return {
      name: safeDisplayName(typeof file?.name === 'string' ? file.name : ''),
      size: typeof file?.size === 'number' && Number.isFinite(file.size) ? file.size : 0,
      type: typeof file?.type === 'string' ? file.type.trim().toLowerCase() : '',
    };
  });
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function POST(req: Request) {
  if (!isAllowedMarketingOrigin(req)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await readBoundedJson(req, MAX_REQUEST_BYTES).catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }

  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : '';
  if (!isUuid(submissionId)) {
    return NextResponse.json({ ok: false, error: 'Invalid submission ID' }, { status: 422 });
  }

  const incomingFiles = normalizeFiles(body.files);
  if (!incomingFiles.length) {
    return NextResponse.json({ ok: false, error: 'No files' }, { status: 422 });
  }
  const fileError = validateEnquiryAttachmentDescriptors(incomingFiles);
  if (fileError) {
    return NextResponse.json({ ok: false, error: fileError }, { status: 422 });
  }

  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch {
    return NextResponse.json({ ok: false, error: 'Storage unavailable' }, { status: 503 });
  }

  const uploadSessionToken = randomBytes(32).toString('base64url');
  let abuseKey: string;
  try {
    abuseKey = marketingAbuseKey(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'Storage unavailable' }, { status: 503 });
  }
  const expectedFiles = incomingFiles.map((file, index) => ({
    ...file,
    path: `pending/${submissionId}/${index}-${safePathName(file.name)}`,
  }));

  const { data: prepared, error: prepareError } = await supabase.rpc(
    'marketing_enquiry_prepare_upload_session',
    {
      p_submission_id: submissionId,
      p_token_hash: sha256(uploadSessionToken),
      p_ip_key_hash: abuseKey,
      p_files: expectedFiles,
      p_max_hits: 5,
      p_window_seconds: 600,
    },
  );
  if (prepareError) {
    return NextResponse.json({ ok: false, error: 'Storage unavailable' }, { status: 503 });
  }

  const preparedRow = Array.isArray(prepared) ? prepared[0] : prepared;
  if (preparedRow?.allowed !== true) {
    const retryAfter = Math.max(1, Number(preparedRow?.retry_after_seconds) || 60);
    return NextResponse.json(
      { ok: false, error: 'Too many upload requests. Please try later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfter)) } },
    );
  }

  const uploads: Array<{ path: string; signedUrl: string; token: string; name: string }> = [];
  for (const file of expectedFiles) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(file.path);
    if (error || !data?.signedUrl || !data?.token) {
      return NextResponse.json({ ok: false, error: 'Failed to prepare upload' }, { status: 503 });
    }
    uploads.push({
      path: file.path,
      signedUrl: data.signedUrl,
      token: data.token,
      name: file.name,
    });
  }

  return NextResponse.json({
    ok: true,
    submissionId,
    uploadSessionToken,
    expiresAt: preparedRow.expires_at ?? null,
    uploads,
  });
}
