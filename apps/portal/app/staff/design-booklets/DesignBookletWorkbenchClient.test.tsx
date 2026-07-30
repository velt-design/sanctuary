import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import { getMarketingDesignBookletContent } from "../../../../marketing/lib/designBookletContent";
import DesignBookletWorkbenchClient from "./DesignBookletWorkbenchClient";

describe("DesignBookletWorkbenchClient", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("starts with the Toni pitched combination booklet and can assign a new cover", () => {
    const rendered = renderIntoDocument(
      <DesignBookletWorkbenchClient
        content={getMarketingDesignBookletContent()}
        pdfEndpoint="/api/qa/design-booklet-workbench/pdf"
        qaFixture
      />,
    );

    expect(rendered.container.textContent).toContain("Pitched pergola");
    expect(rendered.container.textContent).toContain("Combination roofing");
    const coverImage = rendered.container.querySelector(
      '[data-booklet-page="1"] img',
    ) as HTMLImageElement;
    expect(coverImage.src).toContain("booklet-toni-03.png");

    const renderOneCard = rendered.container.querySelector(
      '[data-render-slot="render-1"]',
    );
    const makeCover = Array.from(
      renderOneCard?.querySelectorAll("button") ?? [],
    ).find((button) => button.textContent === "Make cover");
    expect(makeCover).toBeDefined();
    act(() => makeCover?.click());

    const nextCoverImage = rendered.container.querySelector(
      '[data-booklet-page="1"] img',
    ) as HTMLImageElement;
    expect(nextCoverImage.src).toContain("booklet-toni-01.png");
    expect(
      rendered.container
        .querySelector('[data-render-slot="render-1"]')
        ?.getAttribute("data-cover-image"),
    ).toBe("true");
    rendered.unmount();
  });

  it("shows each of the six A4 preview pages from the page rail", () => {
    const rendered = renderIntoDocument(
      <DesignBookletWorkbenchClient
        content={getMarketingDesignBookletContent()}
        pdfEndpoint="/api/qa/design-booklet-workbench/pdf"
      />,
    );
    const pageButtons = Array.from(
      rendered.container.querySelectorAll(
        'nav[aria-label="Booklet pages"] button',
      ),
    );
    expect(pageButtons).toHaveLength(6);

    act(() => (pageButtons[5] as HTMLButtonElement).click());
    expect(
      rendered.container.querySelector('[data-booklet-page="6"]'),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("Two roofing zones.");
    expect(rendered.container.textContent).toContain("Acrylic roof");
    expect(rendered.container.textContent).toContain(
      "COLORSTEEL + timber ceiling",
    );
    rendered.unmount();
  });
});
