import type { QuoteLineItem, QuoteVersionDetail } from "@/lib/quotes/types";
import type { QuoteRefreshMode } from "@/lib/quotes/refresh";
import type { EstimateMeta } from "@/lib/estimates/types";
import {
  formatPortalDate,
  formatPortalDateTime,
} from "@/lib/format/portalDateTime";

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const MAX_ATTACHMENTS_TOTAL_BYTES = 4 * 1024 * 1024;
export const MAX_ATTACHMENT_COUNT = 10;
export const QUOTE_PREVIEW_DEBOUNCE_MS = 200;
export const ATTACHMENT_INPUT_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export type SendEditorMode = "compose" | "review";

export function selectEstimateForCommercialScope(
  estimates: EstimateMeta[],
  commercialScopeId: string | null,
): EstimateMeta | null {
  const sameScope = estimates
    .filter((estimate) => (estimate.commercialScopeId ?? null) === commercialScopeId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return sameScope.find((estimate) => estimate.isActiveDraft) ?? sameScope[0] ?? null;
}

export function formatMoneyFromCents(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `$${(value / 100).toFixed(2)}`;
}

export function formatDateShort(value: string | null | undefined): string {
  return formatPortalDate(value);
}

export function formatDateTime(value: string | null | undefined): string {
  return formatPortalDateTime(value);
}

export function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expiry = parseDateLocal(expiresAt);
  if (!expiry) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return today > expiry;
}

export function sanitizeMoneyInput(value: string): string {
  return sanitizeDecimalInput(value);
}

export function validateQuotePreviewPdf(
  contentType: string | null,
  bytes: Uint8Array,
): string | null {
  if (!bytes.byteLength)
    return "Failed to load quote preview: empty PDF response.";
  if (!hasPdfSignature(bytes)) {
    const typeLabel = contentType?.trim() || "unknown content type";
    return `Failed to load quote preview: expected PDF bytes, received ${typeLabel}.`;
  }
  return null;
}

export function formatMoneyInputValue(valueCents: number): string {
  if (!Number.isFinite(valueCents)) return "0";
  const value = valueCents / 100;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function parseMoneyInput(value: string): number {
  const parsed = Number.parseFloat(sanitizeMoneyInput(value));
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function parseQtyInput(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function computeLineTotal(item: QuoteLineItem): number {
  const qty = Number.isFinite(item.qty) ? item.qty : 0;
  const unit = Number.isFinite(item.unitPriceIncGstCents)
    ? item.unitPriceIncGstCents
    : 0;
  return Math.round(qty * unit);
}

export function defaultPersonalNote(): string {
  return "";
}

export function defaultSubject(quoteRef: string): string {
  return `Your quote ${quoteRef}`;
}

export function validateAttachment(file: File): string | null {
  if (file.size <= 0) return `Attachment "${file.name || "file"}" is empty.`;
  if (file.size > MAX_ATTACHMENT_BYTES)
    return `Attachment "${file.name || "file"}" must be 4MB or smaller.`;
  const mime = file.type.trim().toLowerCase();
  if (ALLOWED_ATTACHMENT_MIME_TYPES.has(mime)) return null;
  const lowerName = file.name.trim().toLowerCase();
  const dot = lowerName.lastIndexOf(".");
  const extension = dot >= 0 ? lowerName.slice(dot) : "";
  if (ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) return null;
  return `Attachment "${file.name || "file"}" must be a PDF, JPG, PNG, or WEBP.`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

export async function readErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = await res.json();
      const message = typeof body?.error === "string" ? body.error.trim() : "";
      if (message) return message;
    } catch {
      // Ignore parse errors and fall through to text handling.
    }
  }
  try {
    const text = (await res.text()).trim();
    if (text) return text;
  } catch {
    // Ignore read errors and use fallback.
  }
  return fallback;
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

export function quoteDraftFilename(detail: QuoteVersionDetail): string {
  const rawBase = `${detail.quoteRef || "quote"}-v${detail.versionNumber}-draft`;
  const safeBase = rawBase
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${safeBase || "quote-draft"}.pdf`;
}

export function isPergolaLineItemDescription(value: string): boolean {
  return /\bpergola\b/i.test(String(value ?? "").split("\n")[0] ?? "");
}

export function formatRefreshModeLabel(mode: QuoteRefreshMode): string {
  switch (mode) {
    case "pricing_only":
      return "Pricing only";
    case "generated_content":
      return "Generated content only";
    default:
      return "Full rebuild";
  }
}

export function renderPersonalNoteSummary(value: string): string {
  const trimmed = value.trim();
  return trimmed || "No personal note added.";
}

function parseDateLocal(value: string): Date | null {
  const parts = value.split("-").map((part) => Number(part));
  if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  let next = "";
  let dotSeen = false;
  let decimalCount = 0;
  for (const character of cleaned) {
    if (character === ".") {
      if (dotSeen) continue;
      dotSeen = true;
      next += ".";
      continue;
    }
    if (!dotSeen) {
      next += character;
      continue;
    }
    if (decimalCount >= 2) continue;
    decimalCount += 1;
    next += character;
  }
  return next;
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}
