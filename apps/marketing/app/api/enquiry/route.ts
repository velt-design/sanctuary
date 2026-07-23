import 'server-only';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  buildEnquiryDraftEstimateRow,
  buildEnquiryPricingSnapshot,
} from '../../../lib/enquiryPricingSnapshot';
import {
  normalizeMarketingAttributionInput,
  recordMarketingConversionEvent,
} from '../../../../../apps/portal/lib/marketingAttribution/server';
import { sendCustomerAutoresponder } from '@/lib/email/sendCustomerAutoresponder';
import { getEmailDeliveryFailureSummary } from '@/lib/email/sendEmail';
import {
  EMAIL_WEBSITE_AUTORESPONDER_RES_V1,
  EMAIL_WEBSITE_AUTORESPONDER_COM_V1,
  EMAIL_WEBSITE_AUTORESPONDER_PRO_V1,
  customerEstimateSubject,
} from '@/lib/sharedEmails';
import { getCallWindowText } from '@/emails/utils/callWindow';
import type { EnquiryPayload, Professional, ResidentialOrCommercial } from '@/emails/types';

type Hit = { t: number; n: number };
const hits = new Map<string, Hit>();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_IN_WINDOW = 6; // submissions per window per IP

const MAX_FIELD_LENGTH = 400;
const MAX_MESSAGE_LENGTH = 4000;

const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

let cachedServiceClient: SupabaseClient | null = null;
let cachedServiceUrl = '';
let cachedServiceKey = '';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new Error(`${name} is not set`);
}

function serviceSupabaseUrl(): string {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const serviceUrl = process.env.SUPABASE_URL?.trim() || '';
  if (publicUrl && serviceUrl && publicUrl !== serviceUrl) {
    console.error('[supabase] URL mismatch', { publicUrl, serviceUrl });
  }
  if (publicUrl) return publicUrl;
  if (serviceUrl) return serviceUrl;
  return requiredEnv('SUPABASE_URL');
}

function getServiceSupabase(): SupabaseClient {
  const url = serviceSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  if (cachedServiceClient && cachedServiceUrl === url && cachedServiceKey === key) return cachedServiceClient;
  cachedServiceUrl = url;
  cachedServiceKey = key;
  cachedServiceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cachedServiceClient;
}

function getClientIp(req: Request): string {
  try {
    const xf = req.headers.get('x-forwarded-for') || '';
    const ip = xf.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isMissingColumnError(error: unknown): boolean {
  const e = error as any;
  const code = typeof e?.code === 'string' ? e.code : '';
  const message = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
  return code === '42703' || code === 'PGRST204' || (message.includes('column') && message.includes('does not exist'));
}

function maybeParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v.trim() : String(v ?? '').trim()))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function toTitleCase(value: string): string {
  const v = value.trim();
  if (!v) return '';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function formatStyleLabel(styleRaw: string): string {
  const s = String(styleRaw ?? '').trim().toLowerCase();
  if (!s) return '';
  if (s.includes('gable')) return 'Gable';
  if (s.includes('hip')) return 'Hip';
  if (s.includes('perimeter') || s.includes('box')) return 'Perimeter';
  return 'Pitched';
}

function formatRoofLabel(roofMaterials: string[]): string {
  const mats = roofMaterials.map((m) => String(m ?? '').trim().toLowerCase()).filter(Boolean);
  if (!mats.length) return 'Not selected';
  const hasAcrylic = mats.includes('acrylic');
  const hasTimber = mats.includes('timber');
  if (hasAcrylic && hasTimber) return 'Both';
  if (hasTimber) return 'Timber';
  return 'Acrylic';
}

function addOnLabels(addOns: Record<string, unknown>): string[] {
  const labels: string[] = [];
  if (isTruthy(addOns?.blinds)) labels.push('Blinds');
  if (isTruthy(addOns?.slats)) labels.push('Slats');
  if (isTruthy(addOns?.lighting)) labels.push('Lighting');
  if (isTruthy(addOns?.heating)) labels.push('Heating');
  return labels;
}

function safeJsonPayload(value: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isTruthy(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'y';
  }
  return false;
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const ct = (req.headers.get('content-type') || '').toLowerCase();
  try {
    if (ct.includes('application/json')) {
      return (await req.json()) as Record<string, unknown>;
    }
    if (ct.includes('form')) {
      const fd = await req.formData();
      return Object.fromEntries(fd.entries());
    }
  } catch {
    return null;
  }
  return null;
}

const ENQUIRY_ATTACHMENT_BUCKET = 'enquiry-attachments';
// Below this total, inline the files as email attachments; above it, send
// expiring signed download links instead so the autoresponder stays small.
const ATTACH_INLINE_MAX_BYTES = 8 * 1024 * 1024;
const ATTACHMENT_LINK_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

type ResolvedAttachment = { filename: string; content: string };
type AttachmentLink = { name: string; url: string };

function storedAttachmentEntries(files: unknown): Array<{ path: string; name: string; size: number }> {
  const list = Array.isArray(files) ? files : [];
  const entries: Array<{ path: string; name: string; size: number }> = [];
  for (const file of list) {
    if (!isPlainObject(file)) continue;
    const path = typeof file.path === 'string' ? file.path : '';
    if (!path.startsWith('pending/')) continue;
    const name =
      typeof file.name === 'string' && file.name.trim()
        ? file.name.trim()
        : path.split('/').pop() || 'attachment';
    const size = typeof file.size === 'number' && Number.isFinite(file.size) ? file.size : 0;
    entries.push({ path, name, size });
  }
  return entries;
}

// Best-effort: never throws, so a Storage hiccup cannot block the enquiry or
// its autoresponder. Returns inline attachments when small, else signed links.
async function resolveProfessionalAttachments(
  supabase: SupabaseClient,
  files: unknown,
): Promise<{ attachments: ResolvedAttachment[]; attachmentLinks: AttachmentLink[] }> {
  const entries = storedAttachmentEntries(files);
  if (!entries.length) return { attachments: [], attachmentLinks: [] };

  const totalBytes = entries.reduce((sum, entry) => sum + (entry.size > 0 ? entry.size : 0), 0);

  if (totalBytes > 0 && totalBytes <= ATTACH_INLINE_MAX_BYTES) {
    const attachments: ResolvedAttachment[] = [];
    for (const entry of entries) {
      try {
        const { data, error } = await supabase.storage.from(ENQUIRY_ATTACHMENT_BUCKET).download(entry.path);
        if (error || !data) continue;
        const arrayBuffer = await data.arrayBuffer();
        attachments.push({ filename: entry.name, content: Buffer.from(arrayBuffer).toString('base64') });
      } catch {
        // Skip this file; other attachments and the email still go through.
      }
    }
    if (attachments.length) return { attachments, attachmentLinks: [] };
    // Downloads failed — fall through to links rather than dropping the files.
  }

  const attachmentLinks: AttachmentLink[] = [];
  for (const entry of entries) {
    try {
      const { data, error } = await supabase.storage
        .from(ENQUIRY_ATTACHMENT_BUCKET)
        .createSignedUrl(entry.path, ATTACHMENT_LINK_TTL_SECONDS);
      if (error || !data?.signedUrl) continue;
      attachmentLinks.push({ name: entry.name, url: data.signedUrl });
    } catch {
      // Skip this file.
    }
  }
  return { attachments: [], attachmentLinks };
}

export async function POST(req: Request) {
  let payload: Record<string, unknown> | null = null;
  try {
    payload = await readBody(req);
  } catch {
    payload = null;
  }

  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }

  let rawPayload = safeJsonPayload(payload);
  const getField = (key: string): string => {
    const value = payload?.[key];
    if (typeof value === 'string') return value;
    if (value == null) return '';
    return String(value);
  };

  const honeypot = [
    getField('honeypot'),
    getField('companyWebsite'),
    getField('website'),
    getField('hp'),
  ].join('').trim();
  if (honeypot) {
    return NextResponse.json({ ok: true });
  }

  const enquiryTypeRaw = getField('enquiryType') || getField('enquiry_type');
  const enquiryType = sanitizeSingleLine(enquiryTypeRaw, MAX_FIELD_LENGTH).toLowerCase();
  const name = sanitizeSingleLine(getField('name'), MAX_FIELD_LENGTH);
  const emailRaw = sanitizeSingleLine(getField('email'), MAX_FIELD_LENGTH);
  const email = emailRaw ? emailRaw.toLowerCase() : '';
  const phoneRaw = sanitizeSingleLine(getField('phone'), MAX_FIELD_LENGTH);
  const phone = phoneRaw.replace(/\s+/g, '');

  if (!name) {
    return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 422 });
  }
  if (!phone) {
    return NextResponse.json({ ok: false, error: 'Phone is required' }, { status: 422 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 422 });
  }
  if (!['residential', 'commercial', 'professional'].includes(enquiryType)) {
    return NextResponse.json({ ok: false, error: 'Invalid enquiry type' }, { status: 422 });
  }

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

  const suburb = sanitizeSingleLine(getField('suburb'), MAX_FIELD_LENGTH);
  const message = sanitizeMultiline(getField('message'), MAX_MESSAGE_LENGTH);
  const company = sanitizeSingleLine(getField('company'), MAX_FIELD_LENGTH);
  const page = sanitizeSingleLine(getField('page'), MAX_FIELD_LENGTH);
  const source = sanitizeSingleLine(getField('source'), MAX_FIELD_LENGTH) || 'website';

  const dimsRaw = isPlainObject(payload.dimensions) ? payload.dimensions : {};
  const dims = isPlainObject(dimsRaw) ? dimsRaw : {};
  const widthM = toNumber(dims.widthM ?? (payload as any).widthM ?? (payload as any).width_m ?? (payload as any).width);
  const depthM = toNumber(dims.depthM ?? dims.lengthM ?? (payload as any).depthM ?? (payload as any).depth_m ?? (payload as any).length_m ?? (payload as any).length);
  const heightM = toNumber(dims.heightM ?? (payload as any).heightM ?? (payload as any).height_m ?? (payload as any).height);

  const styleRaw = getField('style');
  const style = sanitizeSingleLine(styleRaw, MAX_FIELD_LENGTH);

  const roofRaw = maybeParseJson(payload.roofMaterials ?? (payload as any).roof_materials ?? (payload as any).roof);
  const roofMaterials = normalizeList(roofRaw).map((v) => v.toLowerCase());

  const addOnsRaw = maybeParseJson(payload.addOns ?? (payload as any).add_ons);
  const addOns = isPlainObject(addOnsRaw) ? addOnsRaw : {};

  const utmRaw = maybeParseJson(payload.utm);
  const utm = isPlainObject(utmRaw) ? utmRaw : {};

  const attributionRaw = maybeParseJson(payload.attribution);
  const attribution = normalizeMarketingAttributionInput(attributionRaw, { utm, page, source });
  rawPayload = safeJsonPayload({ ...payload, attribution });

  const filesRaw = maybeParseJson(payload.files);
  const files = Array.isArray(filesRaw) ? filesRaw : [];

  let supabase: SupabaseClient;
  try {
    supabase = getServiceSupabase();
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || 'Server not configured' }, { status: 500 });
  }

  let contactId: string | null = null;
  let contactRow: any | null = null;

  if (email) {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, email, phone')
      .ilike('email', email)
      .limit(1);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message || 'Failed to find contact' }, { status: 500 });
    }
    contactRow = Array.isArray(data) && data.length ? data[0] : null;
  }

  if (!contactRow && phone) {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, email, phone')
      .eq('phone', phone)
      .limit(1);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message || 'Failed to find contact' }, { status: 500 });
    }
    contactRow = Array.isArray(data) && data.length ? data[0] : null;
    if (!contactRow && phoneRaw && phoneRaw !== phone) {
      const altRes = await supabase
        .from('contacts')
        .select('id, name, email, phone')
        .eq('phone', phoneRaw)
        .limit(1);
      if (!altRes.error && Array.isArray(altRes.data) && altRes.data.length) {
        contactRow = altRes.data[0];
      }
    }
  }

  if (contactRow) {
    contactId = contactRow.id;
    const patch: Record<string, unknown> = {};
    if (!contactRow.name && name) patch.name = name;
    if (!contactRow.email && email) patch.email = email;
    if (!contactRow.phone && phone) patch.phone = phone;

    if (Object.keys(patch).length) {
      const { error } = await supabase.from('contacts').update(patch).eq('id', contactId);
      if (error) {
        if (!isMissingColumnError(error)) {
          return NextResponse.json({ ok: false, error: error.message || 'Failed to update contact' }, { status: 500 });
        }
        console.warn('Skipping contact update because updated_at column is missing.', error);
      }
    }
  } else {
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        name,
        email: email || null,
        phone: phone || null,
      })
      .select('id')
      .single();
    if (error || !data?.id) {
      return NextResponse.json({ ok: false, error: error?.message || 'Failed to create contact' }, { status: 500 });
    }
    contactId = data.id;
  }

  const projectName = `${name} - ${suburb || 'Enquiry'}`.trim();
  const { data: projectRow, error: projectError } = await supabase
    .from('projects')
    .insert({
      contact_id: contactId,
      name: projectName,
      pipeline_stage: 'NEW',
      site_address: suburb || null,
    })
    .select('id')
    .single();

  if (projectError || !projectRow?.id) {
    return NextResponse.json({ ok: false, error: projectError?.message || 'Failed to create project' }, { status: 500 });
  }

  const projectId = projectRow.id;

  const pricing = buildEnquiryPricingSnapshot({
    enquiryType,
    name,
    suburb,
    widthM,
    depthM,
    heightM,
    style,
    roofMaterials,
    addOns,
  });
  const budgets = pricing.budgets;

  const insertBase: Record<string, unknown> = {
    contact_id: contactId,
    project_id: projectId,
    enquiry_type: enquiryType,
    suburb: suburb || null,
    message: message || null,
    width_m: widthM,
    depth_m: depthM,
    height_m: heightM,
    style: style || null,
    roof_materials: roofMaterials.length ? roofMaterials : null,
    add_ons: addOns,
    company: company || null,
    files,
    source,
    page: page || null,
    utm,
    raw_payload: rawPayload,
  };

  const insertWithBudgets: Record<string, unknown> = {
    ...insertBase,
    ...(budgets.baseRange
      ? {
          base_budget_low_inc_gst: budgets.baseRange.lowIncGst,
          base_budget_high_inc_gst: budgets.baseRange.highIncGst,
        }
      : {}),
    ...(budgets.blindsRange
      ? {
          blinds_budget_low_inc_gst: budgets.blindsRange.lowIncGst,
          blinds_budget_high_inc_gst: budgets.blindsRange.highIncGst,
        }
      : {}),
    ...(budgets.budgetBasis ? { budget_basis: budgets.budgetBasis } : {}),
  };

  let insertRes = await supabase.from('enquiry_requests').insert(insertWithBudgets).select('id').single();

  if (insertRes.error && isMissingColumnError(insertRes.error)) {
    // DB schema may not yet include the budget columns; fall back to a schema-compatible insert.
    insertRes = await supabase.from('enquiry_requests').insert(insertBase).select('id').single();
  }

  const enquiryRow = insertRes.data;
  const enquiryError = insertRes.error;

  if (enquiryError || !enquiryRow?.id) {
    return NextResponse.json({ ok: false, error: enquiryError?.message || 'Failed to create enquiry request' }, { status: 500 });
  }

  await recordMarketingConversionEvent({
    type: 'marketing.lead_submitted',
    projectId,
    primaryId: String(enquiryRow.id),
    attribution: {
      ...attribution,
      enquiryRequestId: String(enquiryRow.id),
    },
    payload: {
      enquiryRequestId: String(enquiryRow.id),
      enquiryType,
      source,
      page: page || null,
      baseBudgetLowIncGst: budgets.baseRange?.lowIncGst ?? null,
      baseBudgetHighIncGst: budgets.baseRange?.highIncGst ?? null,
    },
    supabase,
  });

  let designId: string | null = null;
  try {
    const estimateInsert = await supabase
      .from('estimates')
      .insert(
        buildEnquiryDraftEstimateRow({
          projectId,
          createdBy: 'marketing_enquiry',
          name,
          email,
          phoneRaw,
          suburb,
          message,
          enquiryType,
          widthM,
          depthM,
          heightM,
          style,
          roofMaterials,
          addOns,
          pricing,
        }) as any,
      )
      .select('id')
      .single();
    if (!estimateInsert.error && estimateInsert.data?.id) {
      designId = `est_${String(estimateInsert.data.id)}`;
    } else if (estimateInsert.error) {
      console.error('Failed to create enquiry draft design', estimateInsert.error);
    }
  } catch (error) {
    console.error('Failed to create enquiry draft design', error);
  }

  if (email) {
    try {
      const submittedAt = new Date();
      const utmSource =
        typeof (utm as any)?.utm_source === 'string'
          ? String((utm as any).utm_source)
          : typeof (utm as any)?.utmSource === 'string'
            ? String((utm as any).utmSource)
            : undefined;
      const utmMedium =
        typeof (utm as any)?.utm_medium === 'string'
          ? String((utm as any).utm_medium)
          : typeof (utm as any)?.utmMedium === 'string'
            ? String((utm as any).utmMedium)
            : undefined;
      const utmCampaign =
        typeof (utm as any)?.utm_campaign === 'string'
          ? String((utm as any).utm_campaign)
          : typeof (utm as any)?.utmCampaign === 'string'
            ? String((utm as any).utmCampaign)
            : undefined;

      let emailPayload: EnquiryPayload;
      let professionalAttachments: ResolvedAttachment[] = [];

      if (enquiryType === 'professional') {
        const filesCount = Array.isArray(files) ? files.length : 0;
        const resolved = await resolveProfessionalAttachments(supabase, files);
        professionalAttachments = resolved.attachments;
        emailPayload = {
          leadId: enquiryRow.id,
          submittedAt,
          enquiryType: 'professional',
          name,
          email,
          phone: phoneRaw,
          suburb,
          message: message || undefined,
          utmSource,
          utmMedium,
          utmCampaign,
          landingUrl: page || undefined,
          company: company || undefined,
          filesReceivedCount: filesCount,
          ...(resolved.attachmentLinks.length ? { attachmentLinks: resolved.attachmentLinks } : {}),
        } satisfies Professional;
      } else {
        if (!budgets.baseRange) {
          throw new Error('Missing base estimate range for autoresponder.');
        }
        const addons = addOnLabels(addOns);
        const blindsSelected = isTruthy(addOns?.blinds);
        emailPayload = {
          leadId: enquiryRow.id,
          submittedAt,
          enquiryType: enquiryType as ResidentialOrCommercial['enquiryType'],
          name,
          email,
          phone: phoneRaw,
          suburb,
          message: message || undefined,
          utmSource,
          utmMedium,
          utmCampaign,
          landingUrl: page || undefined,
          widthM: Number.isFinite(widthM ?? NaN) ? Number(widthM) : 0,
          depthM: Number.isFinite(depthM ?? NaN) ? Number(depthM) : 0,
          heightM: Number.isFinite(heightM ?? NaN) ? Number(heightM) : 0,
          style: formatStyleLabel(style),
          roof: formatRoofLabel(roofMaterials),
          addons,
          blindsSelected,
          baseRange: budgets.baseRange,
          ...(budgets.blindsRange ? { blindsRange: budgets.blindsRange } : {}),
        } satisfies ResidentialOrCommercial;
      }

      const callWindowText = getCallWindowText(submittedAt);

      const templateId =
        enquiryType === 'commercial'
          ? EMAIL_WEBSITE_AUTORESPONDER_COM_V1
          : enquiryType === 'professional'
            ? EMAIL_WEBSITE_AUTORESPONDER_PRO_V1
            : EMAIL_WEBSITE_AUTORESPONDER_RES_V1;

      const subject =
        enquiryType === 'commercial'
          ? customerEstimateSubject(name, 'commercial')
          : enquiryType === 'professional'
            ? 'Professional enquiry received - next steps'
            : customerEstimateSubject(name, 'residential');

      const emailType =
        enquiryType === 'professional' ? 'WEBSITE_PROFESSIONAL_AUTORESPONDER' : 'WEBSITE_ESTIMATE_AUTORESPONDER';

      const idempotencyKey = `website:autoresponder:${enquiryRow.id}`;
      const supabaseHost = (() => {
        try {
          return new URL(serviceSupabaseUrl()).host;
        } catch {
          return 'unknown';
        }
      })();

      // Store only variables; HTML is rendered from repo code in the portal preview endpoint.
      const variables = safeJsonPayload({ ...(emailPayload as any), callWindowText });

      let sendError: Error | null = null;
      try {
        await sendCustomerAutoresponder(
          emailPayload,
          {
            ...(professionalAttachments.length ? { attachments: professionalAttachments } : {}),
            idempotencyKey,
          },
        );
      } catch (err) {
        const failure = getEmailDeliveryFailureSummary(err);
        sendError = new Error(failure.code);
        console.error('Autoresponder send failed', failure);
      }

      // Best-effort log (do not block submission)
      try {
        const nowIso = new Date().toISOString();

        const templateSeedRes = await supabase
          .from('email_templates')
          .upsert(
            {
              id: templateId,
              subject,
              body_html: '<p>(Rendered in app code)</p>',
              body_text: null,
              variables: [],
            } as any,
            { onConflict: 'id' } as any,
          );

        if (templateSeedRes.error) {
          throw templateSeedRes.error;
        }

        const outboxRes = await supabase
          .from('email_outbox')
          .upsert(
            {
              project_id: projectId,
              contact_id: contactId,
              email_type: emailType,
              to_email: email,
              subject,
              template_id: templateId,
              variables,
              status: sendError ? 'FAILED' : 'SENT',
              error: sendError ? sendError.message : null,
              idempotency_key: idempotencyKey,
              sent_at: sendError ? null : nowIso,
            } as any,
            { onConflict: 'idempotency_key' } as any,
          );

        if (outboxRes.error) {
          const outboxError = outboxRes.error;
          await supabase
            .from('audit_events')
            .upsert(
              {
                project_id: projectId,
                type: 'email_failed',
                idempotency_key: `audit:${idempotencyKey}:outbox_failed`,
                payload: {
                  to: email,
                  subject,
                  templateId,
                  kind: emailType,
                  supabaseHost,
                  error: outboxError.message ?? 'email_outbox upsert failed',
                },
                created_at: nowIso,
              } as any,
              { onConflict: 'idempotency_key' } as any,
            );
          throw outboxError;
        }

        await supabase
          .from('audit_events')
          .upsert(
            {
              project_id: projectId,
              type: sendError ? 'email_failed' : 'email_sent',
              idempotency_key: `audit:${idempotencyKey}`,
              payload: { to: email, subject, templateId, kind: emailType, supabaseHost },
              created_at: nowIso,
            } as any,
            { onConflict: 'idempotency_key' } as any,
          );
      } catch (e) {
        console.error('Failed to log autoresponder in email_outbox/audit_events', {
          code: 'EMAIL_OUTBOX_AUDIT_WRITE_FAILED',
        });
        try {
          const fallbackIso = new Date().toISOString();
          const errorMessage = e instanceof Error ? e.message : 'email_outbox logging failed';
          await supabase
            .from('audit_events')
            .upsert(
              {
                project_id: projectId,
                type: 'email_failed',
                idempotency_key: `audit:${idempotencyKey}:log_failed`,
                payload: {
                  to: email,
                  subject,
                  templateId,
                  kind: emailType,
                  supabaseHost,
                  error: errorMessage,
                },
                created_at: fallbackIso,
              } as any,
              { onConflict: 'idempotency_key' } as any,
            );
        } catch {
          console.error('Failed to log email_outbox error to audit_events', {
            code: 'EMAIL_AUDIT_FALLBACK_WRITE_FAILED',
          });
        }
        throw e;
      }
    } catch (err) {
      console.error('Autoresponder send failed', getEmailDeliveryFailureSummary(err));
    }
  }

  return NextResponse.json({
    ok: true,
    contactId,
    projectId,
    designId,
    enquiryRequestId: enquiryRow.id,
  });
}
