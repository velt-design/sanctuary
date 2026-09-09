import type {
  DesignBookletDefaultAssetId,
  DesignBookletDraft,
  DesignBookletDrawingPage,
  DesignBookletImagePage,
} from "./types";
import { defaultDesignBookletContentVariant } from "./contentPresentation";
import { currentDesignBookletIssueDate } from "./pageModel";
import { DESIGN_BOOKLET_DEFAULT_PAPER_SIZE } from "./paperGeometry";

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
    pageTitle: "PROPOSED ROOF PLAN",
    revision: "01",
    issueDate: currentDesignBookletIssueDate(),
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

function defaultImagePage(
  id: string,
  assetId: "render-1" | "render-2" | "render-3",
  layout: DesignBookletImagePage["layout"] = "visual-full-bleed",
): DesignBookletImagePage {
  return {
    id,
    kind: "image",
    layout,
    variant: defaultDesignBookletContentVariant(layout),
    images: Array.from({ length: 4 }, (_, index) => ({
      assetId: index === 0 ? `${id}-image` : `${id}-image-${index + 1}`,
      defaultAssetId: assetId,
      altText: `${TONI_DESIGN_BOOKLET_ASSETS[assetId].alt}${
        index === 0 ? "" : ` ${index + 1}`
      }`,
      focalPoint: "center" as const,
      caption: "",
    })) as DesignBookletImagePage["images"],
    content: {
      eyebrow: "",
      headline: "",
      body: "",
      headlineSize: "standard",
      bodySize: "standard",
      headlineScale: 100,
      bodyScale: 100,
      eyebrowScale: 100,
      captionScale: 100,
      sections: [
        { heading: "Section one", body: "" },
        { heading: "Section two", body: "" },
      ],
    },
  };
}

export function createToniDesignBookletDraft(): DesignBookletDraft {
  return {
    schemaVersion: 2,
    paperSize: DESIGN_BOOKLET_DEFAULT_PAPER_SIZE,
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
      defaultImagePage("image-page-1", "render-1"),
      defaultImagePage("image-page-2", "render-2"),
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

export function createProjectDesignBookletDraft(
  customerName?: string | null,
): DesignBookletDraft {
  const draft = createToniDesignBookletDraft();
  const normalizedCustomerName =
    customerName?.trim().slice(0, 80) || "Customer";
  return neutralizeProjectDesignBookletMedia({
    ...draft,
    customerName: normalizedCustomerName,
  });
}

export function neutralizeProjectDesignBookletMedia(
  draft: DesignBookletDraft,
): DesignBookletDraft {
  return {
    ...draft,
    cover: {
      ...draft.cover,
      useDefaultAsset: false,
      altText: "Customer design cover image",
    },
    contentPages: draft.contentPages.map((page, pageIndex) =>
      page.kind === "image"
        ? {
            ...page,
            images: page.images.map((image, imageIndex) => ({
              ...image,
              useDefaultAsset: false,
              altText: `Customer design image ${pageIndex + 1}.${imageIndex + 1}`,
            })) as DesignBookletImagePage["images"],
          }
        : {
            ...page,
            drawings: page.drawings.map((drawing, drawingIndex) => ({
              ...drawing,
              image: {
                ...drawing.image,
                useDefaultAsset: false,
                altText: `Customer drawing ${drawingIndex + 1}`,
              },
            })) as DesignBookletDrawingPage["drawings"],
          },
    ),
    reviewPage: {
      ...draft.reviewPage,
      image: {
        ...draft.reviewPage.image,
        useDefaultAsset: false,
        altText: "Customer design review image",
      },
    },
  };
}
