// app/api/contact/route.ts
import { NextResponse } from 'next/server';

// Very lightweight, in-memory rate limiter (best-effort; per-instance)
type Hit = { t: number; n: number };
const hits = new Map<string, Hit>();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_IN_WINDOW = 5; // 5 submissions per 10 minutes per IP
const MAX_MESSAGE_LENGTH = 4000;
const MAX_FIELD_LENGTH = 400;
const MAX_ATTACHMENTS = 8; // cap number of files we forward
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB across all files

const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

type UploadedAttachment = {
  filename: string;
  content: string; // base64
};

function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  // In non-production Vercel environments (preview/dev), relax origin checks
  // so that preview URLs and local testing don't get blocked by CORS.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return true;
  }
  try {
    const { hostname } = new URL(origin);
    const host = hostname.toLowerCase();

    // Always allow Vercel-hosted URLs (both preview and production on *.vercel.app)
    // so that branch/preview deployments can post to this API route without 403s.
    if (host.endsWith('.vercel.app')) {
      return true;
    }

    // Core allowed hosts for production + local dev
    const baseAllowed = new Set([
      'localhost',
      '127.0.0.1',
      '::1',
      'www.sanctuarypergolas.co.nz',
      'sanctuarypergolas.co.nz',
    ]);

    // Allow additional hosts from environment (e.g. staging/preview domains)
    const envHosts = [
      process.env.VERCEL_URL,
      process.env.NEXT_PUBLIC_SITE_HOST,
      ...(process.env.ALLOWED_ORIGINS || '').split(','),
    ]
      .map(h => (h || '').trim().toLowerCase())
      .filter(Boolean);

    envHosts.forEach(h => baseAllowed.add(h));

    if (baseAllowed.has(host)) {
      return true;
    }

    // Optionally allow subdomains of the primary site (e.g. preview.sanctuarypergolas.co.nz)
    if (host.endsWith('.sanctuarypergolas.co.nz')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function getClientIp(req: Request): string {
  try {
    const xf = req.headers.get('x-forwarded-for') || '';
    const ip = xf.split(',')[0].trim() || req.headers.get('x-real-ip') || '';
    return String(ip || 'unknown');
  } catch {
    return 'unknown';
  }
}

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function sanitizeSingleLine(value: string, max: number): string {
  const cleaned = value.replace(/[\r\n]+/g, ' ').replace(CONTROL_CHARS_REGEX, ' ').trim();
  return clamp(cleaned, max);
}

function sanitizeMultiline(value: string, max: number): string {
  const cleaned = value.replace(CONTROL_CHARS_REGEX, ' ').trim();
  return clamp(cleaned, max);
}

function escapeForHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function extractAttachmentsFromFormData(fd: FormData): Promise<UploadedAttachment[]> {
  const entries = fd.getAll('pro_attachments');
  const files = entries.filter((entry): entry is File => entry instanceof File);
  if (!files.length) return [];

  const attachments: UploadedAttachment[] = [];
  let totalBytes = 0;

  for (const file of files) {
    if (attachments.length >= MAX_ATTACHMENTS) {
      break;
    }
    try {
      const size = typeof file.size === 'number' ? file.size : 0;
      if (!file.name || size <= 0) {
        continue;
      }
      // Enforce a total size cap across all attachments.
      if (totalBytes + size > MAX_TOTAL_ATTACHMENT_BYTES) {
        continue;
      }
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      attachments.push({
        filename: file.name,
        content: base64,
      });
      totalBytes += size;
    } catch {
      // Ignore individual file failures; continue with others.
    }
  }

  return attachments;
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // Accept both JSON and form submissions
  const ct = (req.headers.get('content-type') || '').toLowerCase();
  let data: Record<string, unknown> | null = null;
  let attachments: UploadedAttachment[] = [];
  try {
    if (ct.includes('application/json')) {
      data = await req.json();
    } else {
      const fd = await req.formData();
      attachments = await extractAttachmentsFromFormData(fd);
      data = Object.fromEntries(fd.entries());
    }
  } catch {
    data = null;
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }

  const formData = data as Record<string, unknown>;
  const getField = (key: string): string => {
    const value = formData[key];
    if (typeof value === 'string') return value;
    if (value == null) return '';
    return String(value);
  };

  // Honeypot — common bot field names
  const honeypot = `${getField('website') || getField('hp')}`.trim();
  if (honeypot) {
    // Pretend success to not tip off bots
    return NextResponse.json({ ok: true });
  }

  // Minimal validation
  const name = sanitizeSingleLine(getField('name'), MAX_FIELD_LENGTH);
  const email = sanitizeSingleLine(getField('email'), MAX_FIELD_LENGTH);
  const message = sanitizeMultiline(getField('message'), MAX_MESSAGE_LENGTH);
  if (!name || !email) {
    return NextResponse.json({ ok: false, error: 'Name and email are required' }, { status: 422 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 422 });
  }

  // Basic rate limit by IP
  const ip = getClientIp(req);
  const now = Date.now();
  const prev = hits.get(ip);
  if (!prev || now - prev.t > WINDOW_MS) {
    hits.set(ip, { t: now, n: 1 });
  } else if (prev.n >= MAX_IN_WINDOW) {
    return NextResponse.json({ ok: false, error: 'Too many submissions. Please try later.' }, { status: 429 });
  } else {
    prev.n += 1;
    prev.t = now;
    hits.set(ip, prev);
  }

  // Prepare email content
  const fields = {
    name,
    email,
    suburb: sanitizeSingleLine(getField('suburb'), MAX_FIELD_LENGTH),
    enquiry_type: sanitizeSingleLine(getField('enquiry_type'), MAX_FIELD_LENGTH),
    width_m: sanitizeSingleLine(getField('width_m'), MAX_FIELD_LENGTH),
    length_m: sanitizeSingleLine(getField('length_m'), MAX_FIELD_LENGTH),
    height_m: sanitizeSingleLine(getField('height_m'), MAX_FIELD_LENGTH),
    style: sanitizeSingleLine(getField('style'), MAX_FIELD_LENGTH),
    roof: sanitizeSingleLine(getField('roof'), MAX_FIELD_LENGTH),
    addons: sanitizeSingleLine(getField('addons'), MAX_FIELD_LENGTH),
    message,
    is_homeowner: getField('is_homeowner'),
    is_professional: getField('is_professional'),
    company: sanitizeSingleLine(getField('company'), MAX_FIELD_LENGTH),
    attachments: sanitizeSingleLine(getField('attachments'), MAX_FIELD_LENGTH),
  };

  const subject = `[Website enquiry] ${fields.enquiry_type || 'General'} – ${fields.name}`;
  const lines = [
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    fields.company ? `Company: ${fields.company}` : null,
    fields.suburb ? `Suburb: ${fields.suburb}` : null,
    fields.enquiry_type ? `Enquiry: ${fields.enquiry_type}` : null,
    '',
    `Size (m): ${[fields.width_m, fields.length_m, fields.height_m].filter(Boolean).join(' × ')}`,
    fields.style ? `Style: ${fields.style}` : null,
    fields.roof ? `Roof: ${fields.roof}` : null,
    fields.addons ? `Addons: ${fields.addons}` : null,
    fields.attachments ? `Attachments: ${fields.attachments}` : null,
    '',
    'Message:',
    fields.message || '(none)'
  ].filter(Boolean) as string[];

  const html = `<pre style="font: 14px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberations Mono, monospace; white-space: pre-wrap">${
    escapeForHtml(lines.map(l => String(l)).join('\n'))
  }</pre>`;

  // Send via Resend if configured; otherwise log
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_TO_RESIDENTIAL = process.env.EMAIL_TO_RESIDENTIAL || 'info@sanctuarypergolas.co.nz';
  const EMAIL_TO_COMMERCIAL = process.env.EMAIL_TO_COMMERCIAL || 'jordan@sanctuarypergolas.co.nz';
  const EMAIL_TO_PROFESSIONAL = process.env.EMAIL_TO_PROFESSIONAL || 'jordan@sanctuarypergolas.co.nz';
  const enquiryType = (fields.enquiry_type || '').toString().toLowerCase();
  const targetEmail =
    enquiryType === 'commercial'
      ? EMAIL_TO_COMMERCIAL
      : enquiryType === 'professional'
        ? EMAIL_TO_PROFESSIONAL
        : EMAIL_TO_RESIDENTIAL;
  const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  let delivered = false;
  if (RESEND_API_KEY) {
    try {
      const resendPayload: Record<string, unknown> = {
        from: EMAIL_FROM,
        to: [targetEmail],
        reply_to: fields.email,
        subject,
        html,
      };
      if (attachments.length) {
        resendPayload.attachments = attachments;
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resendPayload),
      });
      if (res.ok) delivered = true;
      else console.warn('Resend error', await res.text());
    } catch (e) {
      console.warn('Resend exception', e);
    }
  }

  // Slack notification (optional)
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
  if (SLACK_WEBHOOK_URL) {
    try {
      const text = escapeForHtml(
        `New website enquiry\n*Name:* ${fields.name}\n*Email:* ${fields.email}${
          fields.company ? `\n*Company:* ${fields.company}` : ''
        }${fields.suburb ? `\n*Suburb:* ${fields.suburb}` : ''}\n*Enquiry:* ${
          fields.enquiry_type || 'General'
        }\n*Size:* ${[fields.width_m, fields.length_m, fields.height_m].filter(Boolean).join(' × ')}\n*Style:* ${
          fields.style || '-'
        }\n*Roof:* ${fields.roof || '-'}\n*Addons:* ${fields.addons || '-'}${
          fields.attachments ? `\n*Attachments:* ${fields.attachments}` : ''
        }\n*Message:* ${
          fields.message || '(none)'
        }\n`
      );
      await fetch(SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch (e) {
      console.warn('Slack webhook failed', e);
    }
  }

  // Google Sheets (Apps Script) webhook (optional) — expects JSON body
  const SHEETS_WEBHOOK = process.env.LEADS_SHEET_WEBHOOK_URL;
  if (SHEETS_WEBHOOK) {
    try {
      await fetch(SHEETS_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ts: new Date().toISOString(),
          subject,
          ...fields,
          ip,
        }),
      });
    } catch (e) {
      console.warn('Sheets webhook failed', e);
    }
  }

  if (!delivered) {
    console.log('Contact submission (no email provider configured):', { subject, ...fields });
  }

  return NextResponse.json({ ok: true });
}
