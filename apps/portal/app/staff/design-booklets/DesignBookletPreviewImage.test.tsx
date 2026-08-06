import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import DesignBookletPreviewImage from "./DesignBookletPreviewImage";
import type { DesignBookletPreviewAsset } from "./previewAssets";

function asset(
  state: DesignBookletPreviewAsset["state"],
  src = "",
): DesignBookletPreviewAsset {
  return {
    id: "cover",
    src,
    alt: "Customer design image",
    label: "Cover",
    defaultAssetId: "render-1",
    state,
  };
}

describe("DesignBookletPreviewImage", () => {
  it("uses a labelled solid placeholder when no customer image exists", () => {
    const rendered = renderIntoDocument(
      <DesignBookletPreviewImage
        asset={asset("empty")}
        alt="Customer design image"
        showEmptyLabel
        onDisplayState={vi.fn()}
      />,
    );

    const surface = rendered.container.querySelector("[data-image-state]");
    expect(surface?.getAttribute("data-image-state")).toBe("empty");
    expect(rendered.container.textContent).toContain("No image added");
    expect(rendered.container.querySelector("img")).toBeNull();
  });

  it("shows loading progress and reports when the image is display-ready", () => {
    const onDisplayState = vi.fn();
    const rendered = renderIntoDocument(
      <DesignBookletPreviewImage
        asset={asset("loading", "blob:customer-image")}
        alt="Customer design image"
        onDisplayState={onDisplayState}
      />,
    );

    expect(rendered.container.textContent).toContain("Loading image...");
    const image = rendered.container.querySelector("img");
    expect(image).not.toBeNull();
    act(() => image?.dispatchEvent(new Event("load")));
    expect(onDisplayState).toHaveBeenCalledWith(
      "cover",
      "blob:customer-image",
      "ready",
    );
  });

  it("reports failed image display without leaving a silent broken image", () => {
    const onDisplayState = vi.fn();
    const rendered = renderIntoDocument(
      <DesignBookletPreviewImage
        asset={{
          ...asset("error", "https://example.com/customer-image.jpg"),
          errorMessage: "Image needs to be replaced",
        }}
        alt="Customer design image"
        onDisplayState={onDisplayState}
      />,
    );

    expect(rendered.container.textContent).toContain(
      "Image needs to be replaced",
    );
    const image = rendered.container.querySelector("img");
    act(() => image?.dispatchEvent(new Event("error")));
    expect(onDisplayState).toHaveBeenCalledWith(
      "cover",
      "https://example.com/customer-image.jpg",
      "error",
    );
  });
});
