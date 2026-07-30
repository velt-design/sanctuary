import { describe, expect, it } from "vitest";
import { getProductBySlug } from "../data/products";
import { generalRoofPreference } from "../app/pergolas-auckland/content";
import { getMarketingDesignBookletContent } from "./designBookletContent";

describe("getMarketingDesignBookletContent", () => {
  it("projects roof-form and material wording from governed marketing owners", () => {
    const content = getMarketingDesignBookletContent();
    const pitched = getProductBySlug("pitched");

    expect(pitched).toBeDefined();
    expect(content.roofForms.pitched.proposition).toBe(pitched?.proposition);
    expect(content.roofForms.gable.name).toBe(getProductBySlug("gable")?.name);
    expect(content.materials.acrylic.label).toBe(
      generalRoofPreference.options[0].label,
    );
    expect(content.materials["solid-lined"].label).toBe(
      generalRoofPreference.options[1].label,
    );
    expect(content.materials.combination.label).toBe(
      generalRoofPreference.options[2].label,
    );
    expect(
      pitched?.details.options?.some((item) =>
        item
          .toLocaleLowerCase()
          .includes(content.materials.combination.summary.toLocaleLowerCase()),
      ),
    ).toBe(true);
    const pitchedGuidance = [
      ...(Array.isArray(pitched?.details.atAGlance)
        ? pitched.details.atAGlance
        : []),
      ...(Array.isArray(pitched?.details.whyItsGood)
        ? pitched.details.whyItsGood
        : []),
    ];
    expect(
      content.materials.combination.supporting.every((item) =>
        pitchedGuidance.includes(item),
      ),
    ).toBe(true);
    expect(content.materials.combination.sections).toHaveLength(2);
    expect(
      content.materials.combination.sections.map((section) => section.id),
    ).toEqual(["acrylic", "solid-lined"]);
    expect(
      pitched?.details.options?.some((item) =>
        item
          .toLocaleLowerCase()
          .includes(
            content.materials.combination.sections[0].summary.toLocaleLowerCase(),
          ),
      ),
    ).toBe(true);
    expect(pitched?.details.performance).toContain(
      content.materials.combination.sections[1].summary,
    );
  });

  it("keeps first-round booklet copy free of prohibited claim categories", () => {
    const copy = JSON.stringify(getMarketingDesignBookletContent());

    expect(copy).not.toMatch(
      /warrant|waterproof|all[- ]weather|performance|timing|pricing|\bprice\b|\bcost\b/i,
    );
  });
});
