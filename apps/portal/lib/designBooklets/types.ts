export const DESIGN_BOOKLET_SCHEMA_VERSION = 2 as const;

export const DESIGN_BOOKLET_PAPER_SIZE_IDS = ["a4", "a3"] as const;

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

export const DESIGN_BOOKLET_CONTENT_LAYOUT_IDS = [
  "visual-full-bleed",
  "visual-framed",
  "visual-split",
  "gallery-hero-two",
  "gallery-grid-four",
  "story-image-left",
  "story-image-right",
  "story-image-top",
  "information-text",
  "information-material-split",
] as const;

export const DESIGN_BOOKLET_CONTENT_VARIANT_IDS = [
  "edge",
  "balanced",
  "gallery",
] as const;

export const DESIGN_BOOKLET_TEXT_SIZE_IDS = [
  "small",
  "standard",
  "large",
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
export type DesignBookletPaperSizeId =
  (typeof DESIGN_BOOKLET_PAPER_SIZE_IDS)[number];
export type DesignBookletMaterialId =
  (typeof DESIGN_BOOKLET_MATERIAL_IDS)[number];
export type DesignBookletDefaultAssetId =
  (typeof DESIGN_BOOKLET_DEFAULT_ASSET_IDS)[number];
export type DesignBookletDrawingLayoutId =
  (typeof DESIGN_BOOKLET_DRAWING_LAYOUT_IDS)[number];
export type DesignBookletContentLayoutId =
  (typeof DESIGN_BOOKLET_CONTENT_LAYOUT_IDS)[number];
export type DesignBookletContentVariantId =
  (typeof DESIGN_BOOKLET_CONTENT_VARIANT_IDS)[number];
export type DesignBookletTextSizeId =
  (typeof DESIGN_BOOKLET_TEXT_SIZE_IDS)[number];
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

type DesignBookletDrawingPdfSource = {
  assetId: string;
  fileName: string;
  pageNumber: number;
  pageCount: number;
};

export type DesignBookletDrawingItem = {
  id: string;
  image: DesignBookletAssetSource;
  pdf?: DesignBookletDrawingPdfSource;
  title: DesignBookletDrawingTitle;
};

export type DesignBookletContentImage = DesignBookletImagePlacement & {
  caption: string;
};

type DesignBookletEditorialContent = {
  eyebrow: string;
  headline: string;
  body: string;
  headlineSize: DesignBookletTextSizeId;
  bodySize: DesignBookletTextSizeId;
  headlineScale: number;
  bodyScale: number;
  eyebrowScale: number;
  captionScale: number;
  sections: [
    { heading: string; body: string },
    { heading: string; body: string },
  ];
};

export type DesignBookletImagePage = {
  id: string;
  kind: "image";
  layout: DesignBookletContentLayoutId;
  variant: DesignBookletContentVariantId;
  images: [
    DesignBookletContentImage,
    DesignBookletContentImage,
    DesignBookletContentImage,
    DesignBookletContentImage,
  ];
  content: DesignBookletEditorialContent;
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
  | DesignBookletImagePage
  | DesignBookletDrawingPage;

export type DesignBookletDraft = {
  schemaVersion: typeof DESIGN_BOOKLET_SCHEMA_VERSION;
  paperSize: DesignBookletPaperSizeId;
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

export type DesignBookletPdfDocument = {
  bytes: Uint8Array;
};

export type DesignBookletPdfDocuments = Record<
  string,
  DesignBookletPdfDocument
>;
