import type { DesignBookletPaperSizeId } from "./types";

export const DESIGN_BOOKLET_DEFAULT_PAPER_SIZE = "a4" as const;

export const DESIGN_BOOKLET_PAPER_SIZES = {
  a4: {
    id: "a4",
    label: "A4",
    width: 841.89,
    height: 595.28,
  },
  a3: {
    id: "a3",
    label: "A3",
    width: 1190.55,
    height: 841.89,
  },
} as const satisfies Record<
  DesignBookletPaperSizeId,
  {
    id: DesignBookletPaperSizeId;
    label: string;
    width: number;
    height: number;
  }
>;

export const DESIGN_BOOKLET_BASE_PAGE_SIZE =
  DESIGN_BOOKLET_PAPER_SIZES[DESIGN_BOOKLET_DEFAULT_PAPER_SIZE];

export function designBookletPageGeometry(paperSize: DesignBookletPaperSizeId) {
  const page = DESIGN_BOOKLET_PAPER_SIZES[paperSize];
  return {
    ...page,
    scaleX: page.width / DESIGN_BOOKLET_BASE_PAGE_SIZE.width,
    scaleY: page.height / DESIGN_BOOKLET_BASE_PAGE_SIZE.height,
  };
}
