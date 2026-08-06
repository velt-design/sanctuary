import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { uuidFromAppId } from "@/lib/supabase/mappers";
import {
  createProjectDesignBookletDraft,
  neutralizeProjectDesignBookletMedia,
  TONI_DESIGN_BOOKLET_ASSETS,
} from "./defaults";
import { DESIGN_BOOKLET_MAX_IMAGE_BYTES } from "./pageModel";
import { readDesignBookletDefaultImage } from "./pdfAssets";
import { parseDesignBookletDraft } from "./request";
import {
  DESIGN_BOOKLET_DEFAULT_ASSET_IDS,
  type DesignBookletDefaultAssetId,
  type DesignBookletDraft,
} from "./types";
import type {
  ProjectDesignBookletAsset,
  ProjectDesignBookletSnapshot,
} from "./projectTypes";

export const PROJECT_DESIGN_BOOKLET_BUCKET = "design-booklet-assets";
const PROJECT_DESIGN_BOOKLET_MAX_ASSETS = 48;
const PROJECT_DESIGN_BOOKLET_SIGNED_URL_SECONDS = 60 * 60;

const ASSET_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const STORAGE_IMAGE_PREFIX = "images";
const MAX_IMAGE_DIMENSION = 4096;
const MAX_IMAGE_PIXELS = 50_000_000;

type ProjectRow = {
  id: string;
  name: string | null;
  contacts?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type BookletRow = {
  draft: unknown;
  revision: number;
  updated_at: string | null;
};

type AssetRow = {
  project_id: string;
  asset_key: string;
  storage_path: string;
  file_name: string;
  media_type: "image/jpeg" | "image/png";
  byte_size: number;
  width: number;
  height: number;
  updated_at: string | null;
};

export class ProjectDesignBookletError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "project_design_booklet_error",
  ) {
    super(message);
    this.name = "ProjectDesignBookletError";
  }
}

export function projectUuidFromId(projectId: string): string {
  try {
    return uuidFromAppId(projectId, "proj");
  } catch {
    throw new ProjectDesignBookletError(
      "Invalid project ID.",
      400,
      "invalid_project_id",
    );
  }
}

function normalizedAssetKey(assetId: string): string {
  const value = assetId.trim();
  if (!ASSET_KEY_PATTERN.test(value)) {
    throw new ProjectDesignBookletError(
      "Invalid booklet image reference.",
      422,
      "invalid_asset_key",
    );
  }
  return value;
}

function customerNameFromProject(project: ProjectRow): string {
  const relation = Array.isArray(project.contacts)
    ? project.contacts[0]
    : project.contacts;
  return relation?.name?.trim() || project.name?.trim() || "Customer";
}

async function loadProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ uuid: string; row: ProjectRow }> {
  const uuid = projectUuidFromId(projectId);
  const result = await supabase
    .from("projects")
    .select("id, name, contacts ( name )")
    .eq("id", uuid)
    .maybeSingle();
  if (result.error) {
    throw new ProjectDesignBookletError(
      "The project could not be loaded.",
      500,
      "project_load_failed",
    );
  }
  if (!result.data) {
    throw new ProjectDesignBookletError(
      "Project not found.",
      404,
      "project_not_found",
    );
  }
  return { uuid, row: result.data as ProjectRow };
}

async function signedAsset(
  supabase: SupabaseClient,
  row: AssetRow,
): Promise<ProjectDesignBookletAsset> {
  const signed = await supabase.storage
    .from(PROJECT_DESIGN_BOOKLET_BUCKET)
    .createSignedUrl(
      row.storage_path,
      PROJECT_DESIGN_BOOKLET_SIGNED_URL_SECONDS,
    );
  if (signed.error || !signed.data?.signedUrl) {
    throw new ProjectDesignBookletError(
      "A saved booklet image could not be opened.",
      500,
      "asset_sign_failed",
    );
  }
  return {
    assetId: row.asset_key,
    src: signed.data.signedUrl,
    label: row.file_name,
    mediaType: row.media_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    updatedAt: row.updated_at,
  };
}

export async function loadProjectDesignBooklet(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectDesignBookletSnapshot> {
  const project = await loadProject(supabase, projectId);
  const [bookletResult, assetsResult] = await Promise.all([
    supabase
      .from("project_design_booklets")
      .select("draft, revision, updated_at")
      .eq("project_id", project.uuid)
      .maybeSingle(),
    supabase
      .from("project_design_booklet_assets")
      .select(
        "project_id, asset_key, storage_path, file_name, media_type, byte_size, width, height, updated_at",
      )
      .eq("project_id", project.uuid),
  ]);

  if (bookletResult.error || assetsResult.error) {
    throw new ProjectDesignBookletError(
      "The saved booklet could not be loaded.",
      503,
      "booklet_storage_unavailable",
    );
  }

  const booklet = bookletResult.data as BookletRow | null;
  let draft: DesignBookletDraft;
  try {
    draft = booklet
      ? neutralizeProjectDesignBookletMedia(
          parseDesignBookletDraft(booklet.draft),
        )
      : createProjectDesignBookletDraft(customerNameFromProject(project.row));
  } catch {
    throw new ProjectDesignBookletError(
      "The saved booklet needs attention before it can be opened.",
      500,
      "invalid_saved_draft",
    );
  }

  const assetRows = (assetsResult.data ?? []) as AssetRow[];
  const assets = await Promise.all(
    assetRows.map((asset) => signedAsset(supabase, asset)),
  );

  return {
    project: {
      id: projectId,
      name: project.row.name?.trim() || "Project",
      customerName: customerNameFromProject(project.row),
      returnHref: `/staff/projects/${encodeURIComponent(projectId)}`,
    },
    draft,
    revision: booklet?.revision ?? 0,
    saved: Boolean(booklet),
    updatedAt: booklet?.updated_at ?? null,
    assets,
  };
}

export async function saveProjectDesignBooklet(
  supabase: SupabaseClient,
  input: {
    projectId: string;
    draft: unknown;
    expectedRevision: number;
    userId: string;
  },
): Promise<{ revision: number; updatedAt: string }> {
  const project = await loadProject(supabase, input.projectId);
  const draft = parseDesignBookletDraft(input.draft);
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  ) {
    throw new ProjectDesignBookletError(
      "Invalid booklet revision.",
      422,
      "invalid_revision",
    );
  }

  const now = new Date().toISOString();
  const nextRevision = input.expectedRevision + 1;
  if (input.expectedRevision === 0) {
    const inserted = await supabase
      .from("project_design_booklets")
      .insert({
        project_id: project.uuid,
        draft,
        revision: nextRevision,
        created_by: input.userId,
        updated_by: input.userId,
        updated_at: now,
      })
      .select("revision, updated_at")
      .maybeSingle();
    if (inserted.error) {
      if (inserted.error.code === "23505") {
        throw new ProjectDesignBookletError(
          "This booklet changed elsewhere. Reload it before saving again.",
          409,
          "revision_conflict",
        );
      }
      throw new ProjectDesignBookletError(
        "The booklet could not be saved.",
        500,
        "booklet_save_failed",
      );
    }
    if (!inserted.data) {
      throw new ProjectDesignBookletError(
        "The booklet could not be saved.",
        500,
        "booklet_save_failed",
      );
    }
    return {
      revision: Number(inserted.data.revision),
      updatedAt: String(inserted.data.updated_at ?? now),
    };
  }

  const updated = await supabase
    .from("project_design_booklets")
    .update({
      draft,
      revision: nextRevision,
      updated_by: input.userId,
      updated_at: now,
    })
    .eq("project_id", project.uuid)
    .eq("revision", input.expectedRevision)
    .select("revision, updated_at")
    .maybeSingle();
  if (updated.error) {
    throw new ProjectDesignBookletError(
      "The booklet could not be saved.",
      500,
      "booklet_save_failed",
    );
  }
  if (!updated.data) {
    throw new ProjectDesignBookletError(
      "This booklet changed elsewhere. Reload it before saving again.",
      409,
      "revision_conflict",
    );
  }
  return {
    revision: Number(updated.data.revision),
    updatedAt: String(updated.data.updated_at ?? now),
  };
}

async function ensureAssetCapacity(
  supabase: SupabaseClient,
  projectUuid: string,
  assetKey: string,
): Promise<void> {
  const existing = await supabase
    .from("project_design_booklet_assets")
    .select("asset_key", { count: "exact", head: false })
    .eq("project_id", projectUuid);
  if (existing.error) {
    throw new ProjectDesignBookletError(
      "Booklet image storage is unavailable.",
      503,
      "asset_storage_unavailable",
    );
  }
  const alreadyExists = (existing.data ?? []).some(
    (row) => row.asset_key === assetKey,
  );
  if (
    !alreadyExists &&
    (existing.count ?? 0) >= PROJECT_DESIGN_BOOKLET_MAX_ASSETS
  ) {
    throw new ProjectDesignBookletError(
      `A project booklet can store up to ${PROJECT_DESIGN_BOOKLET_MAX_ASSETS} custom images.`,
      422,
      "asset_limit_reached",
    );
  }
}

export async function prepareProjectDesignBookletAssetUpload(
  supabase: SupabaseClient,
  input: { projectId: string; assetId: string },
): Promise<{ path: string; signedUrl: string }> {
  const project = await loadProject(supabase, input.projectId);
  const assetKey = normalizedAssetKey(input.assetId);
  await ensureAssetCapacity(supabase, project.uuid, assetKey);
  const path = `${project.uuid}/${STORAGE_IMAGE_PREFIX}/${assetKey}/${randomUUID()}.jpg`;
  const signed = await supabase.storage
    .from(PROJECT_DESIGN_BOOKLET_BUCKET)
    .createSignedUploadUrl(path);
  if (signed.error || !signed.data?.signedUrl) {
    throw new ProjectDesignBookletError(
      "The image upload could not be prepared.",
      503,
      "asset_sign_failed",
    );
  }
  return { path, signedUrl: signed.data.signedUrl };
}

function safeFileName(value: string): string {
  const base = value.split(/[\\/]/).pop()?.trim() || "booklet-image.jpg";
  const clean = base
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 160);
  return clean || "booklet-image.jpg";
}

function assertProjectAssetPath(
  projectUuid: string,
  assetKey: string,
  path: string,
): void {
  const prefix = `${projectUuid}/${STORAGE_IMAGE_PREFIX}/${assetKey}/`;
  if (
    !path.startsWith(prefix) ||
    !/^[0-9a-f-]{36}\.jpg$/i.test(path.slice(prefix.length))
  ) {
    throw new ProjectDesignBookletError(
      "Invalid booklet image upload.",
      422,
      "invalid_asset_path",
    );
  }
}

async function normalizeImageBytes(source: Uint8Array): Promise<{
  bytes: Uint8Array;
  width: number;
  height: number;
}> {
  let output: Buffer;
  try {
    output = await sharp(source, { limitInputPixels: MAX_IMAGE_PIXELS })
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new ProjectDesignBookletError(
      "The uploaded file is not a readable image.",
      422,
      "invalid_asset_image",
    );
  }
  const metadata = await sharp(output).metadata();
  if (!metadata.width || !metadata.height) {
    throw new ProjectDesignBookletError(
      "The uploaded image dimensions are invalid.",
      422,
      "invalid_asset_dimensions",
    );
  }
  return {
    bytes: new Uint8Array(output),
    width: metadata.width,
    height: metadata.height,
  };
}

async function normalizeStoredImage(
  supabase: SupabaseClient,
  path: string,
): Promise<{
  bytes: Uint8Array;
  width: number;
  height: number;
}> {
  const downloaded = await supabase.storage
    .from(PROJECT_DESIGN_BOOKLET_BUCKET)
    .download(path);
  if (downloaded.error || !downloaded.data) {
    throw new ProjectDesignBookletError(
      "The uploaded image could not be verified.",
      422,
      "asset_download_failed",
    );
  }
  if (
    downloaded.data.size <= 0 ||
    downloaded.data.size > DESIGN_BOOKLET_MAX_IMAGE_BYTES
  ) {
    throw new ProjectDesignBookletError(
      "The uploaded image must be 15 MB or smaller.",
      413,
      "asset_too_large",
    );
  }
  return normalizeImageBytes(
    new Uint8Array(await downloaded.data.arrayBuffer()),
  );
}

async function replaceAssetRecord(
  supabase: SupabaseClient,
  input: {
    projectUuid: string;
    assetKey: string;
    path: string;
    fileName: string;
    userId: string;
    normalized: { bytes: Uint8Array; width: number; height: number };
  },
): Promise<ProjectDesignBookletAsset> {
  const previous = await supabase
    .from("project_design_booklet_assets")
    .select(
      "project_id, asset_key, storage_path, file_name, media_type, byte_size, width, height, updated_at",
    )
    .eq("project_id", input.projectUuid)
    .eq("asset_key", input.assetKey)
    .maybeSingle();
  if (previous.error) {
    throw new ProjectDesignBookletError(
      "The image could not be saved.",
      500,
      "asset_save_failed",
    );
  }

  const normalizedUpload = await supabase.storage
    .from(PROJECT_DESIGN_BOOKLET_BUCKET)
    .upload(input.path, input.normalized.bytes, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: true,
    });
  if (normalizedUpload.error) {
    await supabase.storage
      .from(PROJECT_DESIGN_BOOKLET_BUCKET)
      .remove([input.path]);
    throw new ProjectDesignBookletError(
      "The image could not be normalized.",
      503,
      "asset_normalize_failed",
    );
  }

  const now = new Date().toISOString();
  const saved = await supabase
    .from("project_design_booklet_assets")
    .upsert(
      {
        project_id: input.projectUuid,
        asset_key: input.assetKey,
        storage_path: input.path,
        file_name: safeFileName(input.fileName),
        media_type: "image/jpeg",
        byte_size: input.normalized.bytes.byteLength,
        width: input.normalized.width,
        height: input.normalized.height,
        created_by: input.userId,
        updated_by: input.userId,
        updated_at: now,
      },
      { onConflict: "project_id,asset_key" },
    )
    .select(
      "project_id, asset_key, storage_path, file_name, media_type, byte_size, width, height, updated_at",
    )
    .single();
  if (saved.error || !saved.data) {
    await supabase.storage
      .from(PROJECT_DESIGN_BOOKLET_BUCKET)
      .remove([input.path]);
    throw new ProjectDesignBookletError(
      "The image could not be saved.",
      500,
      "asset_save_failed",
    );
  }

  const previousPath = (previous.data as AssetRow | null)?.storage_path;
  if (previousPath && previousPath !== input.path) {
    await supabase.storage
      .from(PROJECT_DESIGN_BOOKLET_BUCKET)
      .remove([previousPath]);
  }
  return signedAsset(supabase, saved.data as AssetRow);
}

export async function completeProjectDesignBookletAssetUpload(
  supabase: SupabaseClient,
  input: {
    projectId: string;
    assetId: string;
    path: string;
    fileName: string;
    userId: string;
  },
): Promise<ProjectDesignBookletAsset> {
  const project = await loadProject(supabase, input.projectId);
  const assetKey = normalizedAssetKey(input.assetId);
  assertProjectAssetPath(project.uuid, assetKey, input.path);
  let normalized: Awaited<ReturnType<typeof normalizeStoredImage>>;
  try {
    normalized = await normalizeStoredImage(supabase, input.path);
  } catch (error) {
    await supabase.storage
      .from(PROJECT_DESIGN_BOOKLET_BUCKET)
      .remove([input.path]);
    throw error;
  }
  return replaceAssetRecord(supabase, {
    projectUuid: project.uuid,
    assetKey,
    path: input.path,
    fileName: input.fileName,
    userId: input.userId,
    normalized,
  });
}

export async function copyProjectDesignBookletAsset(
  supabase: SupabaseClient,
  input: {
    projectId: string;
    sourceAssetId: string;
    targetAssetId: string;
    sourceDefaultAssetId: string;
    userId: string;
  },
): Promise<ProjectDesignBookletAsset> {
  const project = await loadProject(supabase, input.projectId);
  const sourceAssetKey = normalizedAssetKey(input.sourceAssetId);
  const targetAssetKey = normalizedAssetKey(input.targetAssetId);
  const source = await supabase
    .from("project_design_booklet_assets")
    .select(
      "project_id, asset_key, storage_path, file_name, media_type, byte_size, width, height, updated_at",
    )
    .eq("project_id", project.uuid)
    .eq("asset_key", sourceAssetKey)
    .maybeSingle();
  if (source.error) {
    throw new ProjectDesignBookletError(
      "The cover image could not be copied.",
      500,
      "asset_copy_failed",
    );
  }
  await ensureAssetCapacity(supabase, project.uuid, targetAssetKey);
  const path = `${project.uuid}/${STORAGE_IMAGE_PREFIX}/${targetAssetKey}/${randomUUID()}.jpg`;
  let normalized: { bytes: Uint8Array; width: number; height: number };
  let fileName: string;
  if (source.data) {
    const sourceRow = source.data as AssetRow;
    const downloaded = await supabase.storage
      .from(PROJECT_DESIGN_BOOKLET_BUCKET)
      .download(sourceRow.storage_path);
    if (downloaded.error || !downloaded.data) {
      throw new ProjectDesignBookletError(
        "The cover image could not be copied.",
        500,
        "asset_copy_failed",
      );
    }
    normalized = {
      bytes: new Uint8Array(await downloaded.data.arrayBuffer()),
      width: sourceRow.width,
      height: sourceRow.height,
    };
    fileName = sourceRow.file_name;
  } else {
    const defaultAssetId = DESIGN_BOOKLET_DEFAULT_ASSET_IDS.includes(
      input.sourceDefaultAssetId as DesignBookletDefaultAssetId,
    )
      ? (input.sourceDefaultAssetId as DesignBookletDefaultAssetId)
      : null;
    if (!defaultAssetId) {
      throw new ProjectDesignBookletError(
        "The source image could not be found.",
        422,
        "asset_source_missing",
      );
    }
    const definition = TONI_DESIGN_BOOKLET_ASSETS[defaultAssetId];
    normalized = await normalizeImageBytes(
      await readDesignBookletDefaultImage(definition.filename),
    );
    fileName = definition.filename;
  }

  try {
    return await replaceAssetRecord(supabase, {
      projectUuid: project.uuid,
      assetKey: targetAssetKey,
      path,
      fileName,
      userId: input.userId,
      normalized,
    });
  } catch (error) {
    if (error instanceof ProjectDesignBookletError) throw error;
    throw new ProjectDesignBookletError(
      "The cover image could not be copied.",
      500,
      "asset_copy_failed",
    );
  }
}
