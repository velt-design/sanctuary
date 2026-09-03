import { describe, expect, it } from "vitest";
import { createToniDesignBookletDraft } from "./defaults";
import { visibleDesignBookletContentImages } from "./contentLayouts";
import {
  designBookletContentTextWarnings,
  resolveDesignBookletContentLayout,
  resolveDesignBookletContentTypography,
} from "./contentPresentation";
import { DESIGN_BOOKLET_BASE_PAGE_SIZE } from "./paperGeometry";
import {
  DESIGN_BOOKLET_CONTENT_LAYOUT_IDS,
  DESIGN_BOOKLET_CONTENT_VARIANT_IDS,
} from "./types";

describe("design booklet content layouts", () => {
  it("keeps all 30 layout variants inside landscape A4", () => {
    const draft = createToniDesignBookletDraft();
    const page = draft.contentPages.find(
      (candidate) => candidate.kind === "image",
    );
    if (!page || page.kind !== "image") throw new Error("Image page required.");

    for (const layoutId of DESIGN_BOOKLET_CONTENT_LAYOUT_IDS) {
      page.layout = layoutId;
      for (const variant of DESIGN_BOOKLET_CONTENT_VARIANT_IDS) {
        page.variant = variant;
        const layout = resolveDesignBookletContentLayout(page);
        expect(layout.imageFrames).toHaveLength(layout.slotCount);
        for (const frame of [
          ...layout.imageFrames,
          ...(layout.textFrame ? [layout.textFrame] : []),
          ...(layout.sectionFrames ?? []),
        ]) {
          expect(frame.x).toBeGreaterThanOrEqual(0);
          expect(frame.top).toBeGreaterThanOrEqual(0);
          expect(frame.x + frame.width).toBeLessThanOrEqual(
            DESIGN_BOOKLET_BASE_PAGE_SIZE.width,
          );
          expect(frame.top + frame.height).toBeLessThanOrEqual(
            DESIGN_BOOKLET_BASE_PAGE_SIZE.height,
          );
        }
      }
    }
  });

  it("resolves edge-to-edge and gallery framing from the shared geometry", () => {
    const draft = createToniDesignBookletDraft();
    const page = draft.contentPages.find(
      (candidate) => candidate.kind === "image",
    );
    if (!page || page.kind !== "image") throw new Error("Image page required.");
    page.layout = "visual-full-bleed";
    page.variant = "edge";
    expect(resolveDesignBookletContentLayout(page).imageFrames[0]).toEqual({
      x: 0,
      top: 0,
      width: DESIGN_BOOKLET_BASE_PAGE_SIZE.width,
      height: DESIGN_BOOKLET_BASE_PAGE_SIZE.height,
    });

    page.variant = "gallery";
    const galleryFrame = resolveDesignBookletContentLayout(page).imageFrames[0];
    expect(galleryFrame.x).toBeGreaterThan(0);
    expect(galleryFrame.top).toBeGreaterThan(0);
    expect(galleryFrame.x + galleryFrame.width).toBeLessThan(
      DESIGN_BOOKLET_BASE_PAGE_SIZE.width,
    );
    expect(galleryFrame.top + galleryFrame.height).toBeLessThan(
      DESIGN_BOOKLET_BASE_PAGE_SIZE.height,
    );
  });

  it("changes visible slots without discarding page images or copy", () => {
    const draft = createToniDesignBookletDraft();
    const page = draft.contentPages.find(
      (candidate) => candidate.kind === "image",
    );
    if (!page || page.kind !== "image") throw new Error("Image page required.");
    const assetIds = page.images.map((image) => image.assetId);
    page.content.headline = "A retained design story";
    page.content.headlineScale = 240;

    page.layout = "gallery-grid-four";
    page.variant = "edge";
    expect(visibleDesignBookletContentImages(page)).toHaveLength(4);
    page.layout = "story-image-left";
    page.variant = "gallery";
    expect(visibleDesignBookletContentImages(page)).toHaveLength(1);
    expect(page.images.map((image) => image.assetId)).toEqual(assetIds);
    expect(page.content.headline).toBe("A retained design story");
    expect(page.content.headlineScale).toBe(240);
    expect(page.variant).toBe("gallery");
  });

  it("scales each typography role independently up to its bounded maximum", () => {
    const draft = createToniDesignBookletDraft();
    const page = draft.contentPages.find(
      (candidate) => candidate.kind === "image",
    );
    if (!page || page.kind !== "image") throw new Error("Image page required.");
    page.content.headlineScale = 400;
    page.content.bodyScale = 175;
    page.content.eyebrowScale = 150;
    page.content.captionScale = 150;

    expect(resolveDesignBookletContentTypography(page)).toMatchObject({
      headlineSize: 124,
      bodySize: 17.675,
      eyebrowSize: 9.6,
      captionSize: 9.3,
    });
  });

  it("warns when large text exceeds the selected template capacity", () => {
    const draft = createToniDesignBookletDraft();
    const page = draft.contentPages.find(
      (candidate) => candidate.kind === "image",
    );
    if (!page || page.kind !== "image") throw new Error("Image page required.");
    page.layout = "story-image-left";
    page.content.headlineSize = "large";
    page.content.bodySize = "large";
    page.content.headline = "H".repeat(90);
    page.content.body = "B".repeat(500);
    expect(designBookletContentTextWarnings(page)).toEqual([
      "Headline may overflow this layout at the selected size.",
      "Body copy may overflow this layout at the selected size.",
    ]);
  });
});
