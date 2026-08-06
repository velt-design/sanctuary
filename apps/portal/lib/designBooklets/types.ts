export const DESIGN_BOOKLET_SCHEMA_VERSION = 2 as const;

export const DESIGN_BOOKLET_ROOF_FORM_IDS = [
  "pitched",
  "gable",
  "hip",
  "box-perimeter",
] as const;

export const DESIGN_BOOKLET_MATERIAL_IDS = [
  "acrylic",
  "solid-lined",
  "combination",
] as const;

export const DESIGN_BOOKLET_DEFAULT_ASSET_IDS = [
  "render-1",
  "render-2",
  "render-3",
  "plan",
] as const;

export const DESIGN_BOOKLET_DRAWING_LAYOUT_IDS = [
  "one-large",
  "two-equal",
  "large-plus-two",
  "four-grid",
] as const;

export const DESIGN_BOOKLET_DRAWING_TITLE_PRESET_IDS = [
  "plan",
  "section",
  "elevation",
  "isometric",
] as const;

export const DESIGN_BOOKLET_FOCAL_POINT_IDS = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const;

export type DesignBookletRoofFormId =
  (typeof DESIGN_BOOKLET_ROOF_FORM_IDS)[number];
export type DesignBookletMaterialId =
  (typeof DESIGN_BOOKLET_MATERIAL_IDS)[number];
export type DesignBookletDefaultAssetId =
  (typeof DESIGN_BOOKLET_DEFAULT_ASSET_IDS)[number];
export type DesignBookletDrawingLayoutId =
  (typeof DESIGN_BOOKLET_DRAWING_LAYOUT_IDS)[number];
export type DesignBookletDrawingTitlePresetId =
  (typeof DESIGN_BOOKLET_DRAWING_TITLE_PRESET_IDS)[number];
export type DesignBookletFocalPointId =
  (typeof DESIGN_BOOKLET_FOCAL_POINT_IDS)[number];

export type DesignBookletContentCatalog = {
  roofForms: Record<
    DesignBookletRoofFormId,
    {
      id: DesignBookletRoofFormId;
      name: string;
      shortName: string;
    }
  >;
  materials: Record<
    DesignBookletMaterialId,
    {
      id: DesignBookletMaterialId;
      label: string;
    }
  >;
};

export type DesignBookletAssetSource = {
  assetId: string;
  defaultAssetId: DesignBookletDefaultAssetId;
  useDefaultAsset?: boolean;
  altText: string;
};

export type DesignBookletImagePlacement = DesignBookletAssetSource & {
  focalPoint: DesignBookletFocalPointId;
};

export type DesignBookletDrawingTitle =
  | {
      kind: "preset";
      value: DesignBookletDrawingTitlePresetId;
    }
  | {
      kind: "custom";
      value: string;
    };

export type DesignBookletDrawingItem = {
  id: string;
  image: DesignBookletAssetSource;
  title: DesignBookletDrawingTitle;
};

export type DesignBookletImagePage = {
  id: string;
  kind: "image";
  image: DesignBookletImagePlacement;
};

export type DesignBookletDrawingPage = {
  id: string;
  kind: "drawings";
  pageTitle: string;
  revision: string;
  issueDate: string;
  layout: DesignBookletDrawingLayoutId;
  drawings: [
    DesignBookletDrawingItem,
    DesignBookletDrawingItem,
    DesignBookletDrawingItem,
    DesignBookletDrawingItem,
  ];
};

export type DesignBookletContentPage =
  DesignBookletImagePage | DesignBookletDrawingPage;

export type DesignBookletDraft = {
  schemaVersion: typeof DESIGN_BOOKLET_SCHEMA_VERSION;
  customerName: string;
  projectTitle: string;
  roofFormId: DesignBookletRoofFormId;
  materialId: DesignBookletMaterialId;
  cover: DesignBookletImagePlacement;
  contentPages: DesignBookletContentPage[];
  reviewPage: {
    image: DesignBookletImagePlacement;
  };
};

export type DesignBookletImage = {
  bytes: Uint8Array;
  mediaType: "image/png" | "image/jpeg";
};

export type DesignBookletImages = Record<string, DesignBookletImage>;
