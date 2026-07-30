import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import { getMarketingDesignBookletContent } from "../../../../marketing/lib/designBookletContent";
import DesignBookletWorkbenchClient from "./DesignBookletWorkbenchClient";

function renderWorkbench() {
  return renderIntoDocument(
    <DesignBookletWorkbenchClient
      content={getMarketingDesignBookletContent()}
      pdfEndpoint="/api/qa/design-booklet-workbench/pdf"
      qaFixture
    />,
  );
}

function click(element: Element | null | undefined) {
  expect(element).not.toBeNull();
  act(() => (element as HTMLElement).click());
}

function buttonContaining(
  container: ParentNode,
  text: string,
): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) =>
      candidate.textContent?.replace(/\s+/g, " ").trim().includes(text),
  );
  expect(button, `Expected button containing "${text}"`).toBeDefined();
  return button as HTMLButtonElement;
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function pageRailButtons(container: ParentNode): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll('nav[aria-label="Booklet pages"] button'),
  );
}

function compactText(element: Element): string {
  const number = element.querySelector("span")?.textContent?.trim() ?? "";
  const fullText = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const label = fullText.slice(number.length).trim();
  return `${number} ${label}`.trim();
}

describe("DesignBookletWorkbenchClient", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("starts with the fixed cover and review around Toni's five-page booklet", () => {
    const rendered = renderWorkbench();
    const railButtons = pageRailButtons(rendered.container);

    expect(railButtons).toHaveLength(5);
    expect(railButtons.map(compactText)).toEqual([
      "01 Cover",
      "02 Image 1",
      "03 Image 2",
      "04 Drawings 1",
      "05 Review",
    ]);
    expect(rendered.container.textContent).toContain("Fixed first page");
    expect(rendered.container.textContent).toContain("Fixed final page");
    expect(
      rendered.container.querySelectorAll("[data-composer-page]"),
    ).toHaveLength(3);
    expect(
      rendered.container.querySelectorAll('button[aria-label^="Remove "]'),
    ).toHaveLength(3);

    const cover = rendered.container.querySelector('[data-page-kind="cover"]');
    expect(cover?.textContent).toContain("Pitched pergola");
    expect(cover?.textContent).toContain("Combination roofing");
    expect(cover?.querySelector("img")?.getAttribute("src")).toContain(
      "booklet-toni-03.png",
    );

    click(railButtons[4]);
    const review = rendered.container.querySelector(
      '[data-page-kind="review"]',
    );
    expect(review?.getAttribute("data-booklet-page")).toBe("5");
    expect(review?.textContent).toContain("Review the concept");
    expect(review?.textContent).toContain(
      "Discuss this concept with Sanctuary",
    );

    rendered.unmount();
  });

  it("adds, reorders and removes mixed content pages while keeping fixed endpoints", () => {
    const rendered = renderWorkbench();

    click(buttonContaining(rendered.container, "Add image page"));
    expect(pageRailButtons(rendered.container)).toHaveLength(6);
    expect(
      rendered.container.querySelector('[data-page-kind="image"]'),
    ).not.toBeNull();

    click(buttonContaining(rendered.container, "Add drawing page"));
    expect(pageRailButtons(rendered.container)).toHaveLength(7);
    expect(
      rendered.container.querySelector('[data-page-kind="drawings"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelectorAll("[data-composer-page]"),
    ).toHaveLength(5);

    const addedDrawingCard = rendered.container.querySelector(
      '[data-composer-page="drawing-page-2"]',
    );
    click(
      addedDrawingCard?.querySelector('[aria-label="Move Drawings 2 earlier"]'),
    );
    expect(pageRailButtons(rendered.container).map(compactText)).toEqual([
      "01 Cover",
      "02 Image 1",
      "03 Image 2",
      "04 Drawings 1",
      "05 Drawings 2",
      "06 Image 3",
      "07 Review",
    ]);

    const secondImageCard = rendered.container.querySelector(
      '[data-composer-page="image-page-2"]',
    );
    click(secondImageCard?.querySelector('[aria-label^="Remove "]'));
    expect(pageRailButtons(rendered.container).map(compactText)).toEqual([
      "01 Cover",
      "02 Image 1",
      "03 Drawings 1",
      "04 Drawings 2",
      "05 Image 2",
      "06 Review",
    ]);
    expect(
      rendered.container.querySelector('[data-composer-page="image-page-2"]'),
    ).toBeNull();

    rendered.unmount();
  });

  it("updates focal position and cover, then supports drawing layouts and custom titles", () => {
    const rendered = renderWorkbench();

    const imageCard = rendered.container.querySelector(
      '[data-composer-page="image-page-1"]',
    );
    click(imageCard?.querySelector("button"));
    click(
      rendered.container.querySelector('button[aria-label="Bottom right"]'),
    );

    const imagePreview = rendered.container.querySelector(
      '[data-page-kind="image"] img',
    ) as HTMLImageElement;
    expect(imagePreview.style.objectPosition).toBe("100% 100%");

    click(buttonContaining(rendered.container, "Use as cover"));
    const coverImage = rendered.container.querySelector(
      '[data-page-kind="cover"] img',
    ) as HTMLImageElement;
    expect(coverImage.src).toContain("booklet-toni-01.png");
    expect(coverImage.style.objectPosition).toBe("100% 100%");

    const drawingCard = rendered.container.querySelector(
      '[data-composer-page="drawing-page-1"]',
    );
    click(drawingCard?.querySelector("button"));
    click(buttonContaining(rendered.container, "Four-drawing grid"));

    const drawingPreview = rendered.container.querySelector(
      '[data-page-kind="drawings"]',
    );
    expect(drawingPreview?.getAttribute("data-drawing-layout")).toBe(
      "four-grid",
    );
    expect(
      drawingPreview?.querySelectorAll("[data-drawing-slot]"),
    ).toHaveLength(4);

    const firstDrawingEditor = rendered.container.querySelector(
      '[data-drawing-editor-slot="1"]',
    );
    const titleSelect = firstDrawingEditor?.querySelector(
      "select",
    ) as HTMLSelectElement;
    setSelectValue(titleSelect, "custom");
    const customTitleLabel = Array.from(
      firstDrawingEditor?.querySelectorAll("label") ?? [],
    ).find(
      (label) =>
        label.querySelector("span")?.textContent?.trim() === "Custom title",
    );
    const customTitleInput = customTitleLabel?.querySelector(
      "input",
    ) as HTMLInputElement;
    setInputValue(customTitleInput, "North-west elevation");

    expect(
      drawingPreview?.querySelector('[data-drawing-slot="1"] figcaption')
        ?.textContent,
    ).toBe("North-west elevation");

    rendered.unmount();
  });

  it("keeps replacement image URLs independent and revokes them when their owners leave", () => {
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:image-page")
      .mockReturnValueOnce("blob:cover-copy");
    const revokeObjectUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const rendered = renderWorkbench();

    const imageCard = rendered.container.querySelector(
      '[data-composer-page="image-page-1"]',
    );
    click(imageCard?.querySelector("button"));
    const fileInput = rendered.container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const replacement = new File(["replacement"], "replacement.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: [replacement],
    });
    act(() => fileInput.dispatchEvent(new Event("change", { bubbles: true })));

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(
      rendered.container
        .querySelector('[data-page-kind="image"] img')
        ?.getAttribute("src"),
    ).toBe("blob:image-page");

    click(buttonContaining(rendered.container, "Use as cover"));
    expect(createObjectUrl).toHaveBeenCalledTimes(2);
    expect(
      rendered.container
        .querySelector('[data-page-kind="cover"] img')
        ?.getAttribute("src"),
    ).toBe("blob:cover-copy");

    const imageCardAfterCover = rendered.container.querySelector(
      '[data-composer-page="image-page-1"]',
    );
    click(imageCardAfterCover?.querySelector('[aria-label^="Remove "]'));
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:image-page");
    expect(revokeObjectUrl).not.toHaveBeenCalledWith("blob:cover-copy");

    rendered.unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:cover-copy");
  });
});
