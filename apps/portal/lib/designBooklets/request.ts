import "server-only";

import sharp, { type Metadata } from "sharp";
import {
  DESIGN_BOOKLET_DEFAULT_ASSET_IDS,
  DESIGN_BOOKLET_DRAWING_LAYOUT_IDS,
  DESIGN_BOOKLET_DRAWING_TITLE_PRESET_IDS,
  DESIGN_BOOKLET_FOCAL_POINT_IDS,
  DESIGN_BOOKLET_MATERIAL_IDS,
  DESIGN_BOOKLET_ROOF_FORM_IDS,
  DESIGN_BOOKLET_SCHEMA_VERSION,
  type DesignBookletAssetSource,
  type DesignBookletContentPage,
  type DesignBookletDefaultAssetId,
  type DesignBookletDraft,
  type DesignBookletDrawingItem,
  type DesignBookletDrawingLayoutId,
  type DesignBookletDrawingPage,
  type DesignBookletDrawingTitle,
  type DesignBookletFocalPointId,
  type DesignBookletImage,
  type DesignBookletImagePlacement,
  type DesignBookletImages,
  type DesignBookletMaterialId,
  type DesignBookletRoofFormId,
} from "./types";
import { TONI_DESIGN_BOOKLET_ASSETS } from "./defaults";
import {
  currentDesignBookletIssueDate,
  DESIGN_BOOKLET_MAX_DRAWING_PAGE_TITLE_LENGTH,
  DESIGN_BOOKLET_MAX_DRAWING_REVISION_LENGTH,
  DESIGN_BOOKLET_MAX_IMAGE_BYTES,
  DESIGN_BOOKLET_MAX_CONTENT_PAGES,
  normalizeDesignBookletSheetTitle,
  renderableDesignBookletAssetSources,
} from "./pageModel";
import { readDesignBookletDefaultImage } from "./pdfAssets";

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
  readonly status: 400 | 413;

  constructor(message: string, status: 400 | 413 = 400) {
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
  return {
    id: stableId(value.id, context, ids),
    image: parseAssetSource(value.image, context, ids),
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
    return {
      id,
      kind: "image",
      image: parseImagePlacement(value.image, context, ids),
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
    customerName: requiredText(value.customerName, "Customer name", 80),
    projectTitle: requiredText(value.projectTitle, "Booklet title", 120),
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
  const allowedUploadKeys = new Set(
    assets.map((asset) => `asset:${asset.assetId}`),
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
  return {
    draft,
    images: Object.fromEntries(
      entries.filter(
        (entry): entry is readonly [string, DesignBookletImage] =>
          entry[1] !== null,
      ),
    ),
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
