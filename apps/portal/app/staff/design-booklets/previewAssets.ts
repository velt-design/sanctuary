import { TONI_DESIGN_BOOKLET_ASSETS } from "@/lib/designBooklets/defaults";
import { allDesignBookletAssetSources } from "@/lib/designBooklets/pageModel";
import type { ProjectDesignBookletAsset, ProjectDesignBookletSnapshot } from "@/lib/designBooklets/projectTypes";
import type { DesignBookletAssetSource, DesignBookletDraft } from "@/lib/designBooklets/types";
import type { DesignBookletDefaultAssetId } from "@/lib/designBooklets/types";

export type DesignBookletPreviewAssetState =
  | "empty"
  | "loading"
  | "ready"
  | "error";

export type DesignBookletPreviewAsset = {
  id: string;
  src: string;
  alt: string;
  label: string;
  defaultAssetId: DesignBookletDefaultAssetId;
  state: DesignBookletPreviewAssetState;
  errorMessage?: string;
  file?: File;
  sourcePdfFile?: File;
  sourcePdfSrc?: string;
};

export type DesignBookletAssetDisplayHandler = (
  assetId: string,
  src: string,
  state: Extract<DesignBookletPreviewAssetState, "ready" | "error">,
) => void;

export type DesignBookletAssetMap = Record<string, DesignBookletPreviewAsset>;

export function previewAssetFromSource(
  source: DesignBookletAssetSource,
): DesignBookletPreviewAsset {
  const defaultAsset = TONI_DESIGN_BOOKLET_ASSETS[source.defaultAssetId];
  const useDefaultAsset = source.useDefaultAsset !== false;
  return {
    id: source.assetId,
    src: useDefaultAsset ? defaultAsset.src : "",
    alt: source.altText,
    label: useDefaultAsset ? defaultAsset.label : "No image selected",
    defaultAssetId: source.defaultAssetId,
    state: useDefaultAsset ? "loading" : "empty",
  };
}

export function initialDesignBookletAssets(
  draft: DesignBookletDraft,
): DesignBookletAssetMap {
  return Object.fromEntries(
    allDesignBookletAssetSources(draft).map((source) => [
      source.assetId,
      previewAssetFromSource(source),
    ]),
  );
}

export function persistedPreviewAsset(
  source: DesignBookletAssetSource,
  asset: ProjectDesignBookletAsset,
): DesignBookletPreviewAsset {
  return {
    id: source.assetId,
    src: asset.src,
    alt: source.altText,
    label: asset.label,
    defaultAssetId: source.defaultAssetId,
    state: "loading",
  };
}

export function snapshotAssets(
  snapshot: ProjectDesignBookletSnapshot,
): DesignBookletAssetMap {
  const next = initialDesignBookletAssets(snapshot.draft);
  const sources = new Map(
    allDesignBookletAssetSources(snapshot.draft).map((source) => [
      source.assetId,
      source,
    ]),
  );
  for (const asset of snapshot.assets) {
    const source = sources.get(asset.assetId);
    if (source) next[asset.assetId] = persistedPreviewAsset(source, asset);
  }
  const persistedById = new Map(
    snapshot.assets.map((asset) => [asset.assetId, asset]),
  );
  for (const page of snapshot.draft.contentPages) {
    if (page.kind !== "drawings") continue;
    for (const drawing of page.drawings) {
      if (!drawing.pdf) continue;
      const preview = next[drawing.image.assetId];
      const document = persistedById.get(drawing.pdf.assetId);
      if (preview && document?.mediaType === "application/pdf") {
        next[drawing.image.assetId] = {
          ...preview,
          sourcePdfSrc: document.src,
        };
      }
    }
  }
  return next;
}
