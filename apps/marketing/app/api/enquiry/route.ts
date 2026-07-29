import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  websiteAutoresponderSubject,
} from '@/lib/sharedEmails';
import { getCallWindowText } from '@/emails/utils/callWindow';
import type {
  EnquiryPayload,
  Professional,
  ResidentialOrCommercialEnquiry,
} from '@/emails/types';
import { projects } from '../../../data/projects';
import { products } from '../../../data/products';
import {
  getEnquiryContextProperties,
  parseEnquiryContext,
  type EnquiryAudience,
} from '../../../lib/enquiryContext';
import { getServiceSupabase } from '@/lib/supabaseService';
import {
  isAllowedMarketingOrigin,
  isUuid,
  marketingAbuseKey,
  takeMarketingRateLimit,
} from '@/lib/marketingPublicRequest';
import {
  normalizeEnquiryFiles,
  verifyStoredEnquiryAttachments,
  EnquiryAttachmentVerificationError,
  type VerifiedStoredAttachment,
} from '@/lib/enquiryStoredAttachments';
import {
  createMarketingEnquiryIntake,
  MarketingEnquiryIntakeError,
} from '@/lib/enquiryIntake';
import {
  isPlausibleEnquiryPhone,
  isValidEnquiryEmail,
} from '../../../lib/enquiryContactValidation';

const MAX_FIELD_LENGTH = 400;
const MAX_MESSAGE_LENGTH = 4000;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return null;
  try {
    const raw = await req.text();
    if (!raw || Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return null;
    if (ct.includes('application/json')) {
      const parsed = JSON.parse(raw) as unknown;
      return isPlainObject(parsed) ? parsed : null;
    }
    if (ct.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(raw).entries());
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
async function resolveEnquiryAttachments(
  supabase: SupabaseClient,
  files: unknown,
  verifiedFiles: VerifiedStoredAttachment[],
): Promise<{ attachments: ResolvedAttachment[]; attachmentLinks: AttachmentLink[] }> {
  const entries = storedAttachmentEntries(files);
  if (!entries.length) return { attachments: [], attachmentLinks: [] };

  const totalBytes = entries.reduce((sum, entry) => sum + (entry.size > 0 ? entry.size : 0), 0);

  if (totalBytes > 0 && totalBytes <= ATTACH_INLINE_MAX_BYTES) {
    const attachments: ResolvedAttachment[] = verifiedFiles.map((file) => ({
      filename: file.filename,
      content: file.content.toString('base64'),
    }));
    if (attachments.length) return { attachments, attachmentLinks: [] };
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
  if (!isAllowedMarketingOrigin(req)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = await readBody(req);
  } catch {
    payload = null;
  }

  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }

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
  if (!isPlausibleEnquiryPhone(phoneRaw)) {
    return NextResponse.json({ ok: false, error: 'Invalid phone' }, { status: 422 });
  }
  if (!email) {
    return NextResponse.json({ ok: false, error: 'Email is required' }, { status: 422 });
  }
  if (!isValidEnquiryEmail(email)) {
    return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 422 });
  }
  if (!['residential', 'commercial', 'professional'].includes(enquiryType)) {
    return NextResponse.json({ ok: false, error: 'Invalid enquiry type' }, { status: 422 });
  }

  const submissionId = sanitizeSingleLine(getField('submissionId'), 64);
  if (!isUuid(submissionId)) {
    return NextResponse.json({ ok: false, error: 'Invalid submission ID' }, { status: 422 });
  }
  const uploadSessionToken = sanitizeSingleLine(getField('uploadSessionToken'), 128);

  const suburb = sanitizeSingleLine(getField('suburb'), MAX_FIELD_LENGTH);
  const message = sanitizeMultiline(getField('message'), MAX_MESSAGE_LENGTH);
  const company = sanitizeSingleLine(getField('company'), MAX_FIELD_LENGTH);
  const page = sanitizeSingleLine(getField('page'), MAX_FIELD_LENGTH);
  const source = sanitizeSingleLine(getField('source'), MAX_FIELD_LENGTH) || 'website';
  const rawEnquiryContext = isPlainObject(payload.enquiryContext)
    ? payload.enquiryContext
    : {};
  const parsedEnquiryContext = parseEnquiryContext(
    {
      enquiry_type: typeof rawEnquiryContext.enquiry_type === 'string'
        ? rawEnquiryContext.enquiry_type
        : undefined,
      source_path: typeof rawEnquiryContext.source_path === 'string'
        ? rawEnquiryContext.source_path
        : undefined,
      source_component: typeof rawEnquiryContext.source_component === 'string'
        ? rawEnquiryContext.source_component
        : undefined,
      source_project: typeof rawEnquiryContext.source_project === 'string'
        ? rawEnquiryContext.source_project
        : undefined,
      source_product: typeof rawEnquiryContext.source_product === 'string'
        ? rawEnquiryContext.source_product
        : undefined,
    },
    {
      projectSlugs: projects.map((project) => project.slug),
      productSlugs: products.map((product) => product.slug),
    },
  );
  const enquiryContext = getEnquiryContextProperties({
    ...parsedEnquiryContext,
    enquiryType: enquiryType as EnquiryAudience,
  });

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
  const {
    uploadSessionToken: _uploadSessionToken,
    enquiryContext: _untrustedEnquiryContext,
    ...payloadWithoutUploadToken
  } = payload;
  const rawPayload = safeJsonPayload({
    ...payloadWithoutUploadToken,
    attribution,
    enquiryContext,
  });

  const filesRaw = maybeParseJson(payload.files);
  const files = normalizeEnquiryFiles(filesRaw);

  let supabase: SupabaseClient;
  try {
    supabase = getServiceSupabase();
  } catch {
    return NextResponse.json({ ok: false, error: 'Enquiry service unavailable' }, { status: 503 });
  }

  let abuseKey: string;
  try {
    abuseKey = marketingAbuseKey(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'Enquiry service unavailable' }, { status: 503 });
  }
  const rateLimit = await takeMarketingRateLimit(supabase, {
    scope: 'enquiry_submit',
    keyHash: abuseKey,
    maxHits: 6,
    windowSeconds: 600,
  });
  if (!rateLimit.ok) {
    if (rateLimit.unavailable) {
      return NextResponse.json({ ok: false, error: 'Enquiry service unavailable' }, { status: 503 });
    }
    return NextResponse.json(
      { ok: false, error: 'Too many submissions. Please try later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  let verifiedStoredAttachments: VerifiedStoredAttachment[] = [];
  try {
    verifiedStoredAttachments = await verifyStoredEnquiryAttachments(supabase, {
      files,
      submissionId,
      uploadSessionToken,
    });
  } catch (error) {
    if (
      error instanceof EnquiryAttachmentVerificationError
      && error.code === 'ATTACHMENT_UNAVAILABLE'
    ) {
      return NextResponse.json(
        { ok: false, error: 'One or more attachments could not be verified. Please try uploading again.' },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: 'One or more attachments are invalid.' },
      { status: 422 },
    );
  }

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

  let intake;
  try {
    intake = await createMarketingEnquiryIntake(supabase, {
      submissionId,
      uploadSessionToken,
      payload: {
        enquiryType,
        name,
        email,
        phone,
        phoneRaw,
        suburb,
        message,
        widthM,
        depthM,
        heightM,
        style,
        roofMaterials,
        addOns,
        company,
        baseBudgetLowIncGst: budgets.baseRange?.lowIncGst ?? null,
        baseBudgetHighIncGst: budgets.baseRange?.highIncGst ?? null,
        blindsBudgetLowIncGst: budgets.blindsRange?.lowIncGst ?? null,
        blindsBudgetHighIncGst: budgets.blindsRange?.highIncGst ?? null,
        budgetBasis: budgets.budgetBasis ?? null,
        source,
        page,
        utm,
        rawPayload,
        files,
      },
    });
  } catch (error) {
    if (error instanceof MarketingEnquiryIntakeError) {
      return NextResponse.json({ ok: false, error: 'Unable to save enquiry' }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: 'Unable to save enquiry' }, { status: 503 });
  }

  const {
    contactId,
    projectId,
    enquiryRequestId,
    alreadyExisted,
  } = intake;
  const enquiryRow = { id: enquiryRequestId };

  if (alreadyExisted) {
    return NextResponse.json({
      ok: true,
      contactId,
      projectId,
      designId: null,
      enquiryRequestId,
      idempotentReplay: true,
    });
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
      ...enquiryContext,
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
      const filesCount = Array.isArray(files) ? files.length : 0;
      const resolvedAttachments = await resolveEnquiryAttachments(
        supabase,
        files,
        verifiedStoredAttachments,
      );
      const attachmentContext = {
        filesReceivedCount: filesCount,
        ...(resolvedAttachments.attachmentLinks.length
          ? { attachmentLinks: resolvedAttachments.attachmentLinks }
          : {}),
      };

      if (enquiryType === 'professional') {
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
          ...attachmentContext,
        } satisfies Professional;
      } else {
        const addons = addOnLabels(addOns);
        const blindsSelected = isTruthy(addOns?.blinds);
        emailPayload = {
          leadId: enquiryRow.id,
          submittedAt,
          enquiryType: enquiryType as ResidentialOrCommercialEnquiry['enquiryType'],
          name,
          email,
          phone: phoneRaw,
          suburb,
          message: message || undefined,
          utmSource,
          utmMedium,
          utmCampaign,
          landingUrl: page || undefined,
          ...attachmentContext,
          widthM: Number.isFinite(widthM ?? NaN) ? Number(widthM) : 0,
          depthM: Number.isFinite(depthM ?? NaN) ? Number(depthM) : 0,
          heightM: Number.isFinite(heightM ?? NaN) ? Number(heightM) : 0,
          style: formatStyleLabel(style),
          roof: formatRoofLabel(roofMaterials),
          addons,
          blindsSelected,
          ...(budgets.baseRange ? { baseRange: budgets.baseRange } : {}),
          ...(budgets.blindsRange ? { blindsRange: budgets.blindsRange } : {}),
        } satisfies ResidentialOrCommercialEnquiry;
      }

      const callWindowText = getCallWindowText(submittedAt);

      const templateId =
        enquiryType === 'commercial'
          ? EMAIL_WEBSITE_AUTORESPONDER_COM_V1
          : enquiryType === 'professional'
            ? EMAIL_WEBSITE_AUTORESPONDER_PRO_V1
            : EMAIL_WEBSITE_AUTORESPONDER_RES_V1;

      const subject = websiteAutoresponderSubject(
        templateId,
        emailPayload as unknown as Record<string, unknown>,
      );

      const emailType =
        enquiryType === 'professional' ? 'WEBSITE_PROFESSIONAL_AUTORESPONDER' : 'WEBSITE_ESTIMATE_AUTORESPONDER';

      const idempotencyKey = `website:autoresponder:${enquiryRow.id}`;
      const supabaseHost = (() => {
        try {
          const url =
            process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
            || process.env.SUPABASE_URL?.trim()
            || '';
          return new URL(url).host;
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
            ...(resolvedAttachments.attachments.length
              ? { attachments: resolvedAttachments.attachments }
              : {}),
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
