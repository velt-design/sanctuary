import type { DesignBookletDraft } from "./types";

export type ProjectDesignBookletAsset = {
  assetId: string;
  src: string;
  label: string;
  mediaType: "image/jpeg" | "image/png";
  byteSize: number;
  width: number;
  height: number;
  updatedAt: string | null;
};

export type ProjectDesignBookletSnapshot = {
  project: {
    id: string;
    name: string;
    customerName: string;
    returnHref: string;
  };
  draft: DesignBookletDraft;
  revision: number;
  saved: boolean;
  updatedAt: string | null;
  assets: ProjectDesignBookletAsset[];
};

export type ProjectDesignBookletSaveState =
  | "standalone"
  | "loading"
  | "saved"
  | "saving"
  | "uploading"
  | "error";
