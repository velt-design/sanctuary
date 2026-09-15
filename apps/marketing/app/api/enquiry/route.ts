import { parsePreviewDraft } from '../../../components/configurator-prototype/previewDraft';
import { prepareEnquiryEmail } from '../../../lib/enquiryEmailPreparation';
import { normalizeEnquiryProjectPreferences } from '../../../lib/enquiryProjectPreferences';
import { buildCustomerBrief, type CustomerBrief } from '../../../lib/enquiryDesign';
import { getRoofFinish, hasSimpleRoofPrice } from '../../../components/configurator-prototype/roofFinish';
import { INITIAL_ROOF } from '../../../components/configurator-prototype/GableChoices';
import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildEnquiryDraftEstimateRow,
} from '../../../lib/enquiryPricingSnapshot';
import { buildPublishedEnquiryPricingSnapshot } from '../../../lib/publishedEnquiryPricingSnapshot.server';
import {
  normalizeMarketingAttributionInput,
  recordMarketingConversionEvent,
} from '../../../../../apps/portal/lib/marketingAttribution/server';
import { prepareCustomerAutoresponder, sendCustomerAutoresponder } from '@/lib/email/sendCustomerAutoresponder';
import { getEmailDeliveryFailureSummary } from '@/lib/email/sendEmail';
import { projects } from '../../../data/projects';
import { products } from '../../../data/products';
import {
  getEnquiryContextProperties,
  type EnquiryAudience,
} from '../../../lib/enquiryContext';
import { parseSubmittedEnquiryContext } from '../../../lib/enquirySubmissionContext';
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

function safeJsonPayload(value: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
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
  const configuredEnquiry = enquiryType === 'residential' && getField('requestType') === 'project-discussion' && parsePreviewDraft(payload.customerDesign) !== null;
  if (!phone && !configuredEnquiry) {
    return NextResponse.json({ ok: false, error: 'Phone is required' }, { status: 422 });
  }
  if (phoneRaw && !isPlausibleEnquiryPhone(phoneRaw)) {
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
  if (configuredEnquiry && !suburb) return NextResponse.json({ ok: false, error: 'Enter your suburb.' }, { status: 422 });
  if (getField('requestType') === 'site-measure' && !suburb) {
    return NextResponse.json({ ok: false, error: 'Enter the site address for your measure request.' }, { status: 422 });
  }
  const message = sanitizeMultiline(getField('message'), MAX_MESSAGE_LENGTH);
  const company = sanitizeSingleLine(getField('company'), MAX_FIELD_LENGTH);
  const page = sanitizeSingleLine(getField('page'), MAX_FIELD_LENGTH);
  const source = sanitizeSingleLine(getField('source'), MAX_FIELD_LENGTH) || 'website';
  const calculationRef = sanitizeSingleLine(getField('calculationRef'), 2_048);
  const simpleCoverStatusRaw = sanitizeSingleLine(getField('simpleCoverStatus'), 32);
  const simpleCoverStatus = (
    ['priced', 'custom', 'unavailable', 'unconfigured'] as const
  ).find((status) => status === simpleCoverStatusRaw) ?? null;
  const rawEnquiryContext = isPlainObject(payload.enquiryContext)
    ? payload.enquiryContext
    : {};
  const parsedEnquiryContext = parseSubmittedEnquiryContext(
    rawEnquiryContext,
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
  const untrustedUtm = isPlainObject(utmRaw) ? utmRaw : {};

  const attributionRaw = maybeParseJson(payload.attribution);
  const attribution = normalizeMarketingAttributionInput(attributionRaw, {
    utm: untrustedUtm,
    page,
    source,
  });
  const utm = attribution.utm;
  let customerBrief: CustomerBrief;
  try {
    customerBrief = buildCustomerBrief(enquiryType as EnquiryAudience, payload.customerDesign, payload.enquiryIntent);
  } catch {
    return NextResponse.json({ ok: false, error: 'Please reopen your design and try again. Its saved selections could not be verified.' }, { status: 422 });
  }
  const {
    customerDesign: _untrustedDesign,
    customerBrief: _untrustedBrief,
    uploadSessionToken: _uploadSessionToken,
    enquiryContext: _untrustedEnquiryContext,
    calculationRef: _opaqueCalculationRef,
    ...payloadWithoutUploadToken
  } = payload;
  const rawPayload = safeJsonPayload({
    ...payloadWithoutUploadToken,
    utm,
    attribution,
    enquiryContext,
    customerBrief,
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

  const pricing = await buildPublishedEnquiryPricingSnapshot({
    enquiryType,
    name,
    suburb,
    widthM,
    depthM,
    heightM,
    style,
    roofMaterials,
    addOns,
  }, {
    calculationRef: customerBrief.design && !hasSimpleRoofPrice(customerBrief.design.roof) && !calculationRef.startsWith('cf1.') ? null : calculationRef || null,
    design: customerBrief.design,
    suppressGenericPricing: Boolean(customerBrief.design || payload.enquiryIntent === 'help' || payload.enquiryIntent === 'bespoke' || simpleCoverStatus || calculationRef),
  });
  const budgets = pricing.budgets;
  const verifiedSimpleCover = pricing.verifiedSimpleCover;
  if (customerBrief.design && verifiedSimpleCover && Object.entries(verifiedSimpleCover.input).some(([key, value]) => customerBrief.design!.input[key as keyof typeof verifiedSimpleCover.input] !== value)) {
    return NextResponse.json({ ok: false, error: 'Your estimate and design differ. Please refresh the estimate.' }, { status: 422 });
  }
  if (!customerBrief.design && verifiedSimpleCover) {
    customerBrief = buildCustomerBrief(enquiryType as EnquiryAudience, { version: 1, input: verifiedSimpleCover.input, roof: INITIAL_ROOF }, payload.enquiryIntent);
  }
  rawPayload.customerBrief = customerBrief;
  const projectPreferences = normalizeEnquiryProjectPreferences(payload.projectDetails, customerBrief.audience === 'residential' && (customerBrief.designStatus === 'help' || customerBrief.designStatus === 'bespoke'));
  rawPayload.projectPreferences = projectPreferences;
  const submittedDesign = customerBrief.design;
  const effectiveWidthM = submittedDesign ? submittedDesign.input.widthMm / 1000 : verifiedSimpleCover?.widthM ?? widthM;
  const effectiveDepthM = submittedDesign ? submittedDesign.input.projectionMm / 1000 : verifiedSimpleCover?.depthM ?? depthM;
  const effectiveHeightM = submittedDesign || verifiedSimpleCover ? null : heightM;
  const effectiveStyle = submittedDesign ? ({ mono: 'pitched', gable: 'gable', box: 'perimeter' }[submittedDesign.roof.family]) : verifiedSimpleCover ? 'pitched' : style;
  const finishMaterial = submittedDesign ? getRoofFinish(submittedDesign.roof).material : null;
  const effectiveRoofMaterials = finishMaterial ? (finishMaterial === 'acrylic' ? ['acrylic'] : finishMaterial === 'solid' ? ['timber'] : ['acrylic', 'timber']) : verifiedSimpleCover ? ['acrylic'] : roofMaterials;

  const durableDelivery = process.env.WEBSITE_ENQUIRY_DURABLE_DELIVERY === 'true';
  let draftEstimate: Record<string, unknown>;
  let intake;
  try {
    draftEstimate = buildEnquiryDraftEstimateRow({
      projectId: null, createdBy: 'marketing_enquiry', name, email, phoneRaw, suburb, message,
      enquiryType, widthM: effectiveWidthM, depthM: effectiveDepthM, heightM: effectiveHeightM,
      style: effectiveStyle, roofMaterials: effectiveRoofMaterials, addOns, pricing, customerBrief, projectPreferences,
    });
    let delivery;
    if (durableDelivery) {
      // Submission identity is available before the atomic intake; retries retain
      // the first stored message even if this preparation renders newer content.
      const prepared = await prepareEnquiryEmail(supabase, {
        enquiryRow: { id: submissionId }, enquiryType, name, email, phoneRaw, suburb, message, company, page,
        customerBrief, payload, utm, files, verifiedStoredAttachments, effectiveWidthM,
        effectiveDepthM, effectiveHeightM, effectiveStyle, effectiveRoofMaterials, addOns,
        budgets, verifiedSimpleCover, verifiedConfigurator: pricing.verifiedConfigurator,
      });
      delivery = {
        draftEstimate,
        message: await prepareCustomerAutoresponder(prepared.emailPayload, {
          templateId: prepared.templateId, attachments: prepared.resolvedAttachments.attachments,
        }),
        templateId: prepared.templateId, emailType: prepared.emailType, variables: prepared.variables,
      };
    }
    intake = await createMarketingEnquiryIntake(supabase, {
      submissionId,
      uploadSessionToken,
      ...(delivery ? { delivery } : {}),
      payload: {
        enquiryType,
        name,
        email,
        phone,
        phoneRaw,
        suburb,
        message,
        widthM: effectiveWidthM,
        depthM: effectiveDepthM,
        heightM: effectiveHeightM,
        style: effectiveStyle,
        roofMaterials: effectiveRoofMaterials,
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
      designId: intake.estimateId ? `est_${intake.estimateId}` : null,
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
      ...(simpleCoverStatus || calculationRef
        ? { pricing_source: pricing.pricingSource }
        : {
            baseBudgetLowIncGst: budgets.baseRange?.lowIncGst ?? null,
            baseBudgetHighIncGst: budgets.baseRange?.highIncGst ?? null,
          }),
    },
    supabase,
  });

  let designId: string | null = intake.estimateId ? `est_${intake.estimateId}` : null;
  if (!durableDelivery) try {
    const estimateInsert = await supabase
      .from('estimates')
      .insert(
        { ...draftEstimate, project_id: projectId } as any,
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

  if (email && !durableDelivery) {
    try {
      const { emailPayload, resolvedAttachments, templateId, subject, emailType, variables } = await prepareEnquiryEmail(supabase, {
        enquiryRow, enquiryType, name, email, phoneRaw, suburb, message, company, page,
        customerBrief, payload, utm, files, verifiedStoredAttachments, effectiveWidthM,
        effectiveDepthM, effectiveHeightM, effectiveStyle, effectiveRoofMaterials, addOns,
        budgets, verifiedSimpleCover, verifiedConfigurator: pricing.verifiedConfigurator,
      });

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

      let sendError: Error | null = null;
      try {
        await sendCustomerAutoresponder(
          emailPayload,
          {
            ...(resolvedAttachments.attachments.length
              ? { attachments: resolvedAttachments.attachments }
              : {}),
            idempotencyKey,
            templateId,
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

