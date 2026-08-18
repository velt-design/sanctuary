import type {
  DesignBookletContentLayoutId,
  DesignBookletImagePage,
  DesignBookletTextSizeId,
} from "./types";

type DesignBookletContentPageCategory =
  | "visual"
  | "gallery"
  | "story"
  | "information";

export type DesignBookletContentFrame = {
  x: number;
  top: number;
  width: number;
  height: number;
};

type DesignBookletContentLayoutDefinition = {
  label: string;
  description: string;
  category: DesignBookletContentPageCategory;
  slotCount: 0 | 1 | 2 | 3 | 4;
  tone: "paper" | "light";
  imageFrames: readonly DesignBookletContentFrame[];
  textFrame?: DesignBookletContentFrame;
  sectionFrames?: readonly [
    DesignBookletContentFrame,
    DesignBookletContentFrame,
  ];
  textCapacity: {
    headline: number;
    body: number;
    sectionBody: number;
  };
};

export const DESIGN_BOOKLET_CONTENT_LAYOUTS: Record<
  DesignBookletContentLayoutId,
  DesignBookletContentLayoutDefinition
> = {
  "visual-full-bleed": {
    label: "Full-bleed hero",
    description: "One image with maximum impact.",
    category: "visual",
    slotCount: 1,
    tone: "light",
    imageFrames: [{ x: 0, top: 0, width: 841.89, height: 595.28 }],
    textCapacity: { headline: 0, body: 0, sectionBody: 0 },
  },
  "visual-framed": {
    label: "Framed hero",
    description: "One image with calm architectural margins.",
    category: "visual",
    slotCount: 1,
    tone: "paper",
    imageFrames: [{ x: 32, top: 76, width: 777.89, height: 448 }],
    textCapacity: { headline: 0, body: 0, sectionBody: 0 },
  },
  "visual-split": {
    label: "Two-up comparison",
    description: "Two images with equal visual weight.",
    category: "visual",
    slotCount: 2,
    tone: "paper",
    imageFrames: [
      { x: 32, top: 76, width: 381.95, height: 448 },
      { x: 427.94, top: 76, width: 381.95, height: 448 },
    ],
    textCapacity: { headline: 0, body: 0, sectionBody: 0 },
  },
  "gallery-hero-two": {
    label: "Hero + two details",
    description: "One leading view with two supporting details.",
    category: "gallery",
    slotCount: 3,
    tone: "paper",
    imageFrames: [
      { x: 32, top: 76, width: 529, height: 448 },
      { x: 577, top: 76, width: 232.89, height: 216 },
      { x: 577, top: 308, width: 232.89, height: 216 },
    ],
    textCapacity: { headline: 0, body: 0, sectionBody: 0 },
  },
  "gallery-grid-four": {
    label: "Four-image grid",
    description: "Four equal views in a disciplined grid.",
    category: "gallery",
    slotCount: 4,
    tone: "paper",
    imageFrames: [
      { x: 32, top: 76, width: 381.95, height: 216 },
      { x: 427.94, top: 76, width: 381.95, height: 216 },
      { x: 32, top: 308, width: 381.95, height: 216 },
      { x: 427.94, top: 308, width: 381.95, height: 216 },
    ],
    textCapacity: { headline: 0, body: 0, sectionBody: 0 },
  },
  "story-image-left": {
    label: "Image left + story",
    description: "A strong image beside concise design intent.",
    category: "story",
    slotCount: 1,
    tone: "paper",
    imageFrames: [{ x: 32, top: 76, width: 456, height: 448 }],
    textFrame: { x: 526, top: 116, width: 283.89, height: 360 },
    textCapacity: { headline: 80, body: 430, sectionBody: 0 },
  },
  "story-image-right": {
    label: "Story + image right",
    description: "Editorial copy leading into one image.",
    category: "story",
    slotCount: 1,
    tone: "paper",
    imageFrames: [{ x: 353.89, top: 76, width: 456, height: 448 }],
    textFrame: { x: 32, top: 116, width: 283.89, height: 360 },
    textCapacity: { headline: 80, body: 430, sectionBody: 0 },
  },
  "story-image-top": {
    label: "Wide image + story",
    description: "A panoramic view above a compact narrative.",
    category: "story",
    slotCount: 1,
    tone: "paper",
    imageFrames: [{ x: 32, top: 76, width: 777.89, height: 276 }],
    textFrame: { x: 32, top: 386, width: 777.89, height: 132 },
    textCapacity: { headline: 100, body: 520, sectionBody: 0 },
  },
  "information-text": {
    label: "Information feature",
    description: "Text-led page with one supporting image.",
    category: "information",
    slotCount: 1,
    tone: "paper",
    imageFrames: [{ x: 560, top: 88, width: 249.89, height: 420 }],
    textFrame: { x: 32, top: 112, width: 476, height: 360 },
    textCapacity: { headline: 110, body: 680, sectionBody: 0 },
  },
  "information-material-split": {
    label: "Two-section materials",
    description: "Two material stories with an image for each.",
    category: "information",
    slotCount: 2,
    tone: "paper",
    imageFrames: [
      { x: 32, top: 158, width: 381.95, height: 182 },
      { x: 427.94, top: 158, width: 381.95, height: 182 },
    ],
    textFrame: { x: 32, top: 80, width: 777.89, height: 62 },
    sectionFrames: [
      { x: 32, top: 368, width: 381.95, height: 142 },
      { x: 427.94, top: 368, width: 381.95, height: 142 },
    ],
    textCapacity: { headline: 90, body: 0, sectionBody: 260 },
  },
};

export const DESIGN_BOOKLET_CONTENT_TYPOGRAPHY: Record<
  DesignBookletTextSizeId,
  {
    headlineSize: number;
    headlineLineHeight: number;
    bodySize: number;
    bodyLineHeight: number;
  }
> = {
  small: {
    headlineSize: 24,
    headlineLineHeight: 25.5,
    bodySize: 8.7,
    bodyLineHeight: 12.2,
  },
  standard: {
    headlineSize: 31,
    headlineLineHeight: 32,
    bodySize: 10.1,
    bodyLineHeight: 14.1,
  },
  large: {
    headlineSize: 39,
    headlineLineHeight: 39.5,
    bodySize: 11.8,
    bodyLineHeight: 16.1,
  },
};

export function visibleDesignBookletContentImages(
  page: DesignBookletImagePage,
) {
  return page.images.slice(
    0,
    DESIGN_BOOKLET_CONTENT_LAYOUTS[page.layout].slotCount,
  );
}
