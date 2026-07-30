import { describe, expect, it } from "vitest";
import {
  DESIGN_BOOKLET_PRESENTATION,
  designBookletCssBaselineOffset,
  normalizeDesignBookletPresentationText,
} from "./presentation";

const presentation = DESIGN_BOOKLET_PRESENTATION;

describe("design booklet presentation", () => {
  it("keeps the shared page frames inside landscape A4", () => {
    expect(presentation.page.width / presentation.page.height).toBeCloseTo(
      297 / 210,
      4,
    );

    expect(presentation.drawing.area.x).toBeGreaterThanOrEqual(0);
    expect(
      presentation.drawing.area.x + presentation.drawing.area.width,
    ).toBeLessThanOrEqual(presentation.page.width);
    expect(presentation.drawing.area.top).toBeGreaterThanOrEqual(0);
    expect(
      presentation.drawing.area.top + presentation.drawing.area.height,
    ).toBeLessThanOrEqual(presentation.page.height);

    expect(presentation.review.image.x).toBeGreaterThanOrEqual(0);
    expect(
      presentation.review.image.x + presentation.review.image.width,
    ).toBeLessThanOrEqual(presentation.page.width);
    expect(presentation.review.image.top).toBeGreaterThanOrEqual(0);
    expect(
      presentation.review.image.top + presentation.review.image.height,
    ).toBeLessThanOrEqual(presentation.page.height);
    expect(presentation.review.story.x + presentation.review.story.width).toBe(
      presentation.page.width,
    );
    const reviewCopyInset =
      presentation.review.copy.x - presentation.review.story.x;
    expect(
      presentation.page.width -
        (presentation.review.copy.x + presentation.review.copy.width),
    ).toBeCloseTo(reviewCopyInset, 8);
    expect(presentation.review.image.width).toBeCloseTo(
      presentation.page.width * 0.45,
      8,
    );
  });

  it("retains the merged page inset and bottom-anchored cover composition", () => {
    expect(presentation.chrome.insetLeft).toBeCloseTo(31.99, 2);
    expect(presentation.chrome.insetRight).toBeCloseTo(31.99, 2);
    expect(presentation.cover.story.x).toBe(presentation.chrome.insetLeft);
    expect(presentation.cover.story.bottom).toBeCloseTo(53.04, 2);
    expect(presentation.cover.story.width).toBeCloseTo(
      presentation.page.width * 0.47,
      8,
    );
    expect("top" in presentation.cover.story).toBe(false);
  });

  it("converts shared baselines to CSS line-box positions using the matching font metrics", () => {
    const metrics = presentation.typography.bodyFontMetrics;
    const expectedSingleLineOffset =
      ((metrics.ascent - metrics.descent) / metrics.unitsPerEm / 2 + 0.5) * 10;

    expect(designBookletCssBaselineOffset(10)).toBeCloseTo(
      expectedSingleLineOffset,
      8,
    );
    expect(designBookletCssBaselineOffset(28, 30)).toBeCloseTo(
      30 / 2 +
        ((metrics.ascent - metrics.descent) / metrics.unitsPerEm / 2) * 28,
      8,
    );

    const displayMetrics = presentation.typography.displayFontMetrics;
    expect(designBookletCssBaselineOffset(10, 10, "display")).toBeCloseTo(
      ((displayMetrics.ascent - displayMetrics.descent) /
        displayMetrics.unitsPerEm /
        2 +
        0.5) *
        10,
      8,
    );
  });

  it("normalizes browser and PDF text identically", () => {
    expect(
      normalizeDesignBookletPresentationText(
        "  Toni\u00a0\u2014\u00a0Sanctuary\u2019s concept  ",
      ),
    ).toBe("Toni - Sanctuary's concept");
  });
});
