import { expect, it, vi } from "vitest";
import { studioAttachmentFixture } from "../../../../../test/studioAttachmentFixture";
import { createStudioSceneResolver } from "./resolvedScene";
import {
  addWebsitePergola,
  websiteComposition,
  positionWebsitePergola,
} from "../websiteComposition";
import { changeStudioProduct, updateStudioHouse } from "../studioHouseCommands";
import { studioHouseScene } from "../studioHouseScene";
import { websiteCompositionPriceEligibility } from "../websiteCompositionEligibility";
import { defaultBlind, defaultSidePanel } from "@sp/configurator/website";
import * as envelope from "../websiteEligibilityEnvelope";
import * as geometry from "@sp/configurator/geometry";
import * as physical from "../websiteProductPhysical";
import * as accessories from "@sp/geometry";
function fixture(accessoryBearing = false) {
  let edit = positionWebsitePergola(
    addWebsitePergola(studioAttachmentFixture(), "peer"),
    "peer",
    { originXMm: "100000", originYMm: "100000" },
  );
  if (accessoryBearing) {
    const value = websiteComposition(edit)[0].value!;
    edit = changeStudioProduct(edit, {
      ...value,
      supportDatumMm: "3200",
      selection: {
        ...value.selection,
        roof: {
          ...value.selection.roof,
          blinds: [{ ...defaultBlind("front-1of2"), cover: "PELMET" }],
          sidePanels: [defaultSidePanel("left-1of1", "aluminium")],
        },
      },
    });
  }
  return edit;
}
it("reuses the exact envelope across rigid product/house poses without geometry, physical or accessory reconstruction", () => {
  const edit = fixture(true),
    house = studioHouseScene(edit.site, edit.spatial)!.houses[0],
    poses = [
      positionWebsitePergola(edit, "p2", {
        originXMm: "21000",
        originYMm: "3700",
        rotationDeg: "37",
      }),
      updateStudioHouse(edit, {
        ...house,
        position: { xMm: "800", yMm: "300", rotationDeg: "37" },
      }),
    ];
  const expected = poses.map((e) =>
    websiteCompositionPriceEligibility(
      websiteComposition(e),
      e.site.websiteJoins,
    ),
  );
  const resolver = createStudioSceneResolver(),
    original = resolver.resolve(edit),
    artifact = original.products[0].eligibility;
  const constructors = [
    vi.spyOn(envelope, "websiteEligibilityEnvelope"),
    vi.spyOn(geometry, "solvePergolaPreview"),
    vi.spyOn(physical, "websiteProductPhysical"),
    vi.spyOn(accessories, "buildRepresentativeBlind"),
    vi.spyOn(accessories, "buildRepresentativeSidePanel"),
  ];
  for (const [i, next] of poses.entries()) {
    const scene = resolver.resolve(next);
    expect(scene.arrangementEligibility).toBe(expected[i]);
    expect(scene.products[0].eligibility).toBe(artifact);
  }
  constructors.forEach((spy) => {
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
it.each(["accessories", "support"] as const)(
  "invalidates on %s inputs while preserving the canonical conservative return",
  (input) => {
    const edit = fixture(),
      value = websiteComposition(edit)[0].value!;
    const changed = changeStudioProduct(edit, {
      ...value,
      ...(input === "support" ? { supportDatumMm: "3200" } : {}),
      selection: {
        ...value.selection,
        roof: {
          ...value.selection.roof,
          ...(input === "accessories"
            ? {
                blinds: [{ ...defaultBlind("front-1of2"), cover: "PELMET" }],
                sidePanels: [defaultSidePanel("left-1of1", "aluminium")],
              }
            : {}),
        },
      },
    });
    const expected = websiteCompositionPriceEligibility(
        websiteComposition(changed),
        changed.site.websiteJoins,
      ),
      resolver = createStudioSceneResolver(),
      before = resolver.resolve(edit),
      constructor = vi.spyOn(envelope, "websiteEligibilityEnvelope");
    const after = resolver.resolve(changed);
    expect(after.products[0].eligibility).not.toBe(
      before.products[0].eligibility,
    );
    expect(constructor).toHaveBeenCalled();
    expect(after.arrangementEligibility).toBe(expected);
    constructor.mockRestore();
  },
);
it("does not make physical join availability a gate for unjoined envelope eligibility", () => {
  const edit = fixture(),
    expected = websiteCompositionPriceEligibility(
      websiteComposition(edit),
      undefined,
    ),
    spy = vi
      .spyOn(physical, "websiteProductPhysical")
      .mockImplementation(() => {
        throw Error("Deliberate missing join artifact");
      });
  const scene = createStudioSceneResolver().resolve(edit);
  expect(scene.products.every((p) => p.physical === null)).toBe(true);
  expect(scene.arrangementEligibility).toBe(expected);
  spy.mockRestore();
});
