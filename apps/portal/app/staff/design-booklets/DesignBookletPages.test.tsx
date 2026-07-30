import { afterEach, describe, expect, it } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import { getMarketingDesignBookletContent } from "../../../../marketing/lib/designBookletContent";
import {
  createToniDesignBookletDraft,
  TONI_DESIGN_BOOKLET_ASSETS,
} from "@/lib/designBooklets/defaults";
import {
  allDesignBookletAssetSources,
  DESIGN_BOOKLET_REVIEW_COPY,
} from "@/lib/designBooklets/pageModel";
import { DESIGN_BOOKLET_PRESENTATION } from "@/lib/designBooklets/presentation";
import type {
  DesignBookletDraft,
  DesignBookletDrawingLayoutId,
} from "@/lib/designBooklets/types";
import DesignBookletPages, {
  type DesignBookletPreviewAsset,
} from "./DesignBookletPages";

const presentation = DESIGN_BOOKLET_PRESENTATION;

function point(value: number): string {
  return `calc(var(--booklet-point) * ${value})`;
}

function assetsFor(
  draft: DesignBookletDraft,
): Record<string, DesignBookletPreviewAsset> {
  return Object.fromEntries(
    allDesignBookletAssetSources(draft).map((source) => {
      const defaultAsset = TONI_DESIGN_BOOKLET_ASSETS[source.defaultAssetId];
      return [
        source.assetId,
        {
          id: source.assetId,
          src: defaultAsset.src,
          alt: source.altText,
          label: defaultAsset.label,
          defaultAssetId: source.defaultAssetId,
        },
      ];
    }),
  );
}

function renderPage(draft: DesignBookletDraft, selectedPageKey: string) {
  return renderIntoDocument(
    <DesignBookletPages
      selectedPageKey={selectedPageKey}
      draft={draft}
      content={getMarketingDesignBookletContent()}
      assets={assetsFor(draft)}
    />,
  );
}

describe("DesignBookletPages", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the fixed cover with governed roof and material labels", () => {
    const draft = createToniDesignBookletDraft();
    const rendered = renderPage(draft, "cover");
    const cover = rendered.container.querySelector('[data-page-kind="cover"]');

    expect(cover?.getAttribute("data-page-key")).toBe("cover");
    expect(cover?.getAttribute("aria-label")).toBe("Booklet page 1 of 5");
    expect(cover?.textContent).toContain("Outdoor living concept");
    expect(cover?.textContent).toContain("Pitched pergola");
    expect(cover?.textContent).toContain("Combination roofing");
    expect(cover?.querySelector('[class*="coverShade"]')).toBeNull();
    const coverStory = cover?.querySelector("main") as HTMLElement;
    expect(coverStory.style.left).toBe(point(presentation.cover.story.x));
    expect(coverStory.style.bottom).toBe(
      point(presentation.cover.story.bottom),
    );
    expect(coverStory.style.top).toBe("");

    rendered.unmount();
  });

  it("renders an image page as one full-bleed image with header and footer chrome only", () => {
    const draft = createToniDesignBookletDraft();
    const imagePage = draft.contentPages.find((page) => page.kind === "image");
    expect(imagePage?.kind).toBe("image");
    if (!imagePage || imagePage.kind !== "image") return;
    imagePage.image = {
      ...imagePage.image,
      focalPoint: "bottom-right",
    };
    const rendered = renderPage(draft, imagePage.id);
    const page = rendered.container.querySelector('[data-page-kind="image"]');
    const image = page?.querySelector("img") as HTMLImageElement;

    expect(page?.querySelectorAll("img")).toHaveLength(1);
    expect(image.style.objectPosition).toBe("100% 100%");
    expect(page?.querySelector("header")).not.toBeNull();
    expect(page?.querySelector("footer")).not.toBeNull();
    expect(page?.querySelector("main")).toBeNull();
    expect(page?.querySelector("figure")).toBeNull();
    expect(page?.querySelector("h1, h2, h3, figcaption")).toBeNull();
    expect(page?.textContent).toContain("CONCEPT IMAGE / 02");
    expect(page?.textContent).toContain("02 / 05");

    rendered.unmount();
  });

  it.each([
    ["one-large", 1, ["Plan"]],
    ["two-equal", 2, ["Plan", "Section"]],
    ["large-plus-two", 3, ["Plan", "Section", "Elevation"]],
    ["four-grid", 4, ["Plan", "Section", "Elevation", "Isometric"]],
  ] satisfies Array<[DesignBookletDrawingLayoutId, number, string[]]>)(
    "renders the %s drawing preset with %i titled slots",
    (layout, expectedSlots, expectedTitles) => {
      const draft = createToniDesignBookletDraft();
      const drawingPage = draft.contentPages.find(
        (page) => page.kind === "drawings",
      );
      expect(drawingPage?.kind).toBe("drawings");
      if (!drawingPage || drawingPage.kind !== "drawings") return;
      drawingPage.layout = layout;

      const rendered = renderPage(draft, drawingPage.id);
      const page = rendered.container.querySelector(
        '[data-page-kind="drawings"]',
      );
      const figures = Array.from(
        page?.querySelectorAll("[data-drawing-slot]") ?? [],
      );

      expect(page?.getAttribute("data-drawing-layout")).toBe(layout);
      expect(figures).toHaveLength(expectedSlots);
      expect(
        figures.map(
          (figure) => figure.querySelector("figcaption")?.textContent,
        ),
      ).toEqual(expectedTitles);
      expect(figures.every((figure) => figure.querySelector("img"))).toBe(true);

      rendered.unmount();
    },
  );

  it("renders the fixed final review copy and dynamic final page number", () => {
    const draft = createToniDesignBookletDraft();
    const rendered = renderPage(draft, "review");
    const review = rendered.container.querySelector(
      '[data-page-kind="review"]',
    );

    expect(review?.getAttribute("data-page-key")).toBe("review");
    expect(review?.getAttribute("data-booklet-page")).toBe("5");
    expect(review?.getAttribute("aria-label")).toBe("Booklet page 5 of 5");
    const reviewImage = review?.querySelector("figure") as HTMLElement;
    expect(reviewImage.querySelector("img")).not.toBeNull();
    expect(reviewImage.style.width).toBe(
      point(presentation.review.image.width),
    );
    expect(review?.querySelector("main")).not.toBeNull();
    expect(review?.textContent).toContain(DESIGN_BOOKLET_REVIEW_COPY.title);
    const promptSections = Array.from(
      review?.querySelectorAll("main section") ?? [],
    );
    expect(promptSections).toHaveLength(
      DESIGN_BOOKLET_REVIEW_COPY.prompts.length,
    );
    expect(
      promptSections.map(
        (section) => section.querySelector(":scope > span")?.textContent,
      ),
    ).toEqual(["01", "02", "03"]);
    for (const prompt of DESIGN_BOOKLET_REVIEW_COPY.prompts) {
      expect(review?.textContent).toContain(prompt.title);
      expect(review?.textContent).toContain(prompt.copy);
    }
    expect(review?.textContent).toContain(
      DESIGN_BOOKLET_REVIEW_COPY.callToAction,
    );
    expect(review?.textContent).toContain("05 / 05");

    rendered.unmount();
  });
});
