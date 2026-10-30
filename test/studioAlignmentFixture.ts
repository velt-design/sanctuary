import { studioAttachmentFixture } from "./studioAttachmentFixture";
import { studioHouseScene } from "../apps/portal/lib/designStudio/studioHouseScene";
import { createStudioSceneResolver } from "../apps/portal/lib/designStudio/interaction/resolvedScene";
import {
  changeStudioProduct,
  updateStudioHouse,
} from "../apps/portal/lib/designStudio/studioHouseCommands";
import {
  websiteComposition,
  positionWebsitePergola,
  transformWebsitePoint,
} from "../apps/portal/lib/designStudio/websiteComposition";
import {
  segmentAxis,
  dot,
} from "../apps/portal/lib/designStudio/interaction/finitePlacement";
/** Actual canonical wall and complete physical support witness, not a pointer
 * approximation or replacement geometry implementation. */
export function studioAlignmentFixture(
  houseRotation = 37,
  productRotation = 37,
  side: "front" | "rear" | "left" | "right" = "front",
  form: "flat" | "mono" | "hipped" = "flat",
  gap = 50,
  houseWidth = 9500,
) {
  let edit = studioAttachmentFixture(houseRotation, form),
    value = websiteComposition(edit)[0].value!;
  if (houseWidth !== 9500) {
    const house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
    edit = updateStudioHouse(edit, { ...house, widthMm: String(houseWidth) });
  }
  edit = changeStudioProduct(edit, {
    ...value,
    selection: {
      ...value.selection,
      roof: { ...value.selection.roof, attachmentIntent: "freestanding" },
    },
  });
  edit = positionWebsitePergola(edit, "p2", {
    rotationDeg: String(productRotation),
  });
  const scene = createStudioSceneResolver().resolve(edit),
    wall = scene.wallLines.find((line) => line.label.endsWith(" " + side))!;
  const tangent = segmentAxis(wall).u,
    normal = { x: -tangent.y, y: tangent.x };
  const house = scene.houses[0],
    centre = {
      x: house.footprint.reduce((n, p) => n + p.x / house.footprint.length, 0),
      y: house.footprint.reduce((n, p) => n + p.y / house.footprint.length, 0),
    };
  if (
    dot({ x: centre.x - wall.start.x, y: centre.y - wall.start.y }, normal) < 0
  ) {
    normal.x = -normal.x;
    normal.y = -normal.y;
  }
  const points = scene.products[0].hull.map((p) =>
      transformWebsitePoint(p, { x: 0, y: 0, rotation: productRotation }),
    ),
    targetN = dot(wall.start, normal),
    targetT = (dot(wall.start, tangent) + dot(wall.end, tangent)) / 2;
  const top = Math.max(...points.map((p) => dot(p, normal))),
    minT = Math.min(...points.map((p) => dot(p, tangent))),
    maxT = Math.max(...points.map((p) => dot(p, tangent))),
    n = targetN - top - gap,
    t = targetT - (minT + maxT) / 2;
  edit = positionWebsitePergola(edit, "p2", {
    originXMm: String(normal.x * n + tangent.x * t),
    originYMm: String(normal.y * n + tangent.y * t),
  });
  return { edit, wall, normal, tangent, gap };
}
