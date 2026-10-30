import { studioAttachmentFixture } from "./studioAttachmentFixture";
import { studioHouseScene } from "../apps/portal/lib/designStudio/studioHouseScene";
import {
  changeStudioProduct,
  updateStudioHouse,
} from "../apps/portal/lib/designStudio/studioHouseCommands";
import {
  positionWebsitePergola,
  transformWebsitePoint,
  websiteComposition,
} from "../apps/portal/lib/designStudio/websiteComposition";

/** The ordinary V10 Black Box fixture. Starts and deltas are rigid equivalents
 * around the actual house origin, not independently repositioned wall cases. */
export function studioWallAcquisitionFixture(
  rotation: 0 | 37,
  side: "front" | "right" | "rear" | "left",
) {
  let edit = studioAttachmentFixture(rotation);
  const house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
  edit = updateStudioHouse(edit, {
    ...house,
    widthMm: "8000",
    depthMm: "6500",
    wallHeightMm: "3200",
    eaveHeightMm: "3200",
    roof: { ...house.roof, overhangMm: "450" },
    position: { xMm: "0", yMm: "-4000", rotationDeg: String(rotation) },
  });
  const value = websiteComposition(edit)[0].value!;
  edit = changeStudioProduct(edit, {
    ...value,
    supportDatumMm: "2400",
    selection: {
      ...value.selection,
      roof: {
        ...value.selection.roof,
        family: "box",
        frameFinish: "black",
        attachmentIntent: "freestanding",
      },
    },
  });
  const [x, y, dx, dy] = {
    front: [1000, -7200, 500, 250],
    right: [8200, -3000, -250, 500],
    rear: [1000, 2700, 500, -250],
    left: [-6200, -3000, 250, 500],
  }[side];
  const start = transformWebsitePoint(
    { x, y: y + 4000 },
    { x: 0, y: -4000, rotation },
  );
  const delta = transformWebsitePoint(
    { x: dx, y: dy },
    { x: 0, y: 0, rotation },
  );
  edit = positionWebsitePergola(edit, "p2", {
    originXMm: String(start.x),
    originYMm: String(start.y),
    rotationDeg: String(rotation),
  });
  return { edit, start, delta, units: 38.09560627582645 };
}
