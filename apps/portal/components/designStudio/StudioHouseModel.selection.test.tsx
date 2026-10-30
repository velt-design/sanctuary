import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import { studioAttachmentFixture } from "../../../../test/studioAttachmentFixture";
import { createStudioSceneResolver } from "@/lib/designStudio/interaction/resolvedScene";
import StudioHouseModel from "./StudioHouseModel";

const host = vi.hoisted(() => ({ props: null as any }));
vi.mock("@sp/geometry-viewer/react/canvas", () => ({
  SceneCanvas: (props: any) => {
    host.props = props;
    return <div data-renderer-event-source />;
  },
}));
let mounted: ReturnType<typeof renderIntoDocument> | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
});
function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return !node || typeof node !== "object"
    ? []
    : [node, ...nodes(node.props?.children)];
}
function open() {
  const edit = studioAttachmentFixture(),
    onSelect = vi.fn();
  const props = {
    active: true,
    scene: createStudioSceneResolver().resolve(edit),
    selected: "p2",
    onSelect,
    readOnly: false,
    section: "Sides",
    refinedHouse: true,
    persistentViewport: true,
    zoomStep: 0,
    fit: 0,
    framingKey: edit.designId,
    focused: null,
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 15000, y: 15000, z: 4000 },
    ],
    onVisibility: vi.fn(),
    isNight: false,
  };
  mounted = renderIntoDocument(<StudioHouseModel {...props} />);
  const surface = mounted.container.querySelector<HTMLElement>(
    "[data-renderer-event-source]",
  )!;
  return { props, surface, onSelect };
}
function pointer(target: Element, type: string, x: number, y = 450) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  act(() => target.dispatchEvent(event));
}
function click(target: Element, x = 500, y = 450) {
  act(() =>
    target.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        detail: 1,
      }),
    ),
  );
}
/** The actual Model callback tree runs behind a substituted native renderer
 * event source. GPU/raycasting is excluded; DOM capture/bubble ordering is real.
 * Solid callbacks stop R3F bubbling and carry no event, so the gate must run
 * before dispatch, rather than merely guarding the outer product handler. */
it.each(["house", "product", "solid", "accessory-fall-through"] as const)(
  "keeps %s selection unchanged after an orbit, including out-and-back, then admits a fresh tiny-jitter click",
  (route) => {
    const { surface, onSelect } = open(),
      tree = nodes(host.props.children),
      context = tree.find((n) => n.type?.name === "StudioProductContext"),
      house = tree.find((n) => n.type?.name === "StudioHouseNode"),
      solid = tree.find((n) => n.type?.name === "PreviewProductNode"),
      product = context.props.children;
    const dispatch = (e: Event) =>
      route === "house"
        ? house.props.onSelect()
        : route === "solid"
          ? solid.props.onSelect()
          : product.props.onClick(e);
    surface.addEventListener("click", dispatch);
    pointer(surface, "pointerdown", 500);
    pointer(surface, "pointermove", 620, 414);
    pointer(surface, "pointerup", 620, 414);
    pointer(surface, "lostpointercapture", 620, 414);
    click(surface, 620, 414);
    expect(onSelect).not.toHaveBeenCalled();
    pointer(surface, "pointerdown", 500);
    pointer(surface, "pointermove", 620, 414);
    pointer(surface, "pointermove", 500);
    pointer(surface, "pointerup", 500);
    click(surface);
    expect(onSelect).not.toHaveBeenCalled();
    pointer(surface, "pointerdown", 500);
    pointer(surface, "pointermove", 502, 451);
    pointer(surface, "pointerup", 502, 451);
    pointer(surface, "lostpointercapture", 502, 451);
    click(surface, 502, 451);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(route === "house" ? "house" : "p2");
  },
);

it.each(["pointercancel", "lostpointercapture"])(
  "revokes a %s press through late up/click and resets at the next click",
  (type) => {
    const { surface, onSelect } = open();
    surface.addEventListener("click", () => onSelect("opening"));
    pointer(surface, "pointerdown", 500);
    pointer(surface, type, 500);
    pointer(surface, "pointerup", 500);
    click(surface);
    expect(onSelect).not.toHaveBeenCalled();
    pointer(surface, "pointerdown", 500);
    pointer(surface, "pointerup", 500);
    click(surface);
    expect(onSelect).toHaveBeenCalledWith("opening");
  },
);

it("samples a distinct final up, observes camera input without consuming it, and resets across hide/reveal/unmount", () => {
  const { surface, onSelect, props } = open(),
    cameraInput = vi.fn();
  for (const type of ["pointerdown", "pointermove", "pointerup", "wheel"])
    surface.addEventListener(type, (event) => {
      expect(event.defaultPrevented).toBe(false);
      cameraInput(type);
    });
  surface.addEventListener("click", () => onSelect("opening"));
  pointer(surface, "pointerdown", 500);
  pointer(surface, "pointerup", 620);
  click(surface, 620);
  expect(onSelect).not.toHaveBeenCalled();
  pointer(surface, "pointerdown", 500);
  pointer(surface, "pointermove", 502);
  act(() =>
    surface.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: -100,
      }),
    ),
  );
  pointer(surface, "pointerup", 502);
  click(surface, 502);
  expect(onSelect).not.toHaveBeenCalled();
  expect(cameraInput.mock.calls.map((c) => c[0])).toEqual([
    "pointerdown",
    "pointerup",
    "pointerdown",
    "pointermove",
    "wheel",
    "pointerup",
  ]);
  pointer(surface, "pointerdown", 500);
  pointer(surface, "pointermove", 620);
  mounted!.rerender(<StudioHouseModel {...props} active={false} />);
  click(surface);
  expect(onSelect).not.toHaveBeenCalled();
  mounted!.rerender(<StudioHouseModel {...props} />);
  pointer(surface, "pointerdown", 500);
  pointer(surface, "pointerup", 500);
  click(surface);
  expect(onSelect).toHaveBeenCalledOnce();
  mounted!.unmount();
  mounted = undefined;
  const next = open();
  next.surface.addEventListener("click", () => next.onSelect("opening"));
  pointer(next.surface, "pointerdown", 500);
  pointer(next.surface, "pointerup", 500);
  click(next.surface);
  expect(next.onSelect).toHaveBeenCalledOnce();
});

it("preserves read-only inspection clicks and keyboard activation without inheriting a pointer suppression", () => {
  const { surface, onSelect, props } = open();
  mounted!.rerender(
    <StudioHouseModel {...props} readOnly section="Lighting" />,
  );
  surface.addEventListener("click", () => onSelect("inspection"));
  pointer(surface, "pointerdown", 500);
  pointer(surface, "pointerup", 500);
  click(surface);
  expect(onSelect).toHaveBeenCalledOnce();
  pointer(surface, "pointerdown", 500);
  pointer(surface, "pointercancel", 500);
  act(() =>
    surface.dispatchEvent(
      new MouseEvent("click", { bubbles: true, detail: 0 }),
    ),
  );
  expect(onSelect).toHaveBeenCalledTimes(2);
});
