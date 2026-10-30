import { expect, it, vi } from "vitest";
import { defaultBlind, defaultSidePanel, DEFAULT_LIGHTING } from "@sp/configurator/website";
import { studioAttachmentFixture } from "../../../../test/studioAttachmentFixture";
import { createStudioSceneResolver } from "./interaction/resolvedScene";
import { prepareStudioPlacement, studioPreparationTasks } from "./interaction/preparation";
import { changeStudioProduct } from "./studioHouseCommands";
import { websiteComposition } from "./websiteComposition";
import { validateDemoContactArtifacts } from "./demoHouseClearance";

it.each([false, true])("validates real prepared contact points with one rotation calculation (accessories=%s)", accessories => {
  let edit = studioAttachmentFixture(37, "hipped");
  if (accessories) {
    const value = websiteComposition(edit)[0].value!;
    edit = changeStudioProduct(edit, { ...value, selection: { ...value.selection, roof: { ...value.selection.roof,
      blinds: [{ ...defaultBlind("front-1of2"), cover: "PELMET" }], sidePanels: [defaultSidePanel("left-1of1", "aluminium")],
      lighting: { ...DEFAULT_LIGHTING, rafterAmount: "low", rafterCount: 3 } } } });
  }
  const scene = createStudioSceneResolver().resolve(edit), task = studioPreparationTasks(scene).find(task => task.method === "facade")!, result = prepareStudioPlacement(task);
  expect(result.kind).toBe("ready"); if (result.kind !== "ready") throw Error(result.reason);
  const candidate = result.value.candidates.find(candidate => candidate.artifacts.demo && !candidate.canonicalAtZero.error)!;
  const variant = result.value.variants.find(variant => variant.datum === candidate.height)!;
  expect(variant.physical.points.length).toBeGreaterThan(0);
  const original = structuredClone(variant.physical.points), clearance = vi.fn(() => 5), sin = vi.spyOn(Math, "sin"), cos = vi.spyOn(Math, "cos");
  try {
    const validate = (points: typeof variant.physical.points) => validateDemoContactArtifacts(candidate.artifacts.demo!.surface, task.method, points, variant.edge.start.z, candidate.pose, candidate.canonicalAtZero.target!, clearance);
    const first = validate(variant.physical.points);
    expect({ sin: sin.mock.calls.length, cos: cos.mock.calls.length }).toEqual({ sin: 1, cos: 1 });
    expect(clearance).toHaveBeenCalledTimes(1); expect(variant.physical.points).toEqual(original);
    sin.mockClear(); cos.mockClear(); clearance.mockClear();
    expect(validate([...variant.physical.points, ...variant.physical.points])).toEqual(first);
    expect({ sin: sin.mock.calls.length, cos: cos.mock.calls.length }).toEqual({ sin: 1, cos: 1 });
    expect(clearance).toHaveBeenCalledTimes(1);
  } finally { sin.mockRestore(); cos.mockRestore(); }
});
