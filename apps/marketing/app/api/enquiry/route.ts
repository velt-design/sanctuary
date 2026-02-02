import 'server-only';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { calculateCostV1 } from '../../../../../src/costing/engine/calculate';
import type { CostInputsV1 } from '../../../../../src/costing/engine/types';
import {
  QUOTE_MULTIPLIER,
  toIndicativeRangeOneSided,
  type EnquiryType as EstimateEnquiryType,
  type MoneyRange,
} from '../../../../../lib/pricing/enquiryEstimate';
import {
  autoSplitByMaxWidth,
  getBlindSystemLimits,
  priceAllBlinds,
  type BlindLineItemInput,
} from '../../../../../lib/costing/blinds';
import { sendCustomerAutoresponder } from '@/lib/email/sendCustomerAutoresponder';
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
  return process.env.SUPABASE_URL?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    || requiredEnv('SUPABASE_URL');
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

function pergolaStyleForCosting(styleRaw: string): CostInputsV1['pergola_style'] {
  const s = String(styleRaw ?? '').trim().toLowerCase();
  if (s === 'gable') return 'gable';
  if (s === 'hip') return 'hip';
  if (s === 'hip_corner') return 'hip_corner';
  if (s === 'box_perimeter' || s === 'perimeter') return 'box_perimeter';
  return 'pitched';
}

function roofMaterialForCosting(roofMaterials: string[]): CostInputsV1['roof_material'] {
  const mats = roofMaterials.map((m) => String(m ?? '').trim().toLowerCase()).filter(Boolean);
  const hasAcrylic = mats.includes('acrylic');
  const hasTimber = mats.includes('timber');
  if (hasAcrylic && hasTimber) return 'mixed';
  if (hasTimber) return 'timber';
  return 'acrylic';
}

function heightCategoryForCosting(heightM: number | null): CostInputsV1['height'] {
  if (typeof heightM === 'number' && Number.isFinite(heightM) && heightM >= 3) return 'two_storey';
  return 'single_storey';
}

function estimateBaseTrueCostIncGst(params: {
  widthM: number | null;
  depthM: number | null;
  heightM: number | null;
  style: string;
  roofMaterials: string[];
}): number | null {
  if (!Number.isFinite(params.widthM ?? NaN) || !Number.isFinite(params.depthM ?? NaN)) return null;

  const lengthM = Math.max(0.1, Number(params.widthM));
  const projectionM = Math.max(0.1, Number(params.depthM));
  const postCutHeightM = Number.isFinite(params.heightM ?? NaN) ? Math.max(1, Number(params.heightM)) : 2.4;

  const inputs: CostInputsV1 = {
    length_m: lengthM,
    projection_m: projectionM,
    post_cut_height_m: postCutHeightM,
    pergola_style: pergolaStyleForCosting(params.style),
    roof_material: roofMaterialForCosting(params.roofMaterials),
    extrusion_colour: 'Black',
    house_connection_type: 'fascia',
    post_connection_type: 'deck_bracket',
    access: 'normal',
    height: heightCategoryForCosting(params.heightM),
    ground: 'easy',
  };

  try {
    const result = calculateCostV1(inputs);
    const totalInc = result?.totals?.cost_inc_gst;
    return typeof totalInc === 'number' && Number.isFinite(totalInc) && totalInc > 0 ? totalInc : null;
  } catch {
    // Estimation should never block submission; treat pricing as unavailable.
    return null;
  }
}

function estimateBlindsQuoteIncGst(params: {
  widthM: number | null;
  depthM: number | null;
  heightM: number | null;
}): number | null {
  if (!Number.isFinite(params.widthM ?? NaN) || !Number.isFinite(params.depthM ?? NaN)) return null;

  const system: BlindLineItemInput['system'] = 'ZIPTRAK';
  const { maxWidthMm, maxCoverLengthMm } = getBlindSystemLimits(system);

  const heightMmRaw = Number.isFinite(params.heightM ?? NaN) ? Math.round(Math.max(1, Number(params.heightM)) * 1000) : 2400;
  const coverLengthMm = Math.min(Math.max(1000, heightMmRaw), maxCoverLengthMm);

  const widthMm = Math.round(Number(params.widthM) * 1000);
  const depthMm = Math.round(Number(params.depthM) * 1000);

  // Assume blinds on 3 open faces (front + 2 sides). House side is excluded.
  const facesMm = [widthMm, depthMm, depthMm].filter((v) => Number.isFinite(v) && v > 0);

  const items: BlindLineItemInput[] = [];
  let idSeq = 1;
  for (const faceWidthMm of facesMm) {
    const split = autoSplitByMaxWidth(faceWidthMm, maxWidthMm) ?? [faceWidthMm];
    for (const panelWidthMm of split) {
      items.push({
        id: `b${idSeq++}`,
        system,
        widthMm: panelWidthMm,
        coverLengthMm,
        fabric: 'MESH',
        motorised: false,
      });
    }
  }

  if (!items.length) return null;

  const priced = priceAllBlinds(items);
  const totalInc = priced?.totals?.totalIncCents ? priced.totals.totalIncCents / 100 : 0;
  return Number.isFinite(totalInc) && totalInc > 0 ? totalInc : null;
}

function estimateIndicativeBudgets(params: {
  enquiryType: string;
  widthM: number | null;
  depthM: number | null;
  heightM: number | null;
  style: string;
  roofMaterials: string[];
  addOns: Record<string, unknown>;
}): { baseRange: MoneyRange | null; blindsRange: MoneyRange | null; budgetBasis: string | null } {
  if (params.enquiryType !== 'residential' && params.enquiryType !== 'commercial') {
    return { baseRange: null, blindsRange: null, budgetBasis: null };
  }

  const enquiryType = params.enquiryType as EstimateEnquiryType;

  const baseTrueCostIncGst = estimateBaseTrueCostIncGst({
    widthM: params.widthM,
    depthM: params.depthM,
    heightM: params.heightM,
    style: params.style,
    roofMaterials: params.roofMaterials,
  });

  const baseRange = baseTrueCostIncGst ? toIndicativeRangeOneSided(baseTrueCostIncGst, enquiryType) : null;

  const blindsSelected = isTruthy(params.addOns?.blinds);
  const blindsQuoteIncGst = blindsSelected
    ? estimateBlindsQuoteIncGst({ widthM: params.widthM, depthM: params.depthM, heightM: params.heightM })
    : null;

  const blindsTrueCostIncGst = blindsQuoteIncGst ? blindsQuoteIncGst / QUOTE_MULTIPLIER : null;
  const blindsRange = blindsTrueCostIncGst ? toIndicativeRangeOneSided(blindsTrueCostIncGst, enquiryType) : null;

  const budgetBasis =
    baseRange || blindsRange ? 'website ballpark: 1.25x true cost, baseline->+15%, fascia assumption' : null;

  return { baseRange, blindsRange, budgetBasis };
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

  const rawPayload = safeJsonPayload(payload);
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

  const budgets = estimateIndicativeBudgets({
    enquiryType,
    widthM,
    depthM,
    heightM,
    style,
    roofMaterials,
    addOns,
  });

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

      if (enquiryType === 'professional') {
        const filesCount = Array.isArray(files) ? files.length : 0;
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

      await sendCustomerAutoresponder(emailPayload);
    } catch (err) {
      console.error('Autoresponder send failed', err);
    }
  }

  return NextResponse.json({
    ok: true,
    contactId,
    projectId,
    enquiryRequestId: enquiryRow.id,
  });
}
