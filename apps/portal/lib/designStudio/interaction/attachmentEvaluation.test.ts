import { projectStudioPreparedMethod } from "./preparedAttachmentProjection";
import { expect, it, vi } from "vitest";
import { studioAttachmentFixture } from "../../../../../test/studioAttachmentFixture";
import { createStudioSceneResolver } from "./resolvedScene";
import { studioPreparationTasks, prepareStudioPlacement } from "./preparation";
import {
  alongCandidate,
  connectionDeparture,
  updateConnectionDeparture,
  previewGesture,
} from "./gesturePreview";
import { studioPlacementResources } from "./placementResources";
import {
  changeStudioProduct,
  previewStudioAttachment,
  updateStudioHouse,
} from "../studioHouseCommands";
import {
  websiteComposition,
  transformWebsitePoint,
} from "../websiteComposition";
import { websiteProductPhysical } from "../websiteProductPhysical";
import { studioHouseScene } from "../studioHouseScene";
import { defaultBlind, defaultSidePanel } from "@sp/configurator/website";
import { representativeBlindOpenings } from "@sp/geometry";
import { studioPreparationReply } from "../../../../../test/studioPlacementTestWorker";
import * as geometry from "@sp/configurator/geometry";
import * as physical from "../websiteProductPhysical";
import * as houseGeometry from "../studioHouseGeometry";
function prepared(edit: ReturnType<typeof studioAttachmentFixture>) {
  const scene = createStudioSceneResolver().resolve(edit),
    task = studioPreparationTasks(scene).find((t) => t.method === "facade")!,
    result = prepareStudioPlacement(task);
  if (result.kind !== "ready") throw Error(result.reason);
  return { scene, task, descriptor: result.value };
}
it.each(
  [0, 37, 90, 450].flatMap((rotation) =>
    [false, true].map((accessories) => ({ rotation, accessories })),
  ),
)(
  "matches full canonical physical variants cold and warm at along 0/925/2500, house $rotation, accessories $accessories",
  ({ rotation, accessories }) => {
    let edit = studioAttachmentFixture(0);
    if (accessories) {
      const value = websiteComposition(edit)[0].value!;
      edit = changeStudioProduct(edit, {
        ...value,
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
    // Existing bound Facade without the new setting retains its exact legacy contact.
    edit=previewStudioAttachment(edit,{objectId:"p2",houseId:"house",edge:"right",kind:"wall",method:"facade"});
    const warm = prepared(edit),
      house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
    const moved = updateStudioHouse(edit, {
        ...house,
        position: { ...house.position, rotationDeg: String(rotation) },
      }),
      cold = prepared(moved);
    expect(warm.task.dependencyKey).toBe(cold.task.dependencyKey);
    const transport = structuredClone({
      version: "studio.placement-task.v1" as const,
      scopeKey: "roundtrip",
      epoch: "1",
      pendingKey: null,
      incarnation: 3,
      requestId: 7,
      task: cold.task,
    });
    const reply = structuredClone(studioPreparationReply(transport));
    expect(reply.result.kind).toBe("ready");
    if (reply.result.kind === "ready") {
      expect(reply.result.value.version).toBe("studio.placement-method.v3");
      expect(
        reply.result.value.candidates.every((c) =>
          Object.hasOwn(c, "canonicalAtZero"),
        ),
      ).toBe(true);
    }
    if (reply.result.kind !== "ready") throw Error(reply.result.reason);
    for (const descriptor of [
      warm.descriptor,
      cold.descriptor,
      reply.result.value,
    ]) {
      const candidate = projectStudioPreparedMethod(
        descriptor,
        cold.task,
        cold.scene,
      ).candidates.find((c) => c.choice.edge === "right")!;
      expect(candidate.travel).toBe(2500);
      for (const along of [0, 925, 2500, 925, 0]) {
        const canonical = websiteComposition(
            previewStudioAttachment(moved, {
              ...candidate.choice,
              alongEdgeMm: along,
            }),
          )[0],
          expected = websiteProductPhysical(canonical, true);
        if (accessories) {
          const opening = representativeBlindOpenings(
            geometry.solvePergolaPreview(
              canonical.design!.input,
              canonical.design!.roof,
              canonical.geometryOptions,
            ).geometry!.assembly,
          ).find((o) => o.id === "front-1of2")!;
          expect(opening.top > 2800 ? 165 : 135).toBe(along === 0 ? 135 : 165);
        }
        const solves = vi.spyOn(geometry, "solvePergolaPreview"),
          houses = vi.spyOn(houseGeometry, "solveStudioHouse"),
          meshes = vi.spyOn(physical, "websiteProductPhysical");
        const actual = alongCandidate(candidate, along);
        expect(solves).not.toHaveBeenCalled();
        expect(houses).not.toHaveBeenCalled();
        expect(meshes).not.toHaveBeenCalled();
        solves.mockRestore();
        houses.mockRestore();
        meshes.mockRestore();
        expect(actual.unresolved).toBeUndefined();
        expect(actual.height).toBe(along === 0 ? 2677 : 2833);
        expect(actual.height).toBe(canonical.geometryOptions!.supportDatumMm);
        expect(actual.physical).toEqual(expected);
        expect(actual.pose.x).toBeCloseTo(canonical.position!.x, 8);
        expect(actual.pose.y).toBeCloseTo(canonical.position!.y, 8);
        expect(actual.pose.rotation).toBeCloseTo(
          canonical.position!.rotation,
          8,
        );
        expect(actual.canonicalHost).toEqual(canonical.object.attachment!.host);
        for (const [i, p] of actual.physical.points.entries()) {
          const actualWorld = transformWebsitePoint(p, actual.pose),
            expectedWorld = transformWebsitePoint(
              expected.points[i],
              canonical.position!,
            );
          expect(actualWorld.x).toBeCloseTo(expectedWorld.x, 7);
          expect(actualWorld.y).toBeCloseTo(expectedWorld.y, 7);
          expect(p.z).toBe(expected.points[i].z);
        }
      }
    }
  },
  20000,
);
it.each([0, 450])(
  "uses canonical host departure authority with and without companion at house %s",
  (rotation) => {
    const attached = previewStudioAttachment(
      studioAttachmentFixture(rotation),
      {
        objectId: "p2",
        houseId: "house",
        edge: "rear",
        kind: "wall",
        method: "facade",
      },
    );
    for (const hostOnly of [false, true]) {
      const edit = structuredClone(attached);
      if (hostOnly) delete edit.site.websiteAttachments;
      const { scene, task, descriptor } = prepared(edit),
        cache = studioPlacementResources(
          scene,
          scene,
          [task],
          new Map([
            [task.dependencyKey, { kind: "ready" as const, value: descriptor }],
          ]),
        ).caches.get("p2:facade")!;
      const departure = connectionDeparture(cache)!;
      expect(departure).not.toBeNull();
      const start = cache.row.position!,
        point = (mm: number) => ({
          x: start.x + departure.n.x * mm,
          y: start.y + departure.n.y * mm,
        });
      const outward = point(5),
        blocked = updateConnectionDeparture(departure, outward.x, outward.y, 1);
      expect(blocked).toBe("connect:house:rear:facade");
      const leaving = previewGesture(
        cache,
        outward.x,
        outward.y,
        1,
        undefined,
        blocked,
      );
      expect(leaving.candidate).toBeUndefined();
      expect(leaving.x).toBeCloseTo(outward.x, 8);
      expect(leaving.y).toBeCloseTo(outward.y, 8);
      const shortReturn = point(2);
      expect(
        updateConnectionDeparture(departure, shortReturn.x, shortReturn.y, 1),
      ).toBe(blocked);
      const rearm = point(1);
      expect(
        updateConnectionDeparture(departure, rearm.x, rearm.y, 1),
      ).toBeUndefined();
      expect(
        previewGesture(cache, rearm.x, rearm.y, 1).candidate?.canonicalHost,
      ).toEqual(cache.row.object.attachment!.host);
    }
  },
  20000,
);

it("retains exact base refusal through transport while a legal nonzero position can succeed", () => {
  let edit = studioAttachmentFixture();
  const house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
  edit = updateStudioHouse(edit, {
    ...house,
    wallHeightMm: "2700",
    eaveHeightMm: "2700",
  });
  const { scene, task } = prepared(edit);
  const request = structuredClone({
    version: "studio.placement-task.v1" as const,
    scopeKey: "refused-zero",
    epoch: "1",
    pendingKey: null,
    incarnation: 5,
    requestId: 8,
    task,
  });
  const reply = structuredClone(studioPreparationReply(request));
  if (reply.result.kind !== "ready") throw Error(reply.result.reason);
  const descriptor = reply.result.value,
    base = descriptor.candidates.find((c) => c.choice.edge === "right")!;
  expect(base.canonicalAtZero.error).toBeTruthy();
  expect(() => previewStudioAttachment(edit, base.choice)).toThrow(
    base.canonicalAtZero.error!,
  );
  const candidate = projectStudioPreparedMethod(
    descriptor,
    task,
    scene,
  ).candidates.find((c) => c.choice.edge === "right")!;
  expect(candidate.points).toEqual([]);
  expect(candidate.unresolved).toEqual({
    kind: "refused",
    reason: base.canonicalAtZero.error,
  });
  for (const along of [925, 2500]) {
    const expected = websiteComposition(
      previewStudioAttachment(edit, { ...base.choice, alongEdgeMm: along }),
    )[0];
    const actual = alongCandidate(candidate, along);
    expect(actual.unresolved).toBeUndefined();
    expect(actual.height).toBe(expected.geometryOptions!.supportDatumMm);
    expect(actual.physical).toEqual(websiteProductPhysical(expected, true));
    expect(actual.pose).toEqual(expected.position);
    expect(actual.canonicalHost).toEqual(expected.object.attachment!.host);
  }
});
it("keeps a deliberately evicted zero variant preparing until exact refill", () => {
  const edit = studioAttachmentFixture(),
    { scene, task, descriptor } = prepared(edit);
  const base = descriptor.candidates.find((c) => c.choice.edge === "right")!,
    datum = base.canonicalAtZero.geometryOptions!.supportDatumMm;
  const evicted = structuredClone(descriptor);
  evicted.variants = evicted.variants.filter((v) => v.datum !== datum);
  const missing = projectStudioPreparedMethod(
    evicted,
    task,
    scene,
  ).candidates.find((c) => c.choice.edge === "right")!;
  expect(missing.points).toEqual([]);
  expect(missing.unresolved).toMatchObject({ kind: "preparing", datum });
  const reply = structuredClone(
    studioPreparationReply(
      structuredClone({
        version: "studio.placement-task.v1" as const,
        scopeKey: "zero-refill",
        epoch: "1",
        pendingKey: null,
        incarnation: 8,
        requestId: 9,
        task: { ...task, requestedDatums: [datum] },
      }),
    ),
  );
  if (reply.result.kind !== "ready") throw Error(reply.result.reason);
  const actual = projectStudioPreparedMethod(
    reply.result.value,
    task,
    scene,
  ).candidates.find((c) => c.choice.edge === "right")!;
  const expected = websiteComposition(
    previewStudioAttachment(edit, base.choice),
  )[0];
  expect(actual.unresolved).toBeUndefined();
  expect(actual.height).toBe(expected.geometryOptions!.supportDatumMm);
  expect(actual.physical).toEqual(websiteProductPhysical(expected, true));
});
