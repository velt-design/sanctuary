import { expect, it, vi } from "vitest";
import PreviewProductNode from "./PreviewProductNode";
const contexts = vi.hoisted(() => ({ select: vi.fn(), lighting: null as any }));
vi.mock("./LightingProvider", () => ({ useLighting: () => contexts.lighting }));
vi.mock("./PreviewBlindProvider", () => ({
  usePreviewBlinds: () => ({
    editing: true,
    select: contexts.select,
    openings: [],
    blinds: [],
    panels: [],
  }),
}));
vi.mock("./SceneRenderingUpgrade", () => ({
  useSceneRenderingUpgrade: () => false,
}));
vi.mock("./RealismStudy", () => ({ useRealismStudy: () => false }));
function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return !node || typeof node !== "object"
    ? []
    : [node, ...nodes(node.props?.children)];
}
const scene = {
  layers: [
    { visibleByDefault: true, objects: [{ id: "beam", type: "member_prism" }] },
  ],
} as any;
it("preserves public default selection suppression and permits only explicit product/opening callbacks", () => {
  const select = vi.fn();
  contexts.select.mockClear();
  contexts.lighting = null;
  const ordinary = nodes(PreviewProductNode({ scene, choiceView: "sides" }));
  ordinary.find((n) => n.props.object?.id === "beam").props.onSelect("beam");
  ordinary.find((n) => n.props.workspace).props.workspace.select("front-1");
  expect(contexts.select).not.toHaveBeenCalled();
  const opted = nodes(
    PreviewProductNode({
      scene,
      choiceView: "sides",
      onSelect: select,
      interactiveChoices: true,
    } as any),
  );
  opted.find((n) => n.props.object?.id === "beam").props.onSelect("beam");
  expect(select).toHaveBeenCalledOnce();
  opted.find((n) => n.props.workspace).props.workspace.select("front-1");
  expect(contexts.select).toHaveBeenCalledWith("front-1");
});
it("keeps blind opening selection suppressed while lighting owns the model even after opt-in", () => {
  contexts.select.mockClear();
  contexts.lighting = { editing: true, roof: {} };
  const rendered = nodes(
    PreviewProductNode({
      scene,
      choiceView: "lighting",
      interactiveChoices: true,
    } as any),
  );
  rendered.find((n) => n.props.workspace).props.workspace.select("front-1");
  expect(contexts.select).not.toHaveBeenCalled();
  expect(rendered.find((n) => n.props.workspace).props.workspace.editing).toBe(
    false,
  );
});
it("selects an opted-in inactive product from a blind/panel hit without invoking its read-only opening editor", () => {
  contexts.lighting = null;
  contexts.select.mockClear();
  const select = vi.fn();
  const inactive = nodes(
    PreviewProductNode({ scene, onSelect: select, interactiveChoices: false }),
  );
  inactive.find((n) => n.props.workspace).props.workspace.select("front-1");
  expect(select).toHaveBeenCalledOnce();
  expect(contexts.select).not.toHaveBeenCalled();
  const ordinary = nodes(PreviewProductNode({ scene }));
  ordinary.find((n) => n.props.workspace).props.workspace.select("front-1");
  expect(contexts.select).toHaveBeenCalledOnce();
});
