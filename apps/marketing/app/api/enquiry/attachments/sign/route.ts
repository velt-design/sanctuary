import 'server-only';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Mint short-lived signed upload URLs so professional enquiry attachments can
// be uploaded directly from the browser to Supabase Storage, bypassing the
// serverless request-body limit. The bytes never flow through this function.

const BUCKET = 'enquiry-attachments';
const MAX_ATTACHMENTS = 8;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB across all files
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_NAME_LENGTH = 160;

type IncomingFile = { name?: unknown; size?: unknown; type?: unknown };

// Mirrors the inline service client in ../../route.ts (this route folder keeps
// its Supabase client local rather than importing the shared lib).
function serviceSupabaseUrl(): string {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const serviceUrl = process.env.SUPABASE_URL?.trim() || '';
  if (publicUrl) return publicUrl;
  if (serviceUrl) return serviceUrl;
  throw new Error('SUPABASE_URL is not set');
}

function getServiceSupabase(): SupabaseClient {
  const url = serviceSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'file';
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.slice(0, MAX_NAME_LENGTH) || 'file';
}

export async function POST(req: Request) {
  let body: { files?: IncomingFile[] } | null = null;
  try {
    body = (await req.json()) as { files?: IncomingFile[] };
  } catch {
    body = null;
  }

  const files = Array.isArray(body?.files) ? (body!.files as IncomingFile[]) : [];
  if (!files.length) {
    return NextResponse.json({ ok: false, error: 'No files' }, { status: 422 });
  }
  if (files.length > MAX_ATTACHMENTS) {
    return NextResponse.json({ ok: false, error: 'Too many files' }, { status: 422 });
  }

  let totalBytes = 0;
  for (const file of files) {
    const size = typeof file?.size === 'number' && Number.isFinite(file.size) ? file.size : 0;
    if (size <= 0 || size > MAX_FILE_BYTES) {
      return NextResponse.json({ ok: false, error: 'Invalid file size' }, { status: 422 });
    }
    totalBytes += size;
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json({ ok: false, error: 'Attachments exceed 20MB total' }, { status: 422 });
  }

  let supabase: SupabaseClient;
  try {
    supabase = getServiceSupabase();
  } catch {
    return NextResponse.json({ ok: false, error: 'Storage unavailable' }, { status: 503 });
  }

  const submissionId = randomUUID();
  const uploads: Array<{ path: string; signedUrl: string; token: string; name: string }> = [];

  for (let index = 0; index < files.length; index++) {
    const rawName = typeof files[index]?.name === 'string' ? (files[index].name as string) : `file-${index}`;
    const path = `pending/${submissionId}/${index}-${safeName(rawName)}`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data?.signedUrl || !data?.token) {
      return NextResponse.json({ ok: false, error: 'Failed to prepare upload' }, { status: 500 });
    }
    uploads.push({ path: data.path ?? path, signedUrl: data.signedUrl, token: data.token, name: rawName });
  }

  return NextResponse.json({ ok: true, submissionId, uploads });
}
