import 'server-only';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

function safeJsonPayload(value: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
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
  if (!email && !phone) {
    return NextResponse.json({ ok: false, error: 'Email or phone is required' }, { status: 422 });
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
        return NextResponse.json({ ok: false, error: error.message || 'Failed to update contact' }, { status: 500 });
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

  const { data: enquiryRow, error: enquiryError } = await supabase
    .from('enquiry_requests')
    .insert({
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
    })
    .select('id')
    .single();

  if (enquiryError || !enquiryRow?.id) {
    return NextResponse.json({ ok: false, error: enquiryError?.message || 'Failed to create enquiry request' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    contactId,
    projectId,
    enquiryRequestId: enquiryRow.id,
  });
}
