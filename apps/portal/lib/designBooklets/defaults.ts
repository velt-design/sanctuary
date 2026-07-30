import type {
  DesignBookletDefaultAssetId,
  DesignBookletDraft,
  DesignBookletDrawingPage,
} from "./types";

export const TONI_DESIGN_BOOKLET_ASSETS: Record<
  DesignBookletDefaultAssetId,
  {
    src: string;
    alt: string;
    label: string;
    filename: string;
    mediaType: "image/png";
  }
> = {
  "render-1": {
    src: "/images/design-booklets/toni/booklet-toni-01.png",
    alt: "Toni concept render viewed across the pool toward the outdoor room",
    label: "Pool approach",
    filename: "booklet-toni-01.png",
    mediaType: "image/png",
  },
  "render-2": {
    src: "/images/design-booklets/toni/booklet-toni-02.png",
    alt: "Toni concept render showing the side of the pitched outdoor room",
    label: "House connection",
    filename: "booklet-toni-02.png",
    mediaType: "image/png",
  },
  "render-3": {
    src: "/images/design-booklets/toni/booklet-toni-03.png",
    alt: "Toni concept render looking through the outdoor room toward the pool",
    label: "Outdoor room",
    filename: "booklet-toni-03.png",
    mediaType: "image/png",
  },
  plan: {
    src: "/images/design-booklets/toni/booklet-toni-plan.png",
    alt: "Top-down concept plan for Toni",
    label: "Concept plan",
    filename: "booklet-toni-plan.png",
    mediaType: "image/png",
  },
};

function defaultDrawingPage(): DesignBookletDrawingPage {
  const titles = ["plan", "section", "elevation", "isometric"] as const;
  return {
    id: "drawing-page-1",
    kind: "drawings",
    layout: "one-large",
    drawings: titles.map((value, index) => ({
      id: `drawing-page-1-item-${index + 1}`,
      image: {
        assetId: `drawing-page-1-drawing-${index + 1}`,
        defaultAssetId: "plan",
        altText: TONI_DESIGN_BOOKLET_ASSETS.plan.alt,
      },
      title: { kind: "preset", value },
    })) as DesignBookletDrawingPage["drawings"],
  };
}

export function createToniDesignBookletDraft(): DesignBookletDraft {
  return {
    schemaVersion: 2,
    customerName: "Toni",
    projectTitle: "Outdoor living concept",
    roofFormId: "pitched",
    materialId: "combination",
    cover: {
      assetId: "cover-image",
      defaultAssetId: "render-3",
      altText: TONI_DESIGN_BOOKLET_ASSETS["render-3"].alt,
      focalPoint: "center",
    },
    contentPages: [
      {
        id: "image-page-1",
        kind: "image",
        image: {
          assetId: "image-page-1-image",
          defaultAssetId: "render-1",
          altText: TONI_DESIGN_BOOKLET_ASSETS["render-1"].alt,
          focalPoint: "center",
        },
      },
      {
        id: "image-page-2",
        kind: "image",
        image: {
          assetId: "image-page-2-image",
          defaultAssetId: "render-2",
          altText: TONI_DESIGN_BOOKLET_ASSETS["render-2"].alt,
          focalPoint: "center",
        },
      },
      defaultDrawingPage(),
    ],
    reviewPage: {
      image: {
        assetId: "review-image",
        defaultAssetId: "render-3",
        altText: TONI_DESIGN_BOOKLET_ASSETS["render-3"].alt,
        focalPoint: "center",
      },
    },
  };
}
