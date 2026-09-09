import { describe, expect, it } from "vitest";
import {
  createProjectDesignBookletDraft,
  createToniDesignBookletDraft,
  neutralizeProjectDesignBookletMedia,
} from "./defaults";
import { allDesignBookletAssetSources } from "./pageModel";

describe("design booklet defaults", () => {
  it("keeps Toni imagery isolated to the standalone fixture", () => {
    expect(
      allDesignBookletAssetSources(createToniDesignBookletDraft()).every(
        (source) => source.useDefaultAsset !== false,
      ),
    ).toBe(true);
  });

  it("starts new project booklets with generic empty image slots", () => {
    const draft = createProjectDesignBookletDraft();
    const sources = allDesignBookletAssetSources(draft);

    expect(draft.customerName).toBe("Customer");
    expect(draft.paperSize).toBe("a4");
    expect(sources).toHaveLength(14);
    expect(
      draft.contentPages
        .filter((page) => page.kind === "image")
        .every((page) => page.images.length === 4),
    ).toBe(true);
    expect(sources.every((source) => source.useDefaultAsset === false)).toBe(
      true,
    );
    expect(sources.some((source) => /toni/i.test(source.altText))).toBe(false);
  });

  it("neutralizes bundled media when an older saved project draft is loaded", () => {
    const draft = neutralizeProjectDesignBookletMedia(
      createToniDesignBookletDraft(),
    );
    const sources = allDesignBookletAssetSources(draft);

    expect(sources.every((source) => source.useDefaultAsset === false)).toBe(
      true,
    );
    expect(draft.customerName).toBe("Toni");
    expect(draft.cover.altText).toBe("Customer design cover image");
  });
});
