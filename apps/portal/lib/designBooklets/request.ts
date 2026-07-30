import "server-only";

import {
  DESIGN_BOOKLET_MATERIAL_IDS,
  DESIGN_BOOKLET_RENDER_IDS,
  DESIGN_BOOKLET_ROOF_FORM_IDS,
  type DesignBookletAssetId,
  type DesignBookletDraft,
  type DesignBookletImage,
  type DesignBookletImages,
  type DesignBookletMaterialId,
  type DesignBookletRenderId,
  type DesignBookletRoofFormId,
} from "./types";
import {
  TONI_DESIGN_BOOKLET_ASSETS,
  TONI_DESIGN_BOOKLET_DRAFT,
} from "./defaults";
import { readDesignBookletDefaultImage } from "./pdfAssets";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ASSET_IDS: DesignBookletAssetId[] = [
  ...DESIGN_BOOKLET_RENDER_IDS,
  "plan",
];
const supportedMediaTypes = new Set(["image/png", "image/jpeg"]);

export class DesignBookletRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesignBookletRequestError";
  }
}

function cleanText(
  value: unknown,
  fallback: string,
  maxLength: number,
): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}

function isRoofFormId(value: unknown): value is DesignBookletRoofFormId {
  return DESIGN_BOOKLET_ROOF_FORM_IDS.includes(
    value as DesignBookletRoofFormId,
  );
}

function isMaterialId(value: unknown): value is DesignBookletMaterialId {
  return DESIGN_BOOKLET_MATERIAL_IDS.includes(value as DesignBookletMaterialId);
}

function isRenderOrder(value: unknown): value is DesignBookletRenderId[] {
  if (
    !Array.isArray(value) ||
    value.length !== DESIGN_BOOKLET_RENDER_IDS.length
  ) {
    return false;
  }
  return (
    new Set(value).size === DESIGN_BOOKLET_RENDER_IDS.length &&
    value.every((item) =>
      DESIGN_BOOKLET_RENDER_IDS.includes(item as DesignBookletRenderId),
    )
  );
}

export function parseDesignBookletDraft(raw: unknown): DesignBookletDraft {
  if (!raw || typeof raw !== "object") {
    throw new DesignBookletRequestError("Missing design booklet draft.");
  }
  const value = raw as Record<string, unknown>;

  return {
    customerName: cleanText(
      value.customerName,
      TONI_DESIGN_BOOKLET_DRAFT.customerName,
      80,
    ),
    projectTitle: cleanText(
      value.projectTitle,
      TONI_DESIGN_BOOKLET_DRAFT.projectTitle,
      120,
    ),
    roofFormId: isRoofFormId(value.roofFormId)
      ? value.roofFormId
      : TONI_DESIGN_BOOKLET_DRAFT.roofFormId,
    materialId: isMaterialId(value.materialId)
      ? value.materialId
      : TONI_DESIGN_BOOKLET_DRAFT.materialId,
    renderOrder: isRenderOrder(value.renderOrder)
      ? [...value.renderOrder]
      : [...TONI_DESIGN_BOOKLET_DRAFT.renderOrder],
  };
}

async function readDefaultAsset(
  assetId: DesignBookletAssetId,
): Promise<DesignBookletImage> {
  return {
    bytes: await readDesignBookletDefaultImage(
      TONI_DESIGN_BOOKLET_ASSETS[assetId].filename,
    ),
    mediaType: "image/png",
  };
}

async function readImageEntry(
  formData: FormData,
  assetId: DesignBookletAssetId,
): Promise<DesignBookletImage> {
  const entry = formData.get(`asset:${assetId}`);
  if (!entry || typeof entry === "string") return readDefaultAsset(assetId);
  if (entry.size === 0) return readDefaultAsset(assetId);
  if (entry.size > MAX_IMAGE_BYTES) {
    throw new DesignBookletRequestError(
      `${TONI_DESIGN_BOOKLET_ASSETS[assetId].label} must be 15 MB or smaller.`,
    );
  }
  if (!supportedMediaTypes.has(entry.type)) {
    throw new DesignBookletRequestError(
      `${TONI_DESIGN_BOOKLET_ASSETS[assetId].label} must be a PNG or JPEG image.`,
    );
  }
  if (typeof entry.arrayBuffer !== "function") {
    throw new DesignBookletRequestError(
      `${TONI_DESIGN_BOOKLET_ASSETS[assetId].label} could not be read.`,
    );
  }
  return {
    bytes: new Uint8Array(await entry.arrayBuffer()),
    mediaType: entry.type as DesignBookletImage["mediaType"],
  };
}

export async function parseDesignBookletFormData(formData: FormData): Promise<{
  draft: DesignBookletDraft;
  images: DesignBookletImages;
}> {
  const draftValue = formData.get("draft");
  if (typeof draftValue !== "string") {
    throw new DesignBookletRequestError("Missing design booklet draft.");
  }

  let parsedDraft: unknown;
  try {
    parsedDraft = JSON.parse(draftValue);
  } catch {
    throw new DesignBookletRequestError("Invalid design booklet draft.");
  }

  const entries = await Promise.all(
    ASSET_IDS.map(
      async (assetId) =>
        [assetId, await readImageEntry(formData, assetId)] as const,
    ),
  );
  return {
    draft: parseDesignBookletDraft(parsedDraft),
    images: Object.fromEntries(entries) as DesignBookletImages,
  };
}

export async function loadToniDesignBookletImages(): Promise<DesignBookletImages> {
  const entries = await Promise.all(
    ASSET_IDS.map(
      async (assetId) => [assetId, await readDefaultAsset(assetId)] as const,
    ),
  );
  return Object.fromEntries(entries) as DesignBookletImages;
}
