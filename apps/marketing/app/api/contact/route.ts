// app/api/contact/route.ts
import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { getEmailDeliveryFailureSummary, sendEmail } from '@/lib/email/sendEmail';
import {
  getMarketingClientIp,
  isAllowedMarketingOrigin,
  marketingAbuseKey,
  readBoundedJson,
  takeMarketingRateLimit,
} from '@/lib/marketingPublicRequest';
import { getServiceSupabase } from '@/lib/supabaseService';
import {
  isPlausibleEnquiryPhone,
  isValidEnquiryEmail,
} from '../../../lib/enquiryContactValidation';

const MAX_MESSAGE_LENGTH = 4000;
const MAX_FIELD_LENGTH = 400;
const MAX_EVENT_ID_LENGTH = 128;
const MAX_BODY_BYTES = 128 * 1024;

const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  const parts = header.split(';');
  for (const part of parts) {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    const name = (rawName || '').trim();
    if (!name) continue;
    const rawValue = rawValueParts.join('=');
    if (!rawValue) {
      cookies[name] = '';
      continue;
    }
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }
  return cookies;
}

async function sendMetaLeadEvent(params: {
  req: Request;
  email: string;
  eventId: string;
  ip: string;
  enquiryType?: string;
  marketingConsent: boolean;
}): Promise<void> {
  if (!params.marketingConsent) return;
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN;
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  if (!accessToken || !pixelId) return;

  const apiVersion = process.env.META_GRAPH_API_VERSION || 'v20.0';
  const url = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;

  const cookies = parseCookies(params.req.headers.get('cookie'));
  const userAgent = params.req.headers.get('user-agent') || undefined;
  const referer = params.req.headers.get('referer') || params.req.headers.get('referrer') || undefined;

  const normalizedEmail = normalizeEmail(params.email);
  const userData: Record<string, unknown> = {};
  if (normalizedEmail) userData.em = [sha256(normalizedEmail)];
  if (params.ip && params.ip !== 'unknown') userData.client_ip_address = params.ip;
  if (userAgent) userData.client_user_agent = userAgent;
  if (cookies._fbp) userData.fbp = cookies._fbp;
  if (cookies._fbc) userData.fbc = cookies._fbc;

  const event: Record<string, unknown> = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_id: params.eventId,
    user_data: userData,
  };
  if (referer) event.event_source_url = referer;

  const customData: Record<string, unknown> = {};
  if (params.enquiryType) customData.content_name = `Website enquiry: ${params.enquiryType}`;
  if (Object.keys(customData).length) event.custom_data = customData;

  const payload: Record<string, unknown> = { data: [event] };
  const testCode = process.env.META_CAPI_TEST_EVENT_CODE;
  if (testCode) payload.test_event_code = testCode;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn('Meta CAPI error', res.status, await res.text());
    }
  } catch (e) {
    console.warn('Meta CAPI exception', e);
  }
}

export async function POST(req: Request) {
  if (!isAllowedMarketingOrigin(req)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const ct = (req.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) {
    return NextResponse.json(
      { ok: false, error: 'Use the current enquiry form for file uploads.' },
      { status: 415 },
    );
  }
  const data = await readBoundedJson(req, MAX_BODY_BYTES).catch(() => null);

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
  const phone = sanitizeSingleLine(getField('phone'), MAX_FIELD_LENGTH);
  const message = sanitizeMultiline(getField('message'), MAX_MESSAGE_LENGTH);
  if (!name || !email || !phone) {
    return NextResponse.json({ ok: false, error: 'Name, email and phone are required' }, { status: 422 });
  }
  if (!isValidEnquiryEmail(email)) {
    return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 422 });
  }
  if (!isPlausibleEnquiryPhone(phone)) {
    return NextResponse.json({ ok: false, error: 'Invalid phone' }, { status: 422 });
  }

  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch {
    return NextResponse.json({ ok: false, error: 'Contact service unavailable' }, { status: 503 });
  }
  let abuseKey: string;
  try {
    abuseKey = marketingAbuseKey(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'Contact service unavailable' }, { status: 503 });
  }
  const rateLimit = await takeMarketingRateLimit(supabase, {
    scope: 'legacy_contact_submit',
    keyHash: abuseKey,
    maxHits: 5,
    windowSeconds: 600,
  });
  if (!rateLimit.ok) {
    if (rateLimit.unavailable) {
      return NextResponse.json({ ok: false, error: 'Contact service unavailable' }, { status: 503 });
    }
    return NextResponse.json(
      { ok: false, error: 'Too many submissions. Please try later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }
  const ip = getMarketingClientIp(req);

  // Prepare email content
  const fields = {
    name,
    email,
    phone,
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
    event_id: sanitizeSingleLine(getField('event_id'), MAX_EVENT_ID_LENGTH) || randomUUID(),
    marketing_consent: ['true', '1', 'yes'].includes(getField('marketing_consent').trim().toLowerCase()),
  };

  const subject = `[Website enquiry] ${fields.enquiry_type || 'General'} – ${fields.name}`;
  const lines = [
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    `Phone: ${fields.phone}`,
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

  // Request-bound compatibility path; JOB-07 moves this send behind the durable worker.
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
  if (RESEND_API_KEY) {
    try {
      await sendEmail({
        from: EMAIL_FROM,
        to: [targetEmail],
        replyTo: fields.email,
        subject,
        html,
        idempotencyKey: `website-contact/${fields.event_id}`,
      });
    } catch (error) {
      console.warn('Contact email delivery failed', getEmailDeliveryFailureSummary(error));
    }
  } else {
    console.info('Contact email not dispatched', { code: 'EMAIL_PROVIDER_CONFIGURATION_MISSING' });
  }

  // Slack notification (optional)
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
  if (SLACK_WEBHOOK_URL) {
    try {
      const text = escapeForHtml(
        `New website enquiry\n*Name:* ${fields.name}\n*Email:* ${fields.email}\n*Phone:* ${fields.phone}${
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

  await sendMetaLeadEvent({
    req,
    email: fields.email,
    eventId: fields.event_id,
    ip,
    enquiryType: fields.enquiry_type || undefined,
    marketingConsent: fields.marketing_consent,
  });

  return NextResponse.json({ ok: true });
}
