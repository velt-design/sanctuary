import { describe, expect, it } from "vitest";
import {
  createToniDesignBookletDraft,
  TONI_DESIGN_BOOKLET_ASSETS,
} from "./defaults";
import {
  allDesignBookletAssetSources,
  buildDesignBookletRenderModel,
  createDesignBookletDrawingPage,
  createDesignBookletImagePage,
  DESIGN_BOOKLET_DRAWING_LAYOUTS,
  designBookletDrawingTitle,
  moveDesignBookletContentPage,
  moveDesignBookletDrawing,
  normalizeDesignBookletSheetTitle,
  renderableDesignBookletAssetSources,
  visibleDesignBookletDrawings,
} from "./pageModel";
import type {
  DesignBookletDrawingLayoutId,
  DesignBookletDrawingPage,
  DesignBookletDrawingTitlePresetId,
} from "./types";

function drawingPage(): DesignBookletDrawingPage {
  const page = createToniDesignBookletDraft().contentPages.find(
    (candidate): candidate is DesignBookletDrawingPage =>
      candidate.kind === "drawings",
  );
  if (!page) throw new Error("The Toni fixture must include a drawing page.");
  return page;
}

describe("design booklet page model", () => {
  it("builds a dynamic ordered render model with fixed first and last pages", () => {
    const draft = createToniDesignBookletDraft();
    const [firstImage, secondImage, drawings] = draft.contentPages;
    if (!firstImage || !secondImage || !drawings) {
      throw new Error("The Toni fixture must include three content pages.");
    }
    draft.contentPages = [drawings, secondImage, firstImage];

    expect(
      buildDesignBookletRenderModel(draft).map(
        ({ key, kind, label, pageNumber, pageCount }) => ({
          key,
          kind,
          label,
          pageNumber,
          pageCount,
        }),
      ),
    ).toEqual([
      {
        key: "cover",
        kind: "cover",
        label: "Cover",
        pageNumber: 1,
        pageCount: 5,
      },
      {
        key: "drawing-page-1",
        kind: "drawings",
        label: "PROPOSED ROOF PLAN",
        pageNumber: 2,
        pageCount: 5,
      },
      {
        key: "image-page-2",
        kind: "image",
        label: "Visual 1",
        pageNumber: 3,
        pageCount: 5,
      },
      {
        key: "image-page-1",
        kind: "image",
        label: "Visual 2",
        pageNumber: 4,
        pageCount: 5,
      },
      {
        key: "review",
        kind: "review",
        label: "Review",
        pageNumber: 5,
        pageCount: 5,
      },
    ]);
    expect(buildDesignBookletRenderModel(draft)[1]).toMatchObject({
      sheetNumber: "A-01",
    });
  });

  it("supports the two-page minimum when no optional content pages remain", () => {
    const draft = createToniDesignBookletDraft();
    draft.contentPages = [];

    expect(buildDesignBookletRenderModel(draft)).toEqual([
      {
        key: "cover",
        kind: "cover",
        label: "Cover",
        pageNumber: 1,
        pageCount: 2,
      },
      {
        key: "review",
        kind: "review",
        label: "Review",
        pageNumber: 2,
        pageCount: 2,
      },
    ]);
  });

  it("creates uniquely identified image and drawing pages from Toni assets", () => {
    const draft = createToniDesignBookletDraft();
    const image = createDesignBookletImagePage(draft.contentPages, {
      id: "render-1",
      alt: TONI_DESIGN_BOOKLET_ASSETS["render-1"].alt,
    });
    const drawings = createDesignBookletDrawingPage(draft.contentPages, {
      id: "plan",
      alt: TONI_DESIGN_BOOKLET_ASSETS.plan.alt,
    });
    const nextImage = createDesignBookletImagePage(
      [...draft.contentPages, image, drawings],
      {
        id: "render-2",
        alt: TONI_DESIGN_BOOKLET_ASSETS["render-2"].alt,
      },
    );

    expect(image).toMatchObject({
      id: "image-page-3",
      kind: "image",
      layout: "visual-full-bleed",
      images: [
        {
          assetId: "image-page-3-image",
          defaultAssetId: "render-1",
          focalPoint: "center",
        },
        { assetId: "image-page-3-image-2" },
        { assetId: "image-page-3-image-3" },
        { assetId: "image-page-3-image-4" },
      ],
    });
    expect(drawings).toMatchObject({
      id: "drawing-page-2",
      kind: "drawings",
      pageTitle: "CONCEPT DRAWINGS",
      revision: "01",
      layout: "one-large",
    });
    expect(drawings.drawings.map((item) => item.title)).toEqual([
      { kind: "preset", value: "plan" },
      { kind: "preset", value: "section" },
      { kind: "preset", value: "elevation" },
      { kind: "preset", value: "isometric" },
    ]);
    expect(
      new Set(drawings.drawings.map((item) => item.image.assetId)).size,
    ).toBe(4);
    expect(nextImage.id).toBe("image-page-4");
  });

  it("normalizes sheet titles to architectural uppercase", () => {
    expect(normalizeDesignBookletSheetTitle("Roof framing plan")).toBe(
      "ROOF FRAMING PLAN",
    );
  });

  it("moves optional pages without moving past either boundary", () => {
    const pages = createToniDesignBookletDraft().contentPages;

    expect(
      moveDesignBookletContentPage(pages, "image-page-1", 1).map(
        (page) => page.id,
      ),
    ).toEqual(["image-page-2", "image-page-1", "drawing-page-1"]);
    expect(
      moveDesignBookletContentPage(pages, "drawing-page-1", -1).map(
        (page) => page.id,
      ),
    ).toEqual(["image-page-1", "drawing-page-1", "image-page-2"]);
    expect(moveDesignBookletContentPage(pages, "image-page-1", -1)).toBe(pages);
    expect(moveDesignBookletContentPage(pages, "missing-page", 1)).toBe(pages);
  });

  it("moves drawings while preserving the four reusable slots", () => {
    const drawings = drawingPage().drawings;

    const moved = moveDesignBookletDrawing(
      drawings,
      "drawing-page-1-item-1",
      1,
    );
    expect(moved.map((item) => item.id)).toEqual([
      "drawing-page-1-item-2",
      "drawing-page-1-item-1",
      "drawing-page-1-item-3",
      "drawing-page-1-item-4",
    ]);
    expect(moved).toHaveLength(4);
    expect(
      moveDesignBookletDrawing(drawings, "drawing-page-1-item-1", -1),
    ).toBe(drawings);
    expect(moveDesignBookletDrawing(drawings, "missing-drawing", 1)).toBe(
      drawings,
    );
  });

  it.each([
    ["one-large", 1],
    ["two-equal", 2],
    ["large-plus-two", 3],
    ["four-grid", 4],
  ] satisfies Array<[DesignBookletDrawingLayoutId, number]>)(
    "exposes the correct drawings and frames for %s",
    (layout, slotCount) => {
      const page = drawingPage();
      page.layout = layout;

      expect(visibleDesignBookletDrawings(page)).toHaveLength(slotCount);
      expect(DESIGN_BOOKLET_DRAWING_LAYOUTS[layout].slotCount).toBe(slotCount);
      expect(DESIGN_BOOKLET_DRAWING_LAYOUTS[layout].frames).toHaveLength(
        slotCount,
      );
    },
  );

  it.each([
    ["plan", "Plan"],
    ["section", "Section"],
    ["elevation", "Elevation"],
    ["isometric", "Isometric"],
  ] satisfies Array<[DesignBookletDrawingTitlePresetId, string]>)(
    "formats the %s drawing title",
    (value, label) => {
      expect(designBookletDrawingTitle({ kind: "preset", value })).toBe(label);
    },
  );

  it("trims a custom drawing title", () => {
    expect(
      designBookletDrawingTitle({
        kind: "custom",
        value: "  Pool-facing elevation  ",
      }),
    ).toBe("Pool-facing elevation");
  });

  it("loads only visible drawing slots while retaining reusable slot data", () => {
    const draft = createToniDesignBookletDraft();

    expect(allDesignBookletAssetSources(draft)).toHaveLength(14);
    expect(
      renderableDesignBookletAssetSources(draft).map(
        (source) => source.assetId,
      ),
    ).toEqual([
      "cover-image",
      "image-page-1-image",
      "image-page-2-image",
      "drawing-page-1-drawing-1",
      "review-image",
    ]);
  });
});
