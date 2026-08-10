import type {
  DesignBookletAssetSource,
  DesignBookletContentPage,
  DesignBookletDefaultAssetId,
  DesignBookletDraft,
  DesignBookletDrawingItem,
  DesignBookletDrawingLayoutId,
  DesignBookletDrawingPage,
  DesignBookletDrawingTitle,
  DesignBookletFocalPointId,
  DesignBookletImagePage,
} from "./types";

export const DESIGN_BOOKLET_MAX_CONTENT_PAGES = 24;
export const DESIGN_BOOKLET_MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const DESIGN_BOOKLET_MAX_PDF_BYTES = 20 * 1024 * 1024;
export const DESIGN_BOOKLET_MAX_PDF_PAGES = 50;
export const DESIGN_BOOKLET_MAX_DRAWING_PAGE_TITLE_LENGTH = 80;
export const DESIGN_BOOKLET_MAX_DRAWING_REVISION_LENGTH = 12;
export const DESIGN_BOOKLET_DRAWING_STATUS =
  "Concept design — not for construction";

export function normalizeDesignBookletSheetTitle(value: string): string {
  return value.toUpperCase();
}

export function designBookletDrawingPdfAssetId(
  drawing: DesignBookletDrawingItem,
): string {
  return `${drawing.image.assetId.slice(0, 76)}-pdf`;
}

export function currentDesignBookletIssueDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function formatDesignBookletIssueDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ][Number(match[2]) - 1];
  return month ? `${match[3]} ${month} ${match[1]}` : value;
}

export const DESIGN_BOOKLET_REVIEW_COPY = {
  eyebrow: "Your review",
  title: "Review the concept",
  introduction:
    "Use these prompts to shape the next conversation about your outdoor space.",
  prompts: [
    {
      title: "How you will use the space",
      copy: "Consider movement, furniture and how you want the area to feel day to day.",
    },
    {
      title: "Fit and form",
      copy: "Review the roof form, its relationship to the house and the views you want to keep.",
    },
    {
      title: "Materials",
      copy: "Review the roofing materials and how they appear across the concept.",
    },
  ],
  callToAction: "Discuss this concept with Sanctuary",
} as const;

type DesignBookletDrawingFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DESIGN_BOOKLET_DRAWING_LAYOUTS: Record<
  DesignBookletDrawingLayoutId,
  {
    label: string;
    description: string;
    slotCount: 1 | 2 | 3 | 4;
    frames: readonly DesignBookletDrawingFrame[];
  }
> = {
  "one-large": {
    label: "One large drawing",
    description: "One centred drawing with its title underneath.",
    slotCount: 1,
    frames: [{ x: 0, y: 0, width: 1, height: 1 }],
  },
  "two-equal": {
    label: "Two equal drawings",
    description: "Two drawings with equal visual weight.",
    slotCount: 2,
    frames: [
      { x: 0, y: 0, width: 0.485, height: 1 },
      { x: 0.515, y: 0, width: 0.485, height: 1 },
    ],
  },
  "large-plus-two": {
    label: "One large + two small",
    description: "One leading drawing with two supporting drawings.",
    slotCount: 3,
    frames: [
      { x: 0, y: 0, width: 0.625, height: 1 },
      { x: 0.655, y: 0, width: 0.345, height: 0.48 },
      { x: 0.655, y: 0.52, width: 0.345, height: 0.48 },
    ],
  },
  "four-grid": {
    label: "Four-drawing grid",
    description: "Four equal drawings in a two-by-two grid.",
    slotCount: 4,
    frames: [
      { x: 0, y: 0, width: 0.485, height: 0.48 },
      { x: 0.515, y: 0, width: 0.485, height: 0.48 },
      { x: 0, y: 0.52, width: 0.485, height: 0.48 },
      { x: 0.515, y: 0.52, width: 0.485, height: 0.48 },
    ],
  },
};

export const DESIGN_BOOKLET_FOCAL_POINTS: Record<
  DesignBookletFocalPointId,
  { label: string; x: number; y: number }
> = {
  "top-left": { label: "Top left", x: 0, y: 0 },
  top: { label: "Top", x: 50, y: 0 },
  "top-right": { label: "Top right", x: 100, y: 0 },
  left: { label: "Left", x: 0, y: 50 },
  center: { label: "Centre", x: 50, y: 50 },
  right: { label: "Right", x: 100, y: 50 },
  "bottom-left": { label: "Bottom left", x: 0, y: 100 },
  bottom: { label: "Bottom", x: 50, y: 100 },
  "bottom-right": { label: "Bottom right", x: 100, y: 100 },
};

const DRAWING_TITLE_LABELS = {
  plan: "Plan",
  section: "Section",
  elevation: "Elevation",
  isometric: "Isometric",
} as const;

export function designBookletDrawingTitle(
  title: DesignBookletDrawingTitle,
): string {
  return title.kind === "custom"
    ? title.value.trim()
    : DRAWING_TITLE_LABELS[title.value];
}

export function visibleDesignBookletDrawings(
  page: DesignBookletDrawingPage,
): DesignBookletDrawingItem[] {
  return page.drawings.slice(
    0,
    DESIGN_BOOKLET_DRAWING_LAYOUTS[page.layout].slotCount,
  );
}

type ResolvedDesignBookletPage =
  | {
      key: "cover";
      kind: "cover";
      label: "Cover";
      pageNumber: number;
      pageCount: number;
    }
  | {
      key: string;
      kind: "image";
      label: string;
      pageNumber: number;
      pageCount: number;
      page: DesignBookletImagePage;
    }
  | {
      key: string;
      kind: "drawings";
      label: string;
      sheetNumber: string;
      pageNumber: number;
      pageCount: number;
      page: DesignBookletDrawingPage;
    }
  | {
      key: "review";
      kind: "review";
      label: "Review";
      pageNumber: number;
      pageCount: number;
    };

export function buildDesignBookletRenderModel(
  draft: DesignBookletDraft,
): ResolvedDesignBookletPage[] {
  const pageCount = draft.contentPages.length + 2;
  let imageNumber = 0;
  let drawingNumber = 0;
  const content = draft.contentPages.map((page, index) => {
    if (page.kind === "image") {
      imageNumber += 1;
      return {
        key: page.id,
        kind: "image",
        label: `Image ${imageNumber}`,
        pageNumber: index + 2,
        pageCount,
        page,
      } satisfies ResolvedDesignBookletPage;
    }
    drawingNumber += 1;
    return {
      key: page.id,
      kind: "drawings",
      label: normalizeDesignBookletSheetTitle(page.pageTitle),
      sheetNumber: `A-${String(drawingNumber).padStart(2, "0")}`,
      pageNumber: index + 2,
      pageCount,
      page,
    } satisfies ResolvedDesignBookletPage;
  });

  return [
    {
      key: "cover",
      kind: "cover",
      label: "Cover",
      pageNumber: 1,
      pageCount,
    },
    ...content,
    {
      key: "review",
      kind: "review",
      label: "Review",
      pageNumber: pageCount,
      pageCount,
    },
  ];
}

export function allDesignBookletAssetSources(
  draft: DesignBookletDraft,
): DesignBookletAssetSource[] {
  return [
    draft.cover,
    ...draft.contentPages.flatMap((page) =>
      page.kind === "image"
        ? [page.image]
        : page.drawings.map((drawing) => drawing.image),
    ),
    draft.reviewPage.image,
  ];
}

export function renderableDesignBookletAssetSources(
  draft: DesignBookletDraft,
): DesignBookletAssetSource[] {
  return [
    draft.cover,
    ...draft.contentPages.flatMap((page) =>
      page.kind === "image"
        ? [page.image]
        : visibleDesignBookletDrawings(page).map((drawing) => drawing.image),
    ),
    draft.reviewPage.image,
  ];
}

export function designBookletDrawingPdfSources(draft: DesignBookletDraft) {
  return draft.contentPages.flatMap((page) =>
    page.kind === "drawings"
      ? page.drawings.flatMap((drawing) => (drawing.pdf ? [drawing.pdf] : []))
      : [],
  );
}

function nextAvailableId(prefix: string, currentIds: Set<string>): string {
  let sequence = 1;
  while (currentIds.has(`${prefix}-${sequence}`)) sequence += 1;
  return `${prefix}-${sequence}`;
}

function existingPageAndAssetIds(
  pages: DesignBookletContentPage[],
): Set<string> {
  return new Set([
    ...pages.map((page) => page.id),
    ...pages.flatMap((page) =>
      page.kind === "image"
        ? [page.image.assetId]
        : page.drawings.flatMap((drawing) => [
            drawing.id,
            drawing.image.assetId,
            ...(drawing.pdf ? [drawing.pdf.assetId] : []),
          ]),
    ),
  ]);
}

export function createDesignBookletImagePage(
  pages: DesignBookletContentPage[],
  defaultAsset: {
    id: DesignBookletDefaultAssetId;
    alt: string;
    useDefaultAsset?: boolean;
  },
): DesignBookletImagePage {
  const currentIds = existingPageAndAssetIds(pages);
  const id = nextAvailableId("image-page", currentIds);
  return {
    id,
    kind: "image",
    image: {
      assetId: `${id}-image`,
      defaultAssetId: defaultAsset.id,
      useDefaultAsset: defaultAsset.useDefaultAsset,
      altText: defaultAsset.alt,
      focalPoint: "center",
    },
  };
}

export function createDesignBookletDrawingPage(
  pages: DesignBookletContentPage[],
  defaultAsset: {
    id: DesignBookletDefaultAssetId;
    alt: string;
    useDefaultAsset?: boolean;
  },
): DesignBookletDrawingPage {
  const currentIds = existingPageAndAssetIds(pages);
  const id = nextAvailableId("drawing-page", currentIds);
  const titleValues = ["plan", "section", "elevation", "isometric"] as const;
  const drawings = titleValues.map((value, index) => ({
    id: `${id}-item-${index + 1}`,
    image: {
      assetId: `${id}-drawing-${index + 1}`,
      defaultAssetId: defaultAsset.id,
      useDefaultAsset: defaultAsset.useDefaultAsset,
      altText: defaultAsset.alt,
    },
    title: { kind: "preset", value },
  })) as DesignBookletDrawingPage["drawings"];

  return {
    id,
    kind: "drawings",
    pageTitle: "CONCEPT DRAWINGS",
    revision: "01",
    issueDate: currentDesignBookletIssueDate(),
    layout: "one-large",
    drawings,
  };
}

export function moveDesignBookletContentPage(
  pages: DesignBookletContentPage[],
  pageId: string,
  direction: -1 | 1,
): DesignBookletContentPage[] {
  const currentIndex = pages.findIndex((page) => page.id === pageId);
  const nextIndex = currentIndex + direction;
  if (currentIndex === -1 || nextIndex < 0 || nextIndex >= pages.length) {
    return pages;
  }
  const next = [...pages];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
  return next;
}

export function moveDesignBookletDrawing(
  drawings: DesignBookletDrawingPage["drawings"],
  itemId: string,
  direction: -1 | 1,
): DesignBookletDrawingPage["drawings"] {
  const currentIndex = drawings.findIndex((drawing) => drawing.id === itemId);
  const nextIndex = currentIndex + direction;
  if (currentIndex === -1 || nextIndex < 0 || nextIndex >= drawings.length) {
    return drawings;
  }
  const next = [...drawings] as DesignBookletDrawingPage["drawings"];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
  return next;
}
