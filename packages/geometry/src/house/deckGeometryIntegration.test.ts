import { describe, expect, it } from "vitest";
import { buildHouseModel3D } from "../houseModel";
import {
  makeConfig,
  makeAttachmentEdge,
  expectVerticalPrismRenderMesh,
} from "./houseModelTestSupport";

describe("house model deck geometry", () => {
  it("builds shared deck geometry for attached, detached, and custom decks", () => {
    const config = makeConfig();
    config.houseContext.model = {
      ...config.houseContext.model!,
      decks: [
        {
          id: "deck-attached",
          shape: "preset",
          presetType: "rect_attached",
          outline: [
            { x: 0, y: 0, z: 0 },
            { x: 6000, y: 0, z: 0 },
            { x: 6000, y: 3000, z: 0 },
            { x: 0, y: 3000, z: 0 },
          ],
          topSurfaceElevationMm: 0,
          hostEdgeId: "rear",
          isAttached: true,
          surfaceMaterial: "timber_decking",
          supportContext: {
            classification: "threshold_attached",
          },
        },
        {
          id: "deck-detached",
          shape: "preset",
          presetType: "rect_detached",
          outline: [
            { x: 7000, y: 1200, z: 0 },
            { x: 9800, y: 1200, z: 0 },
            { x: 9800, y: 3600, z: 0 },
            { x: 7000, y: 3600, z: 0 },
          ],
          topSurfaceElevationMm: 450,
          isAttached: false,
          surfaceMaterial: "composite",
          supportContext: {
            classification: "ground_supported",
          },
        },
        {
          id: "deck-custom",
          shape: "custom",
          outline: [
            { x: -2800, y: 800, z: 0 },
            { x: -400, y: 800, z: 0 },
            { x: -400, y: 2200, z: 0 },
            { x: -1600, y: 2200, z: 0 },
            { x: -1600, y: 3200, z: 0 },
            { x: -2800, y: 3200, z: 0 },
          ],
          topSurfaceElevationMm: 75,
          isAttached: false,
          surfaceMaterial: "concrete",
          supportContext: {
            classification: "mixed_or_unclear",
          },
        },
      ],
    };

    const model = buildHouseModel3D({
      houseId: 'test-house',
      config,
      attachmentEdge: makeAttachmentEdge(),
    });

    expect(model?.decks).toHaveLength(3);
    expect(model?.decks!.map((deck) => deck.id)).toEqual([
      "deck-attached",
      "deck-detached",
      "deck-custom",
    ]);

    const attachedDeck = model?.decks!.find(
      (deck) => deck.id === "deck-attached",
    );
    const detachedDeck = model?.decks!.find(
      (deck) => deck.id === "deck-detached",
    );
    const customDeck = model?.decks!.find((deck) => deck.id === "deck-custom");

    expect(attachedDeck?.supportClassification).toBe("threshold_attached");
    expect(attachedDeck?.topSurfaceElevationMm).toBe(0);
    expect(attachedDeck?.boundary.every((point) => point.z === 0)).toBe(true);
    expect(detachedDeck?.supportClassification).toBe("ground_supported");
    expect(detachedDeck?.topSurfaceElevationMm).toBe(450);
    expect(detachedDeck?.boundary.every((point) => point.z === 450)).toBe(true);
    expect(customDeck?.shape).toBe("custom");
    expect(customDeck?.boundary).toHaveLength(6);
    expect(customDeck?.boundary.every((point) => point.z === 75)).toBe(true);

    const deckSolids =
      model?.solids?.surfaceSolids.filter((solid) => solid.kind === "deck") ??
      [];
    expect(deckSolids).toHaveLength(3);
    const steppedSolid = deckSolids.find(
      (solid) => solid.metadata?.sourceId === "deck-detached",
    );
    expect(steppedSolid?.thicknessMm).toBe(40);
    expectVerticalPrismRenderMesh(steppedSolid?.renderMesh, 410, 450);
  });
});
