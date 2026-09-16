import type { SupabaseClient } from '@supabase/supabase-js';
import type { EnquiryPayload, Professional, ResidentialOrCommercialEnquiry } from '../emails/types';
import { normalizeEnquiryProjectPreferences } from './enquiryProjectPreferences';
import type { CustomerBrief, EnquiryAudience } from './enquiryDesignContract';
import type { EnquiryPricingSnapshot } from './enquiryPricingSnapshot';
import type { VerifiedStoredAttachment } from './enquiryStoredAttachments';
import { customerDesignUrl } from './enquiryDesignLink';
import { selectEnquiryEmailTemplate } from './enquiryEmailPolicy';
import { websiteAutoresponderSubject } from './sharedEmails';
import { getCallWindowText } from '../emails/utils/callWindow';
import { customerPriceBreakdown } from '../components/configurator-prototype/customerPriceBreakdown';

type EnquiryEmailInput = {
  enquiryRow: { id: string }; enquiryType: string;
  name: string; email: string; phoneRaw: string; suburb: string; message: string; company: string; page: string;
  customerBrief: CustomerBrief; payload: Record<string, unknown>; utm: unknown;
  files: unknown; verifiedStoredAttachments: VerifiedStoredAttachment[];
  effectiveWidthM: number | null; effectiveDepthM: number | null; effectiveHeightM: number | null;
  effectiveStyle: string; effectiveRoofMaterials: string[]; addOns: Record<string, unknown>;
  budgets: EnquiryPricingSnapshot['budgets']; verifiedSimpleCover: EnquiryPricingSnapshot['verifiedSimpleCover'];
  verifiedConfigurator?: EnquiryPricingSnapshot['verifiedConfigurator'];
};

const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function sanitizeSingleLine(value: string, max: number): string {
  const cleaned = value.replace(/[\r\n]+/g, ' ').replace(CONTROL_CHARS_REGEX, ' ').trim();
  return clamp(cleaned, max);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function isTruthy(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'y';
  }
  return false;
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

export async function prepareEnquiryEmail(supabase: SupabaseClient, input: EnquiryEmailInput) {
  const { enquiryRow, enquiryType, name, email, phoneRaw, suburb, message, company, page,
    customerBrief, payload, utm, files, verifiedStoredAttachments, effectiveWidthM,
    effectiveDepthM, effectiveHeightM, effectiveStyle, effectiveRoofMaterials, addOns,
    budgets, verifiedSimpleCover } = input;
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
        customerBrief,
        projectPreferences: normalizeEnquiryProjectPreferences(payload.projectDetails, customerBrief.audience === 'residential' && (customerBrief.designStatus === 'help' || customerBrief.designStatus === 'bespoke')),
        submittedDesignUrl: customerDesignUrl(customerBrief),
        company: company || undefined,
        projectRole: isPlainObject(payload.projectDetails) ? sanitizeSingleLine(String(payload.projectDetails.projectRole ?? ''), 200) : undefined,
        projectStage: isPlainObject(payload.projectDetails) ? sanitizeSingleLine(String(payload.projectDetails.projectStage ?? ''), 200) : undefined,
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
          widthM: Number.isFinite(effectiveWidthM ?? NaN) ? Number(effectiveWidthM) : 0,
          ...(input.verifiedConfigurator ? { configuredEstimate: {
            ...structuredClone(input.verifiedConfigurator.customerPrice),
            breakdown: customerPriceBreakdown(input.verifiedConfigurator.customerPrice.breakdown, input.verifiedConfigurator.design.roof.infills),
          } } : {}),
          depthM: Number.isFinite(effectiveDepthM ?? NaN) ? Number(effectiveDepthM) : 0,
          heightM: Number.isFinite(effectiveHeightM ?? NaN) ? Number(effectiveHeightM) : 0,
          style: formatStyleLabel(effectiveStyle),
          roof: formatRoofLabel(effectiveRoofMaterials),
          addons,
          blindsSelected,
          ...(verifiedSimpleCover
            ? {
                simpleCoverEstimate: {
                  level: verifiedSimpleCover.level,
                  connection: verifiedSimpleCover.connection,
                },
              }
            : {}),
          ...(budgets.baseRange ? { baseRange: budgets.baseRange } : {}),
          ...(budgets.blindsRange ? { blindsRange: budgets.blindsRange } : {}),
        } satisfies ResidentialOrCommercialEnquiry;
      }

      const callWindowText = getCallWindowText(submittedAt);

      const templateId = selectEnquiryEmailTemplate(enquiryType as EnquiryAudience, customerBrief);

      const subject = websiteAutoresponderSubject(
        templateId,
        emailPayload as unknown as Record<string, unknown>,
      );

      const emailType =
        enquiryType === 'professional' ? 'WEBSITE_PROFESSIONAL_AUTORESPONDER' : 'WEBSITE_ESTIMATE_AUTORESPONDER';


  const variables = JSON.parse(JSON.stringify({ ...emailPayload, callWindowText })) as Record<string, unknown>;
  return { emailPayload, resolvedAttachments, templateId, subject, emailType, variables };
}
