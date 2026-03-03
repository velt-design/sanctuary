import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_REPORT_SIZE_BYTES = 64 * 1024;
const MAX_LOG_LENGTH = 4_000;

function clamp(text: string, max = MAX_LOG_LENGTH): string {
  return text.length > max ? text.slice(0, max) : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeJsonValue(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'string') return clamp(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((entry) => safeJsonValue(entry));
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[clamp(String(key), 120)] = safeJsonValue(entry);
    }
    return out;
  }
  return clamp(String(value));
}

async function parseBody(req: Request): Promise<Record<string, unknown> | null> {
  const raw = await req.text();
  if (!raw) return null;
  if (raw.length > MAX_REPORT_SIZE_BYTES) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown> | null = null;
  try {
    body = await parseBody(req);
  } catch {
    body = null;
  }

  const report = body
    ? safeJsonValue(body)
    : { message: 'invalid_or_empty_csp_report_payload' };

  // Best-effort structured log for monitoring/report aggregation.
  console.warn('CSP_REPORT', {
    report,
    userAgent: clamp(req.headers.get('user-agent') || ''),
    contentType: clamp(req.headers.get('content-type') || ''),
    referer: clamp(req.headers.get('referer') || ''),
  });

  return new NextResponse(null, { status: 204 });
}
