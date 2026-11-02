import { expect, it, vi } from "vitest";
import {
  studioHouseMaterial,
  studioHouseSurfaceUV,
} from "./studioHouseMaterials";
import { studioAttachmentFixture } from "../../../../test/studioAttachmentFixture";
import { createStudioSceneResolver } from "@/lib/designStudio/interaction/resolvedScene";
import {STUDIO_HOUSE_PALETTE} from './studioHousePalette';
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
    expect(finish.material.bumpScale).toBe(Math.min(section.height * .08, .8));
    expect(finish.material.roughness).toBe(.92);expect(finish.material.metalness).toBe(0);
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

it('keeps the unset roof pale while preserving an explicitly authored old default or custom HEX',()=>{
 for(const colour of [undefined,'#343b39','#506070']){const appearance=colour?{roofColour:colour}:undefined,before=JSON.stringify(appearance),finish=studioHouseMaterial('roof',appearance);expect(finish.material.color.getHexString()).toBe((colour??STUDIO_HOUSE_PALETTE.roof).slice(1));expect(finish.material.roughness).toBe(.92);expect(finish.material.metalness).toBe(0);expect(JSON.stringify(appearance)).toBe(before);finish.dispose();}
});

it('keeps weatherboard courses horizontal and brick joints staggered with bounded existing textures',()=>{
 const board=studioHouseMaterial('wall',{wallMaterial:'weatherboard'}),brick=studioHouseMaterial('wall',{wallMaterial:'brick'}),plain=studioHouseMaterial('wall');
 const sample=(finish:typeof board,x:number,y:number)=>finish.texture!.image.data![(y*256+x)*4];
 expect(plain.texture).toBeNull();expect(plain.material.color.getHexString()).toBe(STUDIO_HOUSE_PALETTE.plaster.slice(1));
 for(const x of [0,64,127,200,255])expect(sample(board,x,0)).toBe(sample(board,64,0));
 expect(sample(board,64,0)).toBeLessThan(sample(board,64,20));
 expect(sample(brick,0,20)).toBeLessThan(sample(brick,128,20));expect(sample(brick,128,84)).toBeLessThan(sample(brick,0,84));
 for(const finish of [board,brick]){expect(finish.texture!.image.data!.byteLength).toBe(256*128*4);expect(finish.texture!.generateMipmaps).toBe(true);expect(finish.material.bumpScale).toBeLessThanOrEqual(1.2);expect(finish.material.metalness).toBe(0);finish.dispose();}plain.dispose();
});

it.each(['hipped','mono','flat'] as const)('keeps local texture coordinates fixed when the %s house moves or rotates',form=>{
 const a=createStudioSceneResolver().resolve(studioAttachmentFixture(0,form)).houses[0],b=createStudioSceneResolver().resolve(studioAttachmentFixture(37,form)).houses[0];
 const before=structuredClone(a.model);expect(b.model.solids!.surfaceSolids.length).toBe(a.model.solids!.surfaceSolids.length);
 for(const [i,solid]of a.model.solids!.surfaceSolids.entries()){if(!solid.renderMesh||!['wall','roof'].includes(solid.kind))continue;const moved=b.model.solids!.surfaceSolids[i],roof=solid.kind==='roof'?a.model.roofPlanes.find(r=>r.id===solid.metadata?.sourceId):undefined,movedRoof=solid.kind==='roof'?b.model.roofPlanes.find(r=>r.id===moved.metadata?.sourceId):undefined;const points=solid.renderMesh.faces.flatMap(f=>f.map(i=>solid.renderMesh!.vertices[i])),movedPoints=moved.renderMesh!.faces.flatMap(f=>f.map(i=>moved.renderMesh!.vertices[i]));const repeat={x:480,y:160};expect(studioHouseSurfaceUV(movedPoints,repeat,movedRoof)).toEqual(studioHouseSurfaceUV(points,repeat,roof));}
 expect(a.model).toEqual(before);
});
