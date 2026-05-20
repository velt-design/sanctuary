import type { ViewerSceneModel } from "@sp/geometry";
import type { DrawingWorkbenchVisibilityState } from "@/lib/drawings/state/drawingWorkbenchUiState";

/**
 * Filters a viewer scene down to just the layers/objects the active
 * display mode + visibility toggles should render. Pergola mode is the
 * pass-through identity; house mode walks the layer tree and gates
 * each object on whether it belongs to a deck / opening / house body
 * layer, then drops fully-empty layers.
 *
 * Object classification leans on string-id conventions
 * (`deck-` substring) AND metadata flags (`deckId`, `deckSurfaceMaterial`,
 * `openingId`, `opening_marker`/`opening_outline` kinds). Both are
 * tolerated because legacy scenes may have one tag without the other;
 * removing either branch would hide objects intermittently.
 *
 * Pure: no THREE, no React, no DOM. Same module the main viewport
 * threads its `displayMode` + `visibility` props through to choose
 * what to render.
 */
export function sceneForDisplayMode(
  scene: ViewerSceneModel,
  displayMode: "house" | "pergolas",
  visibility?: DrawingWorkbenchVisibilityState,
): ViewerSceneModel {
  if (displayMode !== "house") return scene;

  const houseVisibility = visibility ?? {
    house: true,
    pergolas: true,
    decks: true,
    openings: true,
  };

  return {
    ...scene,
    layers: scene.layers
      .map((layer) => {
        if (layer.id === "house") {
          return {
            ...layer,
            objects: layer.objects.filter((object) => {
              const metadata =
                "metadata" in object &&
                object.metadata &&
                typeof object.metadata === "object"
                  ? object.metadata
                  : {};
              const openingKind =
                "kind" in object &&
                (object.kind === "opening_marker" ||
                  object.kind === "opening_outline");
              const isOpening =
                openingKind ||
                ("openingId" in metadata &&
                  typeof metadata.openingId === "string");
              if (isOpening) return houseVisibility.openings;

              const isDeck =
                object.id.includes("deck-") ||
                ("deckId" in metadata &&
                  typeof metadata.deckId === "string") ||
                ("deckSurfaceMaterial" in metadata &&
                  typeof metadata.deckSurfaceMaterial === "string");
              if (isDeck) return houseVisibility.decks;

              return houseVisibility.house;
            }),
          };
        }

        if (layer.id === "house_roof_materials") {
          return houseVisibility.house
            ? layer
            : {
                ...layer,
                objects: [],
              };
        }

        return houseVisibility.pergolas
          ? layer
          : {
              ...layer,
              objects: [],
            };
      })
      .filter((layer) => layer.objects.length > 0),
  };
}
