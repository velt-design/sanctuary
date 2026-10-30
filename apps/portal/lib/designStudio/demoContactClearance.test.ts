import { expect, it, vi } from "vitest";
import { defaultBlind, defaultSidePanel, DEFAULT_LIGHTING } from "@sp/configurator/website";
import { studioAttachmentFixture } from "../../../../test/studioAttachmentFixture";
import { createStudioSceneResolver } from "./interaction/resolvedScene";
import { prepareStudioPlacement, studioPreparationTasks } from "./interaction/preparation";
import { changeStudioProduct } from "./studioHouseCommands";
import { websiteComposition } from "./websiteComposition";
import { evaluateDemoClearance } from "./demoContactClearance";

it.each([false, true])("transforms real prepared faces with a constant trigonometry budget (accessories=%s)", accessories => {
  let edit = studioAttachmentFixture(37, "hipped");
  if (accessories) {
    const value = websiteComposition(edit)[0].value!;
    edit = changeStudioProduct(edit, { ...value, selection: { ...value.selection, roof: { ...value.selection.roof,
      blinds: [{ ...defaultBlind("front-1of2"), cover: "PELMET" }], sidePanels: [defaultSidePanel("left-1of1", "aluminium")],
      lighting: { ...DEFAULT_LIGHTING, rafterAmount: "low", rafterCount: 3 } } } });
  }
  const scene = createStudioSceneResolver().resolve(edit), task = studioPreparationTasks(scene).find(task => task.method === "facade")!, result = prepareStudioPlacement(task);
  expect(result.kind).toBe("ready"); if (result.kind !== "ready") throw Error(result.reason);
  const candidate = result.value.candidates.find(candidate => candidate.artifacts.demo)!;
  expect(candidate.physical.collisionFaces.length).toBeGreaterThan(0);
  if (accessories) expect(candidate.physical.collisionBounds.length).toBeGreaterThan(0);
  const sin = vi.spyOn(Math, "sin"), cos = vi.spyOn(Math, "cos");
  try {
    const original = evaluateDemoClearance(candidate.artifacts.demo!.clearance, candidate.physical, candidate.pose);
    expect({ sin: sin.mock.calls.length, cos: cos.mock.calls.length }).toEqual({ sin: 2, cos: 2 });
    sin.mockClear(); cos.mockClear();
    const duplicated = evaluateDemoClearance(candidate.artifacts.demo!.clearance, { ...candidate.physical, collisionFaces: [...candidate.physical.collisionFaces, ...candidate.physical.collisionFaces] }, candidate.pose);
    expect(duplicated).toEqual(original);
    expect({ sin: sin.mock.calls.length, cos: cos.mock.calls.length }).toEqual({ sin: 2, cos: 2 });
  } finally { sin.mockRestore(); cos.mockRestore(); }
});
