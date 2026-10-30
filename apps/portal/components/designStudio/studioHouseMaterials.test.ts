import { expect, it, vi } from "vitest";
import {
  studioHouseMaterial,
  studioHouseSurfaceUV,
} from "./studioHouseMaterials";
import { studioAttachmentFixture } from "../../../../test/studioAttachmentFixture";
import { createStudioSceneResolver } from "@/lib/designStudio/interaction/resolvedScene";
import { representativeRoofProfile } from "@sp/geometry";

it("uses the actual shared roof profile and authored colour on clipped canonical roof faces", () => {
  const scene = createStudioSceneResolver().resolve(studioAttachmentFixture()),
    house = scene.houses[0];
  for (const profile of ["corrugated", "trapezoidal", "tray"] as const) {
    const finish = studioHouseMaterial("roof", {
      roofProfile: profile,
      roofTrayWidth: 300,
      roofColour: "#506070",
    });
    const section = representativeRoofProfile(profile, 300);
    expect(finish.repeat.x).toBe(section.pitch);
    expect(finish.material.bumpScale).toBe(section.height);
    expect(finish.material.color.getHexString()).toBe("506070");
    const image = finish.texture!.image;
    expect(new Set(image.data)).not.toEqual(new Set([255]));
    for (const solid of house.model.solids!.surfaceSolids.filter(
      (s) => s.kind === "roof",
    )) {
      const roof = house.model.roofPlanes.find(
        (roof) => roof.id === solid.metadata?.sourceId,
      )!;
      expect(roof).toBeDefined();
      const before = structuredClone(solid),
        points = solid.renderMesh!.faces.flatMap((face) =>
          face.map((i) => solid.renderMesh!.vertices[i]),
        );
      const uv = studioHouseSurfaceUV(points, finish.repeat, roof);
      expect(uv).toHaveLength(points.length * 2);
      expect(uv.every(Number.isFinite)).toBe(true);
      expect(solid).toEqual(before);
    }
    const texture = vi.spyOn(finish.texture!, "dispose"),
      material = vi.spyOn(finish.material, "dispose");
    finish.dispose();
    expect(texture).toHaveBeenCalledOnce();
    expect(material).toHaveBeenCalledOnce();
  }
});
it("owns distinct wall presentation resources, finite flat UVs and their cleanup", () => {
  const plain = studioHouseMaterial("wall"),
    board = studioHouseMaterial("wall", { wallMaterial: "weatherboard" }),
    brick = studioHouseMaterial("wall", { wallMaterial: "brick" });
  expect(plain.texture).toBeNull();
  expect(board.texture!.image.data).not.toEqual(brick.texture!.image.data);
  expect(board.material).not.toBe(brick.material);
  expect(
    studioHouseSurfaceUV(
      [
        { x: 0, y: 0, z: 3 },
        { x: 3, y: 0, z: 3 },
        { x: 0, y: 4, z: 3 },
      ],
      { x: 1, y: 1 },
      {
        id: "flat",
        boundary: [],
        plane: {
          origin: { x: 0, y: 0, z: 3 },
          normal: { x: 0, y: 0, z: 1 },
          xAxis: { x: 1, y: 0, z: 0 },
          yAxis: { x: 0, y: 1, z: 0 },
        },
        fallVector: { x: 0, y: 0, z: 0 },
      },
    ),
  ).toEqual([0, 0, 3, 0, 0, 4]);
  plain.dispose();
  board.dispose();
  brick.dispose();
});
