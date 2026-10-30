import { expect, it } from "vitest";
import { studioWallAcquisitionFixture } from "../../../../../test/studioWallAcquisitionFixture";
import { createStudioSceneResolver } from "./resolvedScene";
import { prepareStudioPlacement, studioPreparationTasks } from "./preparation";
import { studioPlacementResources } from "./placementResources";
import { previewGesture } from "./gesturePreview";
import {
  previewStudioAttachment,
  updateStudioHouse,
} from "../studioHouseCommands";
import {
  positionWebsitePergola,
  websiteComposition,
} from "../websiteComposition";
import { studioHouseScene } from "../studioHouseScene";
import { alignmentChoices } from "./finiteAlignment";

const sides = ["front", "right", "rear", "left"] as const;
it.each(
  ([0, 37] as const).flatMap((rotation) =>
    sides.map((side) => [rotation, side] as const),
  ),
)(
  "keeps all four fully warm rigid wall approaches structural through sub-input roundoff at %s degrees on %s",
  (rotation, side) => {
    {
      const f = studioWallAcquisitionFixture(rotation, side),
        scene = createStudioSceneResolver().resolve(f.edit),
        task = studioPreparationTasks(scene).find(
          (t) => t.method === "facade",
        )!,
        prepared = prepareStudioPlacement(task),
        cache = studioPlacementResources(
          scene,
          scene,
          [task],
          new Map([[task.dependencyKey, prepared]]),
        ).caches.get("p2:facade")!;
      expect(prepared.kind).toBe("ready");
      for (const epsilon of [-1e-9, 0, 1e-9]) {
        let held: string | undefined;
        for (const fraction of [0.8 / 6, 0.4, 0.8, 1]) {
          const preview = previewGesture(
            cache,
            f.start.x + f.delta.x * fraction + epsilon,
            f.start.y + f.delta.y * fraction,
            f.units,
            held,
          );
          expect(
            preview.candidate?.choice.edge,
            `${side}/${epsilon}/${fraction}`,
          ).toBe(side);
          expect(preview.message).toContain("Release to connect");
          held = preview.key;
          if (fraction === 1) {
            const row = websiteComposition(
              previewStudioAttachment(f.edit, preview.candidate!.choice),
            )[0];
            expect(row.error).toBeNull();
            // World rebase and fresh canonical construction associate floating
            // additions differently. This is stricter than the live 1e-5mm
            // release guard; support, rotation and host remain exact.
            expect(
              Math.hypot(
                row.position!.x - preview.x,
                row.position!.y - preview.y,
              ),
            ).toBeLessThan(1e-9);
            expect(row.position!.rotation).toBe(
              preview.candidate!.pose.rotation,
            );
            expect(row.geometryOptions!.supportDatumMm).toBe(
              preview.candidate!.height,
            );
            expect(row.object.attachment!.host).toEqual(
              preview.candidate!.canonicalHost,
            );
          }
        }
      }
    }
  },
);

it("keeps a genuinely closer peer and the existing held peer preference, without changing ready structural priority", () => {
  const f = studioWallAcquisitionFixture(37, "right"),
    scene = createStudioSceneResolver().resolve(f.edit),
    task = studioPreparationTasks(scene).find((t) => t.method === "facade")!,
    cache = studioPlacementResources(
      scene,
      scene,
      [task],
      new Map([[task.dependencyKey, prepareStudioPlacement(task)]]),
    ).caches.get("p2:facade")!,
    x = f.start.x + (f.delta.x * 0.8) / 6 + 1e-9,
    y = f.start.y + (f.delta.y * 0.8) / 6,
    points = cache.freeOutline.map((p) => ({
      x: p.x + (x - f.start.x),
      y: p.y + (y - f.start.y),
    })),
    line = cache.lines.find((l) => l.label.endsWith(" right"))!,
    peer = alignmentChoices(points, [line], f.units)[0];
  expect(previewGesture(cache, x, y, f.units).candidate?.choice.edge).toBe(
    "right",
  );
  expect(
    previewGesture(cache, x, y, f.units, peer.key).candidate,
  ).toBeUndefined();
  const shift = {
      x: peer.normal.x * -Math.sign(peer.correction) * 0.01,
      y: peer.normal.y * -Math.sign(peer.correction) * 0.01,
    },
    closer = {
      ...line,
      id: "closer",
      start: { x: line.start.x + shift.x, y: line.start.y + shift.y },
      end: { x: line.end.x + shift.x, y: line.end.y + shift.y },
    },
    better = previewGesture({ ...cache, lines: [closer] }, x, y, f.units);
  expect(better.candidate).toBeUndefined();
  expect(better.guides![0].target.id).toBe("closer");
  expect(
    previewGesture(
      { ...cache, lines: [closer] },
      x,
      y,
      f.units,
      cache.candidates.find((c) => c.choice.edge === "right")!.key,
    ).candidate?.choice.edge,
  ).toBe("right");
  const cold = { ...cache, candidates: [] },
    first = previewGesture(cold, x, y, f.units);
  expect(first.candidate).toBeUndefined();
  expect(first.message).toContain("not connected");
  expect(
    previewGesture(cache, x, y, f.units, first.key).candidate,
  ).toBeUndefined();
  // Deterministic existing within-kind sorting does not depend on input order.
  const reversed = previewGesture(
    {
      ...cache,
      candidates: [...cache.candidates].reverse(),
      lines: [...cache.lines].reverse(),
    },
    x,
    y,
    f.units,
  );
  expect(reversed).toEqual(previewGesture(cache, x, y, f.units));
});

it.each([-9e6, 9e6])(
  "accounts for cancellation at translated world origin %s without hiding a genuinely closer guide",
  (offset) => {
    const f = studioWallAcquisitionFixture(37, "right"),
      house = studioHouseScene(f.edit.site, f.edit.spatial)!.houses[0];
    let edit = updateStudioHouse(f.edit, {
      ...house,
      position: {
        ...house.position,
        xMm: String(offset),
        yMm: String(offset - 4000),
      },
    });
    edit = positionWebsitePergola(edit, "p2", {
      originXMm: String(f.start.x + offset),
      originYMm: String(f.start.y + offset),
    });
    const scene = createStudioSceneResolver().resolve(edit),
      task = studioPreparationTasks(scene).find((t) => t.method === "facade")!,
      cache = studioPlacementResources(
        scene,
        scene,
        [task],
        new Map([[task.dependencyKey, prepareStudioPlacement(task)]]),
      ).caches.get("p2:facade")!,
      x = f.start.x + offset + (f.delta.x * 0.8) / 6,
      y = f.start.y + offset + (f.delta.y * 0.8) / 6;
    expect(previewGesture(cache, x, y, f.units).candidate?.choice.edge).toBe(
      "right",
    );
    const points = cache.freeOutline.map((p) => ({
        x: p.x + (x - cache.row.position!.x),
        y: p.y + (y - cache.row.position!.y),
      })),
      line = cache.lines.find((l) => l.label.endsWith(" right"))!,
      peer = alignmentChoices(points, [line], f.units)[0],
      shift = {
        x: peer.normal.x * -Math.sign(peer.correction) * 0.01,
        y: peer.normal.y * -Math.sign(peer.correction) * 0.01,
      },
      closer = {
        ...line,
        id: "closer",
        start: { x: line.start.x + shift.x, y: line.start.y + shift.y },
        end: { x: line.end.x + shift.x, y: line.end.y + shift.y },
      };
    expect(
      previewGesture(cache, x, y, f.units, peer.key).candidate,
    ).toBeUndefined();
    expect(
      previewGesture({ ...cache, lines: [closer] }, x, y, f.units).candidate,
    ).toBeUndefined();
  },
);

it.each([NaN, Infinity, -Infinity])(
  "does not promote an invalid score at pointer X=%s into a connection",
  (x) => {
    const f = studioWallAcquisitionFixture(37, "right"),
      scene = createStudioSceneResolver().resolve(f.edit),
      task = studioPreparationTasks(scene).find((t) => t.method === "facade")!,
      cache = studioPlacementResources(
        scene,
        scene,
        [task],
        new Map([[task.dependencyKey, prepareStudioPlacement(task)]]),
      ).caches.get("p2:facade")!;
    expect(
      previewGesture(cache, x, f.start.y, f.units).candidate,
    ).toBeUndefined();
    expect(
      previewGesture(cache, x, f.start.y, f.units).connection,
    ).toBeUndefined();
  },
);

it.each([
  [
    "front",
    3314.9050448195812,
    -4752.467009401265,
    248.86399923563437,
    500.56638908784737,
  ],
  [
    "rear",
    -6837.618614929552,
    3758.118009925055,
    -248.86399923563437,
    -500.56638908784737,
  ],
] as const)(
  "keeps the nonparallel %s approach positional outside finite along locality despite a legal explicit attachment",
  (side, x, y, dx, dy) => {
    const f = studioWallAcquisitionFixture(37, side),
      edit = positionWebsitePergola(f.edit, "p2", {
        originXMm: String(x),
        originYMm: String(y),
        rotationDeg: "0",
      }),
      scene = createStudioSceneResolver().resolve(edit),
      task = studioPreparationTasks(scene).find((t) => t.method === "facade")!,
      cache = studioPlacementResources(
        scene,
        scene,
        [task],
        new Map([[task.dependencyKey, prepareStudioPlacement(task)]]),
      ).caches.get("p2:facade")!;
    expect(cache.candidates.some((c) => c.choice.edge === side)).toBe(true);
    const explicit = previewStudioAttachment(edit, {
      objectId: "p2",
      houseId: "house",
      edge: side,
      kind: "wall",
      method: "facade",
      alongEdgeMm: 0,
    });
    expect(websiteComposition(explicit)[0].error).toBeNull();
    const preview = previewGesture(cache, x + dx, y + dy, f.units);
    expect(preview.candidate).toBeUndefined();
    expect(preview.connection).toBeUndefined();
    expect(preview.message).toContain("not connected");
    expect(preview.message).toContain("Corner aligned");
    expect(
      previewGesture(cache, x + 30000, y + 30000, f.units).guides,
    ).toHaveLength(0);
  },
);

it("retains deterministic identity ties and real score/held ordering within the existing alignment list", () => {
  const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    a = {
      id: "a",
      label: "a",
      start: { x: -20, y: -5 },
      end: { x: 20, y: -5 },
    },
    b = { ...a, id: "b", label: "b" };
  expect(alignmentChoices(points, [b, a], 1).map((g) => g.target.id)).toEqual([
    "a",
    "b",
  ]);
  expect(alignmentChoices(points, [a, b], 1, "b")[0].target.id).toBe("b");
  const closer = {
    ...b,
    start: { x: -20, y: -4.99 },
    end: { x: 20, y: -4.99 },
  };
  expect(alignmentChoices(points, [a, closer], 1)[0].target.id).toBe("b");
});
