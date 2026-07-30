import type {
  DesignBookletAssetId,
  DesignBookletDraft,
  DesignBookletMaterialId,
  DesignBookletRoofFormId,
} from "./types";

export const TONI_DESIGN_BOOKLET_DRAFT: DesignBookletDraft = {
  customerName: "Toni",
  projectTitle: "Outdoor living concept",
  roofFormId: "pitched",
  materialId: "combination",
  renderOrder: ["render-3", "render-1", "render-2"],
};

export const TONI_DESIGN_BOOKLET_ASSETS: Record<
  DesignBookletAssetId,
  { src: string; alt: string; label: string; filename: string }
> = {
  "render-1": {
    src: "/images/design-booklets/toni/booklet-toni-01.png",
    alt: "Toni concept render viewed across the pool toward the outdoor room",
    label: "Pool approach",
    filename: "booklet-toni-01.png",
  },
  "render-2": {
    src: "/images/design-booklets/toni/booklet-toni-02.png",
    alt: "Toni concept render showing the side of the pitched outdoor room",
    label: "House connection",
    filename: "booklet-toni-02.png",
  },
  "render-3": {
    src: "/images/design-booklets/toni/booklet-toni-03.png",
    alt: "Toni concept render looking through the outdoor room toward the pool",
    label: "Outdoor room",
    filename: "booklet-toni-03.png",
  },
  plan: {
    src: "/images/design-booklets/toni/booklet-toni-plan.png",
    alt: "Top-down concept plan for Toni",
    label: "Concept plan",
    filename: "booklet-toni-plan.png",
  },
};

export const DESIGN_BOOKLET_PAGE_COUNT = 6;

export const DESIGN_BOOKLET_REFERENCE_ASSETS: {
  roofForms: Record<
    DesignBookletRoofFormId,
    { src: string; alt: string; filename: string }
  >;
  roofing: Record<
    "acrylic" | "solid-lined",
    { src: string; alt: string; filename: string }
  >;
  materialSectionOrder: Record<
    DesignBookletMaterialId,
    Array<"acrylic" | "solid-lined">
  >;
} = {
  roofForms: {
    pitched: {
      src: "/images/design-booklets/reference/roof-form-pitched.jpg",
      alt: "Completed pitched Sanctuary pergola beside a contemporary home",
      filename: "roof-form-pitched.jpg",
    },
    gable: {
      src: "/images/design-booklets/reference/roof-form-gable.jpg",
      alt: "Completed gable Sanctuary pergola",
      filename: "roof-form-gable.jpg",
    },
    hip: {
      src: "/images/design-booklets/reference/roof-form-hip.jpg",
      alt: "Completed hip-roof Sanctuary pergola",
      filename: "roof-form-hip.jpg",
    },
    "box-perimeter": {
      src: "/images/design-booklets/reference/roof-form-box-perimeter.jpg",
      alt: "Completed box-perimeter Sanctuary pergola",
      filename: "roof-form-box-perimeter.jpg",
    },
  },
  roofing: {
    acrylic: {
      src: "/images/design-booklets/reference/roofing-acrylic.jpg",
      alt: "Acrylic roof over a completed outdoor living area",
      filename: "roofing-acrylic.jpg",
    },
    "solid-lined": {
      src: "/images/design-booklets/reference/roofing-solid-timber.jpg",
      alt: "COLORSTEEL roof with a timber-lined ceiling in a completed Sanctuary outdoor room",
      filename: "roofing-solid-timber.jpg",
    },
  },
  materialSectionOrder: {
    acrylic: ["acrylic"],
    "solid-lined": ["solid-lined"],
    combination: ["acrylic", "solid-lined"],
  },
};
