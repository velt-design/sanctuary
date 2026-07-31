import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  designBookletPdfFilename,
  generateDesignBookletPdf,
} from "./pdf";
import { getDesignBookletContentCatalog } from "./marketingContent";
import { renderableDesignBookletAssetSources } from "./pageModel";
import {
  loadProjectDesignBooklet,
  PROJECT_DESIGN_BOOKLET_BUCKET,
  ProjectDesignBookletError,
  projectUuidFromId,
} from "./projectPersistence";
import { loadToniDesignBookletImages } from "./request";
import type {
  DesignBookletDraft,
  DesignBookletImage,
  DesignBookletImages,
} from "./types";

const PROJECT_DESIGN_BOOKLET_EXPORT_URL_SECONDS = 10 * 60;
const STORAGE_EXPORT_PREFIX = "exports";

type AssetRow = {
  asset_key: string;
  storage_path: string;
  file_name: string;
  media_type: "image/jpeg" | "image/png";
};

async function loadProjectDesignBookletImages(
  supabase: SupabaseClient,
  projectUuid: string,
  draft: DesignBookletDraft,
): Promise<DesignBookletImages> {
  const images = await loadToniDesignBookletImages(draft);
  const sources = renderableDesignBookletAssetSources(draft);
  const assetKeys = [...new Set(sources.map((source) => source.assetId))];
  if (!assetKeys.length) return images;

  const assets = await supabase
    .from("project_design_booklet_assets")
    .select("asset_key, storage_path, file_name, media_type")
    .eq("project_id", projectUuid)
    .in("asset_key", assetKeys);
  if (assets.error) {
    throw new ProjectDesignBookletError(
      "The saved booklet images could not be loaded.",
      503,
      "asset_storage_unavailable",
    );
  }

  await Promise.all(
    ((assets.data ?? []) as AssetRow[]).map(async (asset) => {
      const downloaded = await supabase.storage
        .from(PROJECT_DESIGN_BOOKLET_BUCKET)
        .download(asset.storage_path);
      if (downloaded.error || !downloaded.data) {
        throw new ProjectDesignBookletError(
          `The saved image "${asset.file_name}" could not be loaded.`,
          500,
          "asset_download_failed",
        );
      }
      images[asset.asset_key] = {
        bytes: new Uint8Array(await downloaded.data.arrayBuffer()),
        mediaType: asset.media_type,
      } satisfies DesignBookletImage;
    }),
  );
  return images;
}

export async function publishProjectDesignBookletPdf(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ downloadUrl: string; filename: string }> {
  const projectUuid = projectUuidFromId(projectId);
  const snapshot = await loadProjectDesignBooklet(supabase, projectId);
  const images = await loadProjectDesignBookletImages(
    supabase,
    projectUuid,
    snapshot.draft,
  );
  const pdfBytes = await generateDesignBookletPdf({
    draft: snapshot.draft,
    images,
    content: getDesignBookletContentCatalog(),
  });
  const path = `${projectUuid}/${STORAGE_EXPORT_PREFIX}/latest.pdf`;
  const uploaded = await supabase.storage
    .from(PROJECT_DESIGN_BOOKLET_BUCKET)
    .upload(path, pdfBytes, {
      contentType: "application/pdf",
      cacheControl: "0",
      upsert: true,
    });
  if (uploaded.error) {
    throw new ProjectDesignBookletError(
      "The PDF could not be published for download.",
      503,
      "pdf_publish_failed",
    );
  }
  const filename = designBookletPdfFilename(snapshot.draft.customerName);
  const signed = await supabase.storage
    .from(PROJECT_DESIGN_BOOKLET_BUCKET)
    .createSignedUrl(path, PROJECT_DESIGN_BOOKLET_EXPORT_URL_SECONDS, {
      download: filename,
    });
  if (signed.error || !signed.data?.signedUrl) {
    throw new ProjectDesignBookletError(
      "The PDF download could not be prepared.",
      503,
      "pdf_sign_failed",
    );
  }
  return { downloadUrl: signed.data.signedUrl, filename };
}
