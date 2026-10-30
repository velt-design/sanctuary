import { expect, it } from "vitest";
import { studioAlignmentFixture } from "../../../../../test/studioAlignmentFixture";
import { createStudioSceneResolver } from "./resolvedScene";
import { prepareStudioPlacement, studioPreparationTasks } from "./preparation";
import { studioPlacementResources } from "./placementResources";
import { previewGesture } from "./gesturePreview";
import { dot } from "./finitePlacement";
import { alignmentChoices, composeFiniteAlignment } from "./finiteAlignment";
function resources(fixture: ReturnType<typeof studioAlignmentFixture>) {
  const scene = createStudioSceneResolver().resolve(fixture.edit);
  return {
    scene,
    cache: studioPlacementResources(
      scene,
      scene,
      studioPreparationTasks(scene),
      null,
    ).caches.get("p2:facade")!,
  };
}
it.each([37, 0])(
  "aligns a complete physical footprint to a translated37degree wall without rotation: product%s",
  (rotation) => {
    const f = studioAlignmentFixture(37, rotation, "front", "flat", 10),
      { cache } = resources(f),
      p = cache.row.position!;
    const actual = previewGesture(cache, p.x, p.y, 1);
    expect(actual.candidate).toBeUndefined();
    expect(actual.guides).toHaveLength(1);
    expect(actual.guides![0].witness.kind).toBe(
      rotation === 37 ? "edge" : "vertex",
    );
    expect(
      dot({ x: actual.x - p.x, y: actual.y - p.y }, f.tangent),
    ).toBeCloseTo(0, 8);
    expect(
      Math.max(
        ...actual.points.map((q) =>
          dot({ x: q.x - f.wall.start.x, y: q.y - f.wall.start.y }, f.normal),
        ),
      ),
    ).toBeCloseTo(0, 7);
    const distant = previewGesture(
      cache,
      p.x + f.tangent.x * 30000,
      p.y + f.tangent.y * 30000,
      1,
    );
    expect(distant.guides).toHaveLength(0);
  },
);
it.each(["flat", "mono", "hipped"] as const)(
  "exposes all canonical footprint walls independently of attachment readiness: %s",
  (form) => {
    for (const rotation of [0, 37, 90])
      for (const side of ["front", "right", "rear", "left"] as const) {
        const f = studioAlignmentFixture(rotation, rotation, side, form, 10),
          { scene, cache } = resources(f),
          p = cache.row.position!;
        expect(scene.wallLines).toHaveLength(4);
        expect(cache.targets).toHaveLength(0);
        expect(cache.candidates).toHaveLength(0);
        expect(
          previewGesture(cache, p.x, p.y, 1).guides?.some(
            (g) => g.target.id === f.wall.id,
          ),
        ).toBe(true);
      }
  },
);
it("retains14/18/3 acquisition and hold with only normal correction", () => {
  const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    line = {
      id: "wall",
      label: "Wall",
      start: { x: -20, y: -15 },
      end: { x: 20, y: -15 },
      allowVertex: true,
    };
  expect(alignmentChoices(points, [line], 1)).toHaveLength(0);
  const held = alignmentChoices(points, [line], 1, "wall");
  expect(held).toHaveLength(1);
  expect(held[0].score).toBe(12);
  const remote = {
    id: "remote",
    label: "Remote",
    start: { x: 100, y: 0 },
    end: { x: 100, y: 10 },
    allowVertex: true,
  };
  expect(alignmentChoices(points, [remote], 1)).toHaveLength(0);
  const choice = alignmentChoices(
    points,
    [{ ...line, start: { x: -20, y: -10 }, end: { x: 20, y: -10 } }],
    1,
  );
  const result = composeFiniteAlignment(points, choice, 1);
  expect(result.dy).toBe(-10);
  expect(result.dx).toBe(0);
  expect(result.guides).toHaveLength(1);
});

it("drops the weaker composed normal when it would lose the stronger finite endpoint witness", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const lines = [
    {
      id: "primary",
      label: "Primary",
      start: { x: 20, y: -5 },
      end: { x: 30, y: -5 },
    },
    {
      id: "secondary",
      label: "Secondary",
      start: { x: -13, y: -20 },
      end: { x: -13, y: 20 },
    },
  ];
  const choices = alignmentChoices(points, lines, 1);
  expect(choices[0].target.id).toBe("primary");
  const result = composeFiniteAlignment(points, choices, 1);
  expect(result.guides.map((g) => g.target.id)).toEqual(["primary"]);
  expect(result.dx).toBe(0);
  expect(result.dy).toBe(-5);
});

it.each([
  [37, "front", "flat", 4000, "shorter than"],
  [0, "front", "flat", 4000, "shorter than"],
  [37, "left", "mono", 9500, "slopes"],
] as const)(
  "keeps positional alignment when canonical structural preparation refuses product%s/%s/%s",
  (rotation, side, form, width, refusal) => {
    const f = studioAlignmentFixture(37, rotation, side, form, 10, width);
    const scene = createStudioSceneResolver().resolve(f.edit);
    const tasks = studioPreparationTasks(scene);
    const task = tasks.find(
      (t) => t.objectId === "p2" && t.method === "facade",
    )!;
    const result = prepareStudioPlacement(task);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") throw Error(result.reason);
    const refused = result.value.targets.find((t) => t.target.side === side);
    expect(refused?.target.error?.toLowerCase()).toContain(refusal);
    const cache = studioPlacementResources(
      scene,
      scene,
      tasks,
      new Map([[task.dependencyKey, result]]),
    ).caches.get("p2:facade")!;
    const p = cache.row.position!,
      actual = previewGesture(cache, p.x, p.y, 1);
    expect(actual.candidate).toBeUndefined();
    expect(actual.connection).toBeUndefined();
    expect(actual.guides?.map((g) => g.target.id)).toContain(f.wall.id);
    expect(actual.guides?.[0].witness.kind).toBe(
      rotation === 0 ? "vertex" : "edge",
    );
    expect(actual.message).toContain("not connected");
    expect(
      Math.max(
        ...actual.points.map((q) =>
          dot({ x: q.x - f.wall.start.x, y: q.y - f.wall.start.y }, f.normal),
        ),
      ),
    ).toBeCloseTo(0, 7);
  },
);
