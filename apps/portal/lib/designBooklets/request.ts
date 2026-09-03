import "server-only";

import { PDFDocument } from "pdf-lib";
import type { Metadata } from "sharp";
import {
  DESIGN_BOOKLET_DEFAULT_ASSET_IDS,
  DESIGN_BOOKLET_CONTENT_LAYOUT_IDS,
  DESIGN_BOOKLET_CONTENT_VARIANT_IDS,
  DESIGN_BOOKLET_DRAWING_LAYOUT_IDS,
  DESIGN_BOOKLET_DRAWING_TITLE_PRESET_IDS,
  DESIGN_BOOKLET_FOCAL_POINT_IDS,
  DESIGN_BOOKLET_MATERIAL_IDS,
  DESIGN_BOOKLET_PAPER_SIZE_IDS,
  DESIGN_BOOKLET_ROOF_FORM_IDS,
  DESIGN_BOOKLET_SCHEMA_VERSION,
  DESIGN_BOOKLET_TEXT_SIZE_IDS,
  type DesignBookletAssetSource,
  type DesignBookletContentPage,
  type DesignBookletContentImage,
  type DesignBookletContentLayoutId,
  type DesignBookletContentVariantId,
  type DesignBookletDefaultAssetId,
  type DesignBookletDraft,
  type DesignBookletDrawingItem,
  type DesignBookletDrawingLayoutId,
  type DesignBookletDrawingPage,
  type DesignBookletDrawingTitle,
  type DesignBookletFocalPointId,
  type DesignBookletImage,
  type DesignBookletImagePage,
  type DesignBookletImagePlacement,
  type DesignBookletImages,
  type DesignBookletMaterialId,
  type DesignBookletPaperSizeId,
  type DesignBookletRoofFormId,
  type DesignBookletTextSizeId,
  type DesignBookletPdfDocument,
  type DesignBookletPdfDocuments,
} from "./types";
import { TONI_DESIGN_BOOKLET_ASSETS } from "./defaults";
import { DESIGN_BOOKLET_DEFAULT_PAPER_SIZE } from "./paperGeometry";
import {
  currentDesignBookletIssueDate,
  DESIGN_BOOKLET_MAX_DRAWING_PAGE_TITLE_LENGTH,
  DESIGN_BOOKLET_MAX_DRAWING_REVISION_LENGTH,
  DESIGN_BOOKLET_MAX_CONTENT_BODY_LENGTH,
  DESIGN_BOOKLET_MAX_CONTENT_CAPTION_LENGTH,
  DESIGN_BOOKLET_MAX_CONTENT_EYEBROW_LENGTH,
  DESIGN_BOOKLET_MAX_CONTENT_HEADLINE_LENGTH,
  DESIGN_BOOKLET_MAX_CONTENT_SECTION_BODY_LENGTH,
  DESIGN_BOOKLET_MAX_CONTENT_SECTION_HEADING_LENGTH,
  DESIGN_BOOKLET_MAX_IMAGE_BYTES,
  DESIGN_BOOKLET_MAX_PDF_BYTES,
  DESIGN_BOOKLET_MAX_PDF_PAGES,
  DESIGN_BOOKLET_MAX_CONTENT_PAGES,
  designBookletDrawingPdfSources,
  normalizeDesignBookletSheetTitle,
  renderableDesignBookletAssetSources,
} from "./pageModel";
import { readDesignBookletDefaultImage } from "./pdfAssets";
import { loadDesignBookletSharp } from "./sharpRuntime";
import {
  defaultDesignBookletContentVariant,
  isDesignBookletContentScale,
  type DesignBookletContentScaleRole,
} from "./contentPresentation";

export { DESIGN_BOOKLET_MAX_IMAGE_BYTES } from "./pageModel";
const DESIGN_BOOKLET_MAX_TOTAL_UPLOAD_BYTES = 120 * 1024 * 1024;
export const DESIGN_BOOKLET_MAX_REQUEST_BODY_BYTES =
  DESIGN_BOOKLET_MAX_TOTAL_UPLOAD_BYTES + 8 * 1024 * 1024;
const DESIGN_BOOKLET_MAX_IMAGE_DIMENSION = 12_000;
const DESIGN_BOOKLET_MAX_IMAGE_PIXELS = 50_000_000;
export const DESIGN_BOOKLET_MAX_CUSTOM_TITLE_LENGTH = 80;

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const supportedMediaTypes = new Set(["image/png", "image/jpeg"]);

export class DesignBookletRequestError extends Error {
  readonly status: 400 | 413 | 503;

  constructor(message: string, status: 400 | 413 | 503 = 400) {
    super(message);
    this.name = "DesignBookletRequestError";
    this.status = status;
  }
}

function valueRecord(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DesignBookletRequestError(`${context} is invalid.`);
  }
  return value as Record<string, unknown>;
}

function requiredText(
  value: unknown,
  context: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new DesignBookletRequestError(`${context} is required.`);
  }
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    throw new DesignBookletRequestError(`${context} is required.`);
  }
  if (cleaned.length > maxLength) {
    throw new DesignBookletRequestError(
      `${context} must be ${maxLength} characters or fewer.`,
    );
  }
  return cleaned;
}

function requiredMultilineText(
  value: unknown,
  context: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new DesignBookletRequestError(`${context} is required.`);
  }
  const cleaned = value
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  if (!cleaned) {
    throw new DesignBookletRequestError(`${context} is required.`);
  }
  if (cleaned.length > maxLength) {
    throw new DesignBookletRequestError(
      `${context} must be ${maxLength} characters or fewer.`,
    );
  }
  return cleaned;
}

function optionalText(
  value: unknown,
  context: string,
  maxLength: number,
): string {
  if (value === undefined) return "";
  if (typeof value !== "string") {
    throw new DesignBookletRequestError(`${context} is invalid.`);
  }
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length > maxLength) {
    throw new DesignBookletRequestError(
      `${context} must be ${maxLength} characters or fewer.`,
    );
  }
  return cleaned;
}

function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function stableId(value: unknown, context: string, ids: Set<string>): string {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new DesignBookletRequestError(
      `${context} has an invalid identifier.`,
    );
  }
  if (ids.has(value)) {
    throw new DesignBookletRequestError(`${context} identifier is duplicated.`);
  }
  ids.add(value);
  return value;
}

function isRoofFormId(value: unknown): value is DesignBookletRoofFormId {
  return DESIGN_BOOKLET_ROOF_FORM_IDS.includes(
    value as DesignBookletRoofFormId,
  );
}

function isMaterialId(value: unknown): value is DesignBookletMaterialId {
  return DESIGN_BOOKLET_MATERIAL_IDS.includes(value as DesignBookletMaterialId);
}

function isPaperSizeId(value: unknown): value is DesignBookletPaperSizeId {
  return DESIGN_BOOKLET_PAPER_SIZE_IDS.includes(
    value as DesignBookletPaperSizeId,
  );
}

function isDefaultAssetId(
  value: unknown,
): value is DesignBookletDefaultAssetId {
  return DESIGN_BOOKLET_DEFAULT_ASSET_IDS.includes(
    value as DesignBookletDefaultAssetId,
  );
}

function isFocalPointId(value: unknown): value is DesignBookletFocalPointId {
  return DESIGN_BOOKLET_FOCAL_POINT_IDS.includes(
    value as DesignBookletFocalPointId,
  );
}

function isDrawingLayoutId(
  value: unknown,
): value is DesignBookletDrawingLayoutId {
  return DESIGN_BOOKLET_DRAWING_LAYOUT_IDS.includes(
    value as DesignBookletDrawingLayoutId,
  );
}

function isContentLayoutId(
  value: unknown,
): value is DesignBookletContentLayoutId {
  return DESIGN_BOOKLET_CONTENT_LAYOUT_IDS.includes(
    value as DesignBookletContentLayoutId,
  );
}

function isContentVariantId(
  value: unknown,
): value is DesignBookletContentVariantId {
  return DESIGN_BOOKLET_CONTENT_VARIANT_IDS.includes(
    value as DesignBookletContentVariantId,
  );
}

function isTextSizeId(value: unknown): value is DesignBookletTextSizeId {
  return DESIGN_BOOKLET_TEXT_SIZE_IDS.includes(
    value as DesignBookletTextSizeId,
  );
}

function contentScale(
  value: unknown,
  role: DesignBookletContentScaleRole,
  context: string,
) {
  if (value === undefined) return 100;
  if (!isDesignBookletContentScale(role, value)) {
    throw new DesignBookletRequestError(
      `${context} has an invalid ${role} scale.`,
    );
  }
  return value;
}

function parseAssetSource(
  raw: unknown,
  context: string,
  ids: Set<string>,
): DesignBookletAssetSource {
  const value = valueRecord(raw, context);
  const defaultAssetId = value.defaultAssetId;
  if (!isDefaultAssetId(defaultAssetId)) {
    throw new DesignBookletRequestError(
      `${context} has an invalid default image.`,
    );
  }
  if (
    value.useDefaultAsset !== undefined &&
    typeof value.useDefaultAsset !== "boolean"
  ) {
    throw new DesignBookletRequestError(
      `${context} has an invalid default-image setting.`,
    );
  }
  return {
    assetId: stableId(value.assetId, `${context} image`, ids),
    defaultAssetId,
    ...(value.useDefaultAsset === false ? { useDefaultAsset: false } : {}),
    altText: requiredText(value.altText, `${context} image description`, 240),
  };
}

function parseImagePlacement(
  raw: unknown,
  context: string,
  ids: Set<string>,
): DesignBookletImagePlacement {
  const value = valueRecord(raw, context);
  if (!isFocalPointId(value.focalPoint)) {
    throw new DesignBookletRequestError(
      `${context} has an invalid image focus.`,
    );
  }
  return {
    ...parseAssetSource(value, context, ids),
    focalPoint: value.focalPoint,
  };
}

function parseContentImage(
  raw: unknown,
  context: string,
  ids: Set<string>,
): DesignBookletContentImage {
  const value = valueRecord(raw, context);
  return {
    ...parseImagePlacement(value, context, ids),
    caption: optionalText(
      value.caption,
      `${context} caption`,
      DESIGN_BOOKLET_MAX_CONTENT_CAPTION_LENGTH,
    ),
  };
}

function parseEditorialContent(raw: unknown, context: string) {
  if (raw === undefined) {
    return {
      eyebrow: "",
      headline: "",
      body: "",
      headlineSize: "standard" as const,
      bodySize: "standard" as const,
      headlineScale: 100,
      bodyScale: 100,
      eyebrowScale: 100,
      captionScale: 100,
      sections: [
        { heading: "Section one", body: "" },
        { heading: "Section two", body: "" },
      ] as [
        { heading: string; body: string },
        { heading: string; body: string },
      ],
    };
  }
  const value = valueRecord(raw, context);
  if (!isTextSizeId(value.headlineSize) || !isTextSizeId(value.bodySize)) {
    throw new DesignBookletRequestError(`${context} has an invalid text size.`);
  }
  if (!Array.isArray(value.sections) || value.sections.length !== 2) {
    throw new DesignBookletRequestError(
      `${context} must provide two reusable sections.`,
    );
  }
  const sections = value.sections.map((rawSection, index) => {
    const section = valueRecord(rawSection, `${context}, section ${index + 1}`);
    return {
      heading: optionalText(
        section.heading,
        `${context}, section ${index + 1} heading`,
        DESIGN_BOOKLET_MAX_CONTENT_SECTION_HEADING_LENGTH,
      ),
      body: optionalText(
        section.body,
        `${context}, section ${index + 1} copy`,
        DESIGN_BOOKLET_MAX_CONTENT_SECTION_BODY_LENGTH,
      ),
    };
  }) as [{ heading: string; body: string }, { heading: string; body: string }];
  return {
    eyebrow: optionalText(
      value.eyebrow,
      `${context} eyebrow`,
      DESIGN_BOOKLET_MAX_CONTENT_EYEBROW_LENGTH,
    ),
    headline: optionalText(
      value.headline,
      `${context} headline`,
      DESIGN_BOOKLET_MAX_CONTENT_HEADLINE_LENGTH,
    ),
    body: optionalText(
      value.body,
      `${context} body`,
      DESIGN_BOOKLET_MAX_CONTENT_BODY_LENGTH,
    ),
    headlineSize: value.headlineSize,
    bodySize: value.bodySize,
    headlineScale: contentScale(value.headlineScale, "headline", context),
    bodyScale: contentScale(value.bodyScale, "body", context),
    eyebrowScale: contentScale(value.eyebrowScale, "eyebrow", context),
    captionScale: contentScale(value.captionScale, "caption", context),
    sections,
  };
}

function parseDrawingTitle(
  raw: unknown,
  context: string,
): DesignBookletDrawingTitle {
  const value = valueRecord(raw, context);
  if (
    value.kind === "preset" &&
    DESIGN_BOOKLET_DRAWING_TITLE_PRESET_IDS.includes(
      value.value as (typeof DESIGN_BOOKLET_DRAWING_TITLE_PRESET_IDS)[number],
    )
  ) {
    return {
      kind: "preset",
      value:
        value.value as (typeof DESIGN_BOOKLET_DRAWING_TITLE_PRESET_IDS)[number],
    };
  }
  if (value.kind === "custom") {
    return {
      kind: "custom",
      value: requiredText(
        value.value,
        `${context} custom title`,
        DESIGN_BOOKLET_MAX_CUSTOM_TITLE_LENGTH,
      ),
    };
  }
  throw new DesignBookletRequestError(`${context} title is invalid.`);
}

function parseDrawingItem(
  raw: unknown,
  context: string,
  ids: Set<string>,
): DesignBookletDrawingItem {
  const value = valueRecord(raw, context);
  const pdf =
    value.pdf === undefined
      ? undefined
      : (() => {
          const source = valueRecord(value.pdf, `${context} PDF`);
          const pageNumber = Number(source.pageNumber);
          const pageCount = Number(source.pageCount);
          if (
            !Number.isSafeInteger(pageCount) ||
            pageCount < 1 ||
            pageCount > DESIGN_BOOKLET_MAX_PDF_PAGES ||
            !Number.isSafeInteger(pageNumber) ||
            pageNumber < 1 ||
            pageNumber > pageCount
          ) {
            throw new DesignBookletRequestError(
              `${context} PDF page is invalid.`,
            );
          }
          return {
            assetId: stableId(source.assetId, `${context} PDF`, ids),
            fileName: requiredText(
              source.fileName,
              `${context} PDF file name`,
              160,
            ),
            pageNumber,
            pageCount,
          };
        })();
  return {
    id: stableId(value.id, context, ids),
    image: parseAssetSource(value.image, context, ids),
    ...(pdf ? { pdf } : {}),
    title: parseDrawingTitle(value.title, context),
  };
}

function parseContentPage(
  raw: unknown,
  index: number,
  ids: Set<string>,
): DesignBookletContentPage {
  const context = `Content page ${index + 1}`;
  const value = valueRecord(raw, context);
  const id = stableId(value.id, context, ids);

  if (value.kind === "image") {
    const layout =
      value.layout === undefined
        ? "visual-full-bleed"
        : isContentLayoutId(value.layout)
          ? value.layout
          : null;
    if (!layout) {
      throw new DesignBookletRequestError(
        `${context} has an invalid content layout.`,
      );
    }
    const variant =
      value.variant === undefined
        ? defaultDesignBookletContentVariant(layout)
        : isContentVariantId(value.variant)
          ? value.variant
          : null;
    if (!variant) {
      throw new DesignBookletRequestError(
        `${context} has an invalid content variant.`,
      );
    }
    let images: DesignBookletImagePage["images"];
    if (Array.isArray(value.images)) {
      if (value.images.length !== 4) {
        throw new DesignBookletRequestError(
          `${context} must provide four reusable image slots.`,
        );
      }
      images = value.images.map((image, imageIndex) =>
        parseContentImage(image, `${context}, image ${imageIndex + 1}`, ids),
      ) as DesignBookletImagePage["images"];
    } else {
      const legacyImage = parseContentImage(value.image, context, ids);
      images = [
        legacyImage,
        ...([2, 3, 4].map((slot) => {
          const assetId = `${id}-image-${slot}`;
          stableId(assetId, `${context}, image ${slot}`, ids);
          return {
            ...legacyImage,
            assetId,
            useDefaultAsset: false,
            altText: `Additional customer image ${slot}`,
            caption: "",
          };
        }) as [
          DesignBookletContentImage,
          DesignBookletContentImage,
          DesignBookletContentImage,
        ]),
      ];
    }
    return {
      id,
      kind: "image",
      layout,
      variant,
      images,
      content: parseEditorialContent(value.content, `${context} copy`),
    };
  }

  if (value.kind === "drawings") {
    if (!isDrawingLayoutId(value.layout)) {
      throw new DesignBookletRequestError(
        `${context} has an invalid drawing layout.`,
      );
    }
    if (!Array.isArray(value.drawings) || value.drawings.length !== 4) {
      throw new DesignBookletRequestError(
        `${context} must provide four reusable drawing slots.`,
      );
    }
    const issueDate =
      typeof value.issueDate === "undefined"
        ? currentDesignBookletIssueDate()
        : requiredText(value.issueDate, `${context} issue date`, 10);
    if (!isIsoCalendarDate(issueDate)) {
      throw new DesignBookletRequestError(
        `${context} issue date must use YYYY-MM-DD.`,
      );
    }
    return {
      id,
      kind: "drawings",
      pageTitle:
        typeof value.pageTitle === "undefined"
          ? "CONCEPT DRAWINGS"
          : normalizeDesignBookletSheetTitle(
              requiredText(
                value.pageTitle,
                `${context} title`,
                DESIGN_BOOKLET_MAX_DRAWING_PAGE_TITLE_LENGTH,
              ),
            ),
      revision:
        typeof value.revision === "undefined"
          ? "01"
          : requiredText(
              value.revision,
              `${context} revision`,
              DESIGN_BOOKLET_MAX_DRAWING_REVISION_LENGTH,
            ),
      issueDate,
      layout: value.layout,
      drawings: value.drawings.map((drawing, drawingIndex) =>
        parseDrawingItem(
          drawing,
          `${context}, drawing ${drawingIndex + 1}`,
          ids,
        ),
      ) as DesignBookletDrawingPage["drawings"],
    };
  }

  throw new DesignBookletRequestError(`${context} has an invalid page type.`);
}

export function parseDesignBookletDraft(raw: unknown): DesignBookletDraft {
  const value = valueRecord(raw, "Design booklet draft");
  if (value.schemaVersion !== DESIGN_BOOKLET_SCHEMA_VERSION) {
    throw new DesignBookletRequestError(
      "The design booklet draft version is unsupported.",
    );
  }
  if (!isRoofFormId(value.roofFormId)) {
    throw new DesignBookletRequestError("Roof form is invalid.");
  }
  if (!isMaterialId(value.materialId)) {
    throw new DesignBookletRequestError("Roofing choice is invalid.");
  }
  const paperSize = value.paperSize ?? DESIGN_BOOKLET_DEFAULT_PAPER_SIZE;
  if (!isPaperSizeId(paperSize)) {
    throw new DesignBookletRequestError("Paper size is invalid.");
  }
  if (!Array.isArray(value.contentPages)) {
    throw new DesignBookletRequestError("Content pages are invalid.");
  }
  if (value.contentPages.length > DESIGN_BOOKLET_MAX_CONTENT_PAGES) {
    throw new DesignBookletRequestError(
      `A booklet can contain up to ${DESIGN_BOOKLET_MAX_CONTENT_PAGES} content pages.`,
    );
  }

  const ids = new Set<string>();
  const reviewPage = valueRecord(value.reviewPage, "Review page");
  return {
    schemaVersion: DESIGN_BOOKLET_SCHEMA_VERSION,
    paperSize,
    customerName: requiredText(value.customerName, "Customer name", 80),
    projectTitle: requiredMultilineText(
      value.projectTitle,
      "Booklet title",
      120,
    ),
    roofFormId: value.roofFormId,
    materialId: value.materialId,
    cover: parseImagePlacement(value.cover, "Cover", ids),
    contentPages: value.contentPages.map((page, index) =>
      parseContentPage(page, index, ids),
    ),
    reviewPage: {
      image: parseImagePlacement(reviewPage.image, "Review page", ids),
    },
  };
}

async function readDefaultAsset(
  asset: DesignBookletAssetSource,
): Promise<DesignBookletImage> {
  const definition = TONI_DESIGN_BOOKLET_ASSETS[asset.defaultAssetId];
  return {
    bytes: await readDesignBookletDefaultImage(definition.filename),
    mediaType: definition.mediaType,
  };
}

async function readUploadedImage(
  entry: File,
  context: string,
): Promise<DesignBookletImage> {
  if (entry.size === 0) {
    throw new DesignBookletRequestError(`${context} is empty.`);
  }
  if (entry.size > DESIGN_BOOKLET_MAX_IMAGE_BYTES) {
    throw new DesignBookletRequestError(
      `${context} must be 15 MB or smaller.`,
      413,
    );
  }
  if (!supportedMediaTypes.has(entry.type)) {
    throw new DesignBookletRequestError(
      `${context} must be a PNG or JPEG image.`,
    );
  }
  if (typeof entry.arrayBuffer !== "function") {
    throw new DesignBookletRequestError(`${context} could not be read.`);
  }

  const bytes = new Uint8Array(await entry.arrayBuffer());
  let sharp: Awaited<ReturnType<typeof loadDesignBookletSharp>>;
  try {
    sharp = await loadDesignBookletSharp();
  } catch {
    throw new DesignBookletRequestError(
      "Image processing is temporarily unavailable.",
      503,
    );
  }
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, {
      limitInputPixels: DESIGN_BOOKLET_MAX_IMAGE_PIXELS,
    }).metadata();
  } catch {
    throw new DesignBookletRequestError(
      `${context} is not a readable PNG or JPEG image.`,
    );
  }

  const expectedFormat = entry.type === "image/png" ? "png" : "jpeg";
  if (metadata.format !== expectedFormat) {
    throw new DesignBookletRequestError(
      `${context} content does not match its file type.`,
    );
  }
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > DESIGN_BOOKLET_MAX_IMAGE_DIMENSION ||
    metadata.height > DESIGN_BOOKLET_MAX_IMAGE_DIMENSION ||
    metadata.width * metadata.height > DESIGN_BOOKLET_MAX_IMAGE_PIXELS
  ) {
    throw new DesignBookletRequestError(
      `${context} dimensions are too large.`,
      413,
    );
  }

  let normalizedBytes = bytes;
  if (metadata.orientation && metadata.orientation !== 1) {
    try {
      const normalized = sharp(bytes, {
        limitInputPixels: DESIGN_BOOKLET_MAX_IMAGE_PIXELS,
      }).rotate();
      normalizedBytes = new Uint8Array(
        entry.type === "image/png"
          ? await normalized.png().toBuffer()
          : await normalized.jpeg({ quality: 92 }).toBuffer(),
      );
    } catch {
      throw new DesignBookletRequestError(
        `${context} orientation could not be normalized.`,
      );
    }
  }

  return {
    bytes: normalizedBytes,
    mediaType: entry.type as DesignBookletImage["mediaType"],
  };
}

async function readUploadedPdf(
  entry: File,
  context: string,
): Promise<{ document: DesignBookletPdfDocument; pageCount: number }> {
  if (entry.size === 0) {
    throw new DesignBookletRequestError(`${context} is empty.`);
  }
  if (entry.size > DESIGN_BOOKLET_MAX_PDF_BYTES) {
    throw new DesignBookletRequestError(
      `${context} must be 20 MB or smaller.`,
      413,
    );
  }
  if (entry.type !== "application/pdf") {
    throw new DesignBookletRequestError(`${context} must be a PDF.`);
  }
  const bytes = new Uint8Array(await entry.arrayBuffer());
  try {
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    const pageCount = pdf.getPageCount();
    if (pageCount < 1 || pageCount > DESIGN_BOOKLET_MAX_PDF_PAGES) {
      throw new DesignBookletRequestError(
        `${context} must contain between 1 and ${DESIGN_BOOKLET_MAX_PDF_PAGES} pages.`,
      );
    }
    return { document: { bytes }, pageCount };
  } catch (error) {
    if (error instanceof DesignBookletRequestError) throw error;
    throw new DesignBookletRequestError(
      `${context} is encrypted, damaged, or not a readable PDF.`,
    );
  }
}

async function readImageEntry(
  formData: FormData,
  asset: DesignBookletAssetSource,
): Promise<DesignBookletImage | null> {
  const key = `asset:${asset.assetId}`;
  const entries = formData.getAll(key);
  if (entries.length > 1) {
    throw new DesignBookletRequestError(
      `${asset.altText} was uploaded more than once.`,
    );
  }
  const entry = entries[0];
  if (entry === undefined) {
    return asset.useDefaultAsset === false ? null : readDefaultAsset(asset);
  }
  if (typeof entry === "string") {
    throw new DesignBookletRequestError(`${asset.altText} is invalid.`);
  }
  return readUploadedImage(entry, asset.altText);
}

function uploadedAssetEntries(formData: FormData): Array<[string, File]> {
  const uploads: Array<[string, File]> = [];
  for (const [key, entry] of formData.entries()) {
    if (!key.startsWith("asset:")) continue;
    if (typeof entry === "string") {
      throw new DesignBookletRequestError("Uploaded image data is invalid.");
    }
    uploads.push([key, entry]);
  }
  return uploads;
}

export async function parseDesignBookletFormData(formData: FormData): Promise<{
  draft: DesignBookletDraft;
  images: DesignBookletImages;
  documents: DesignBookletPdfDocuments;
}> {
  const draftValues = formData.getAll("draft");
  if (draftValues.length !== 1 || typeof draftValues[0] !== "string") {
    throw new DesignBookletRequestError("Missing design booklet draft.");
  }

  let parsedDraft: unknown;
  try {
    parsedDraft = JSON.parse(draftValues[0]);
  } catch {
    throw new DesignBookletRequestError("Invalid design booklet draft.");
  }
  const draft = parseDesignBookletDraft(parsedDraft);
  const assets = renderableDesignBookletAssetSources(draft);
  const documents = designBookletDrawingPdfSources(draft);
  const allowedUploadKeys = new Set(
    [...assets, ...documents].map((asset) => `asset:${asset.assetId}`),
  );
  const uploads = uploadedAssetEntries(formData);
  for (const [key] of uploads) {
    if (!allowedUploadKeys.has(key)) {
      throw new DesignBookletRequestError(
        "The request contains an image that is not used by this booklet.",
      );
    }
  }
  const totalUploadBytes = uploads.reduce(
    (total, [, entry]) => total + entry.size,
    0,
  );
  if (totalUploadBytes > DESIGN_BOOKLET_MAX_TOTAL_UPLOAD_BYTES) {
    throw new DesignBookletRequestError(
      "The combined image upload must be 120 MB or smaller.",
      413,
    );
  }

  const entries = await Promise.all(
    assets.map(
      async (asset) =>
        [asset.assetId, await readImageEntry(formData, asset)] as const,
    ),
  );
  const documentEntries = await Promise.all(
    documents.map(async (document) => {
      const key = `asset:${document.assetId}`;
      const values = formData.getAll(key);
      if (values.length !== 1 || typeof values[0] === "string") {
        throw new DesignBookletRequestError(
          `${document.fileName} PDF data is missing or invalid.`,
        );
      }
      const uploaded = await readUploadedPdf(values[0], document.fileName);
      if (uploaded.pageCount !== document.pageCount) {
        throw new DesignBookletRequestError(
          `${document.fileName} page count does not match the booklet draft.`,
        );
      }
      return [document.assetId, uploaded.document] as const;
    }),
  );
  return {
    draft,
    images: Object.fromEntries(
      entries.filter(
        (entry): entry is readonly [string, DesignBookletImage] =>
          entry[1] !== null,
      ),
    ),
    documents: Object.fromEntries(documentEntries),
  };
}

export async function loadToniDesignBookletImages(
  draft: DesignBookletDraft,
): Promise<DesignBookletImages> {
  const entries = await Promise.all(
    renderableDesignBookletAssetSources(draft)
      .filter((asset) => asset.useDefaultAsset !== false)
      .map(
        async (asset) =>
          [asset.assetId, await readDefaultAsset(asset)] as const,
      ),
  );
  return Object.fromEntries(entries);
}
