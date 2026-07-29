import type { EnquiryAudience } from './enquiryContext';

const MAX_FIELD_LENGTH = 400;
const MAX_MESSAGE_LENGTH = 4000;

const coreFieldNames = new Set([
  'enquiryType',
  'enquiry_type',
  'name',
  'email',
  'phone',
  'suburb',
  'message',
  'company',
  'page',
  'source',
  'enquiryContext',
  'widthM',
  'depthM',
  'heightM',
  'style',
  'roofMaterials',
  'addOns',
  'files',
  'website',
]);

function readText(
  formData: FormData,
  key: string,
  maxLength = MAX_FIELD_LENGTH,
): string {
  const value = formData.get(key);
  if (typeof value !== 'string') return '';
  return value.replace(/\0/g, '').trim().slice(0, maxLength);
}

function readTextList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .flatMap((value) => typeof value === 'string' ? [value.trim()] : [])
    .filter(Boolean)
    .map((value) => value.slice(0, MAX_FIELD_LENGTH));
}

function readContext(formData: FormData): Record<string, unknown> {
  const raw = readText(formData, 'enquiryContext', MAX_MESSAGE_LENGTH);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function inferRoofMaterials(formData: FormData): string[] {
  const explicit = readTextList(formData, 'roofMaterials')
    .map((value) => value.toLowerCase());
  if (explicit.length) return [...new Set(explicit)];

  const preference = readText(formData, 'roofPreference').toLowerCase();
  if (!preference || preference === 'unsure') return [];
  if (preference.includes('combination')) return ['acrylic', 'timber'];
  if (
    preference.includes('acrylic')
    || preference.includes('clear')
    || preference.includes('grey')
    || preference.includes('opal')
  ) {
    return ['acrylic'];
  }
  if (
    preference.includes('solid')
    || preference.includes('lined')
    || preference.includes('timber')
  ) {
    return ['timber'];
  }
  return [];
}

function readAddOns(formData: FormData): Record<string, boolean> {
  const selected = [
    ...readTextList(formData, 'addOns'),
    ...readTextList(formData, 'accessories'),
  ].map((value) => value.toLowerCase());
  const includes = (needle: string) => selected.some((value) => value.includes(needle));

  return {
    blinds: includes('blind'),
    slats: includes('slat'),
    lighting: includes('light'),
    heating: includes('heat'),
    acrylicInfillPanels: includes('acrylic infill'),
    other: selected.includes('other'),
  };
}

function readProjectDetails(formData: FormData): Record<string, string | string[]> {
  const details: Record<string, string | string[]> = {};
  const keys = new Set(Array.from(formData.keys()));

  for (const key of keys) {
    if (coreFieldNames.has(key)) continue;
    const values = readTextList(formData, key);
    if (!values.length) continue;
    details[key] = values.length === 1 ? values[0] : values;
  }

  return details;
}

export function buildEnquiryFallbackPayload(
  formData: FormData,
  submissionId: string,
): Record<string, unknown> {
  const enquiryType = (
    readText(formData, 'enquiryType')
    || readText(formData, 'enquiry_type')
  ).toLowerCase() as EnquiryAudience;
  const style = readText(formData, 'style');

  return {
    submissionId,
    enquiryType,
    name: readText(formData, 'name'),
    email: readText(formData, 'email'),
    phone: readText(formData, 'phone'),
    suburb: readText(formData, 'suburb'),
    message: readText(formData, 'message', MAX_MESSAGE_LENGTH),
    company: readText(formData, 'company') || null,
    dimensions: {
      widthM: readText(formData, 'widthM') || null,
      depthM: readText(formData, 'depthM') || null,
      heightM: readText(formData, 'heightM') || null,
    },
    style: style === 'unsure' ? '' : style,
    roofMaterials: inferRoofMaterials(formData),
    addOns: readAddOns(formData),
    projectDetails: readProjectDetails(formData),
    enquiryContext: readContext(formData),
    page: readText(formData, 'page'),
    source: readText(formData, 'source') || 'website',
    honeypot: readText(formData, 'website'),
  };
}
