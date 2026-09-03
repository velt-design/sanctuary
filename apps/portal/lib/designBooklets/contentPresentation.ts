import {
  DESIGN_BOOKLET_CONTENT_LAYOUTS,
  DESIGN_BOOKLET_CONTENT_TYPOGRAPHY,
  type DesignBookletContentFrame,
} from "./contentLayouts";
import type {
  DesignBookletContentLayoutId,
  DesignBookletContentVariantId,
  DesignBookletImagePage,
} from "./types";
import { DESIGN_BOOKLET_BASE_PAGE_SIZE } from "./paperGeometry";

const PAGE_WIDTH = DESIGN_BOOKLET_BASE_PAGE_SIZE.width;
const PAGE_HEIGHT = DESIGN_BOOKLET_BASE_PAGE_SIZE.height;
const FRAME_EPSILON = 0.1;

export const DESIGN_BOOKLET_CONTENT_VARIANTS: Record<
  DesignBookletContentVariantId,
  { label: string; description: string }
> = {
  edge: {
    label: "Edge-to-edge",
    description: "Images reach the page edge for a bolder composition.",
  },
  balanced: {
    label: "Balanced",
    description: "The polished default with controlled working margins.",
  },
  gallery: {
    label: "Gallery margin",
    description: "A quieter composition with generous space around the page.",
  },
};

export const DESIGN_BOOKLET_CONTENT_SCALE_RANGES = {
  headline: { min: 75, max: 400, step: 5 },
  body: { min: 80, max: 175, step: 5 },
  eyebrow: { min: 80, max: 150, step: 5 },
  caption: { min: 80, max: 150, step: 5 },
} as const;

export type DesignBookletContentScaleRole =
  keyof typeof DESIGN_BOOKLET_CONTENT_SCALE_RANGES;

export function defaultDesignBookletContentVariant(
  layout: DesignBookletContentLayoutId,
): DesignBookletContentVariantId {
  return layout === "visual-full-bleed" ? "edge" : "balanced";
}

export function isDesignBookletContentScale(
  role: DesignBookletContentScaleRole,
  value: unknown,
): value is number {
  const range = DESIGN_BOOKLET_CONTENT_SCALE_RANGES[role];
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= range.min &&
    value <= range.max
  );
}

function frameRight(frame: DesignBookletContentFrame) {
  return frame.x + frame.width;
}

function frameBottom(frame: DesignBookletContentFrame) {
  return frame.top + frame.height;
}

function compositionBounds(frames: readonly DesignBookletContentFrame[]) {
  const left = Math.min(...frames.map((frame) => frame.x));
  const top = Math.min(...frames.map((frame) => frame.top));
  const right = Math.max(...frames.map(frameRight));
  const bottom = Math.max(...frames.map(frameBottom));
  return { left, top, right, bottom };
}

function near(left: number, right: number) {
  return Math.abs(left - right) <= FRAME_EPSILON;
}

function edgeImageFrames(
  page: DesignBookletImagePage,
): DesignBookletContentFrame[] {
  const layout = DESIGN_BOOKLET_CONTENT_LAYOUTS[page.layout];
  const allFrames = [
    ...layout.imageFrames,
    ...(layout.textFrame ? [layout.textFrame] : []),
    ...(layout.sectionFrames ?? []),
  ];
  const bounds = compositionBounds(allFrames);
  const imageOnly =
    layout.category === "visual" || layout.category === "gallery";
  const target = imageOnly
    ? { left: 0, top: 0, right: PAGE_WIDTH, bottom: PAGE_HEIGHT }
    : { left: 0, top: 64, right: PAGE_WIDTH, bottom: 536 };

  return layout.imageFrames.map((frame) => {
    const left = near(frame.x, bounds.left) ? target.left : frame.x;
    const top = near(frame.top, bounds.top) ? target.top : frame.top;
    const right = near(frameRight(frame), bounds.right)
      ? target.right
      : frameRight(frame);
    const bottom = near(frameBottom(frame), bounds.bottom)
      ? target.bottom
      : frameBottom(frame);
    return { x: left, top, width: right - left, height: bottom - top };
  });
}

const GALLERY_BOUNDS = {
  x: 56,
  top: 84,
  width: PAGE_WIDTH - 112,
  height: PAGE_HEIGHT - 168,
} as const;

function galleryFrame(
  frame: DesignBookletContentFrame,
): DesignBookletContentFrame {
  return {
    x: GALLERY_BOUNDS.x + (frame.x / PAGE_WIDTH) * GALLERY_BOUNDS.width,
    top: GALLERY_BOUNDS.top + (frame.top / PAGE_HEIGHT) * GALLERY_BOUNDS.height,
    width: (frame.width / PAGE_WIDTH) * GALLERY_BOUNDS.width,
    height: (frame.height / PAGE_HEIGHT) * GALLERY_BOUNDS.height,
  };
}

function mappedSectionFrames(
  frames:
    | readonly [DesignBookletContentFrame, DesignBookletContentFrame]
    | undefined,
  mapper: (frame: DesignBookletContentFrame) => DesignBookletContentFrame,
): [DesignBookletContentFrame, DesignBookletContentFrame] | undefined {
  return frames ? [mapper(frames[0]), mapper(frames[1])] : undefined;
}

export function resolveDesignBookletContentLayout(
  page: DesignBookletImagePage,
) {
  const layout = DESIGN_BOOKLET_CONTENT_LAYOUTS[page.layout];
  if (page.variant === "balanced") {
    return {
      ...layout,
      imageFrames: [...layout.imageFrames],
      sectionFrames: layout.sectionFrames
        ? [layout.sectionFrames[0], layout.sectionFrames[1]]
        : undefined,
      borderless: page.layout === "visual-full-bleed",
    };
  }
  if (page.variant === "gallery") {
    return {
      ...layout,
      imageFrames: layout.imageFrames.map(galleryFrame),
      textFrame: layout.textFrame ? galleryFrame(layout.textFrame) : undefined,
      sectionFrames: mappedSectionFrames(layout.sectionFrames, galleryFrame),
      borderless: false,
      tone: "paper" as const,
    };
  }
  const imageOnly =
    layout.category === "visual" || layout.category === "gallery";
  return {
    ...layout,
    imageFrames: edgeImageFrames(page),
    sectionFrames: layout.sectionFrames
      ? [layout.sectionFrames[0], layout.sectionFrames[1]]
      : undefined,
    borderless: true,
    tone: imageOnly ? ("light" as const) : layout.tone,
  };
}

function scaled(value: number, percentage: number) {
  return Math.round(value * (percentage / 100) * 1000) / 1000;
}

export function resolveDesignBookletContentTypography(
  page: DesignBookletImagePage,
) {
  const headline = DESIGN_BOOKLET_CONTENT_TYPOGRAPHY[page.content.headlineSize];
  const body = DESIGN_BOOKLET_CONTENT_TYPOGRAPHY[page.content.bodySize];
  return {
    headlineSize: scaled(headline.headlineSize, page.content.headlineScale),
    headlineLineHeight: scaled(
      headline.headlineLineHeight,
      page.content.headlineScale,
    ),
    bodySize: scaled(body.bodySize, page.content.bodyScale),
    bodyLineHeight: scaled(body.bodyLineHeight, page.content.bodyScale),
    eyebrowSize: scaled(6.4, page.content.eyebrowScale),
    eyebrowLineHeight: scaled(8, page.content.eyebrowScale),
    captionSize: scaled(6.2, page.content.captionScale),
    captionLineHeight: scaled(7.5, page.content.captionScale),
  };
}

const SIZE_CAPACITY_FACTOR = {
  small: 1.2,
  standard: 1,
  large: 0.72,
} as const;

function area(frame: DesignBookletContentFrame | undefined) {
  return frame ? frame.width * frame.height : 0;
}

export function designBookletContentTextWarnings(
  page: DesignBookletImagePage,
): string[] {
  const base = DESIGN_BOOKLET_CONTENT_LAYOUTS[page.layout];
  const resolved = resolveDesignBookletContentLayout(page);
  const headlineSpaceFactor = base.textFrame
    ? Math.max(0.35, area(resolved.textFrame) / area(base.textFrame))
    : 1;
  const sectionSpaceFactor = base.sectionFrames?.[0]
    ? Math.max(
        0.35,
        area(resolved.sectionFrames?.[0]) / area(base.sectionFrames[0]),
      )
    : 1;
  const headlineLimit = Math.floor(
    base.textCapacity.headline *
      SIZE_CAPACITY_FACTOR[page.content.headlineSize] *
      (100 / page.content.headlineScale) *
      headlineSpaceFactor,
  );
  const bodyLimit = Math.floor(
    base.textCapacity.body *
      SIZE_CAPACITY_FACTOR[page.content.bodySize] *
      (100 / page.content.bodyScale) *
      headlineSpaceFactor,
  );
  const sectionLimit = Math.floor(
    base.textCapacity.sectionBody *
      SIZE_CAPACITY_FACTOR[page.content.bodySize] *
      (100 / page.content.bodyScale) *
      sectionSpaceFactor,
  );
  const captionLimit = Math.floor(120 * (100 / page.content.captionScale));
  const warnings: string[] = [];
  if (
    headlineLimit > 0 &&
    page.content.headline.trim().length > headlineLimit
  ) {
    warnings.push("Headline may overflow this layout at the selected size.");
  }
  if (bodyLimit > 0 && page.content.body.trim().length > bodyLimit) {
    warnings.push("Body copy may overflow this layout at the selected size.");
  }
  page.content.sections.forEach((section, index) => {
    if (sectionLimit > 0 && section.body.trim().length > sectionLimit) {
      warnings.push(`Section ${index + 1} copy may overflow this layout.`);
    }
  });
  page.images.slice(0, resolved.slotCount).forEach((image, index) => {
    if (image.caption.trim().length > captionLimit) {
      warnings.push(
        `Image ${index + 1} caption may overflow at the selected size.`,
      );
    }
  });
  return warnings;
}
