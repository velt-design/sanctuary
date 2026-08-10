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
