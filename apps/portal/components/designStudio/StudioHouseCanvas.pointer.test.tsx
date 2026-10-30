import { act, useState, useEffect } from "react";
import {
  LightingProvider,
  PreviewBlindProvider,
  useLighting,
  usePreviewBlinds,
} from "@sp/configurator/react/controls";
import { websiteComposition } from "@/lib/designStudio/websiteComposition";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from "@/lib/drawings/state/objectFirstWorkbenchModel";
import { addWebsitePergola } from "@/lib/designStudio/websiteComposition";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import StudioHouseCanvas, { type StudioDirectDrag } from "./StudioHouseCanvas";
import { studioJoinCanvasProjection } from "./studioJoinPresentation";
import { previewWebsiteJoin } from "@/lib/designStudio/websiteJoins";
import * as joins from "@/lib/designStudio/websiteJoins";
import { createStudioSceneResolver } from "@/lib/designStudio/interaction/resolvedScene";

// Keep the actual Plan, product contexts and pointer handlers. Only the unused
// WebGL host and unavailable browser CTM/capture primitives are substituted.
vi.mock("@sp/geometry-viewer/react/canvas", () => ({
  SceneCanvas: () => null,
}));
let mounted: ReturnType<typeof renderIntoDocument> | undefined;
let captured: Element[];
const originalCapture = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "setPointerCapture",
);
const originalWidth = Object.getOwnPropertyDescriptor(
    SVGSVGElement.prototype,
    "clientWidth",
  ),
  originalHeight = Object.getOwnPropertyDescriptor(
    SVGSVGElement.prototype,
    "clientHeight",
  );
beforeEach(() => {
  sessionStorage.clear();
  captured = [];
  Object.defineProperty(Element.prototype, "setPointerCapture", {
    configurable: true,
    value: function (this: Element) {
      captured.push(this);
    },
  });
  Object.defineProperty(SVGSVGElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 1000,
  });
  Object.defineProperty(SVGSVGElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 700,
  });
  vi.stubGlobal(
    "DOMPoint",
    class {
      constructor(
        public x: number,
        public y: number,
      ) {}
      matrixTransform(m: DOMMatrix) {
        return {
          x: m.a * this.x + m.c * this.y + m.e,
          y: m.b * this.x + m.d * this.y + m.f,
        };
      }
    },
  );
});
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  window.getSelection()?.removeAllRanges();
  vi.unstubAllGlobals();
  if (originalCapture)
    Object.defineProperty(
      Element.prototype,
      "setPointerCapture",
      originalCapture,
    );
  else Reflect.deleteProperty(Element.prototype, "setPointerCapture");
  if (originalWidth)
    Object.defineProperty(
      SVGSVGElement.prototype,
      "clientWidth",
      originalWidth,
    );
  else Reflect.deleteProperty(SVGSVGElement.prototype, "clientWidth");
  if (originalHeight)
    Object.defineProperty(
      SVGSVGElement.prototype,
      "clientHeight",
      originalHeight,
    );
  else Reflect.deleteProperty(SVGSVGElement.prototype, "clientHeight");
});
function design() {
  const empty: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "pointer-regression",
    revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  return addWebsitePergola(empty, "p");
}
it('renders the same committed scene, targets and ghost from the standalone adapter or supplied task projection',()=>{
 const edit=addWebsitePergola(design(),'other'),draft={id:'join',a:{objectId:'other',edge:'left' as const},b:{objectId:'p',edge:'right' as const},alignment:'centre' as const};
 const preview=previewWebsiteJoin(edit,draft).edit,resolved=createStudioSceneResolver().resolve(edit),projection=studioJoinCanvasProjection(edit,draft,preview);
 const render=(supplied:boolean)=><StudioHouseCanvas edit={edit} selected="other" onSelect={()=>{}} resolvedScene={resolved} view="Plan" persistentViewport preview={preview} {...(supplied?{joinProjection:projection}:{joinDraft:draft})}/>;
 mounted=renderIntoDocument(render(false));
 const svg=mounted.container.querySelector('svg')!,before=svg.innerHTML,frame=svg.getAttribute('viewBox'),calls=vi.spyOn(joins,'websiteJoinTargets');
 mounted.rerender(render(true));
 expect(calls).not.toHaveBeenCalled();expect(svg.innerHTML).toBe(before);expect(svg.getAttribute('viewBox')).toBe(frame);
 expect(svg.textContent).toContain('Proposed Pergola 2');expect(svg.querySelector('[aria-label="Join target Pergola 1 · right"]')).toBeTruthy();
 calls.mockRestore();
});
function handlers(ready = true) {
  const api = {
    pointerId: null as number | null,
    get phase(): StudioDirectDrag["phase"] {
      return api.pointerId === null ? "idle" : "dragging";
    },
    press: vi.fn((_id: string, p: { pointerId: number }) => {
      if (ready) api.pointerId = p.pointerId;
      return ready;
    }),
    move: vi.fn(),
    release: vi.fn(() => {
      api.pointerId = null;
    }),
    cancel: vi.fn(() => {
      api.pointerId = null;
    }),
  } satisfies StudioDirectDrag;
  return api;
}
function pointer(target: Element, type: string, x = 10, y = 20, button = 0) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button,
    buttons: type === "pointerup" ? 0 : 1,
  });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: "mouse" },
  });
  act(() => target.dispatchEvent(event));
  return event;
}
function open(drag: StudioDirectDrag, selected = "p") {
  mounted = renderIntoDocument(
    <>
      <input aria-label="Exact X" defaultValue="123.45" />
      <StudioHouseCanvas
        edit={design()}
        selected={selected}
        onSelect={() => {}}
        directDrag={drag}
        view="Plan"
        persistentViewport
      />
    </>,
  );
  (drag.cancel as ReturnType<typeof vi.fn>).mockClear();
  return mounted.container.querySelector<SVGSVGElement>(
    'svg[aria-label="Studio design Plan"]',
  )!;
}
it.each(["Sides", "Lighting"] as const)(
  "lets actual nested %s targets handle pointer/keyboard input without starting a product drag",
  (section) => {
    const drag = handlers(),
      edit = design(),
      row = websiteComposition(edit)[0],
      changed = vi.fn(),
      select = vi.fn();
    function Activate() {
      const light = useLighting(),
        sides = usePreviewBlinds();
      useEffect(() => {
        if (section === "Lighting") {
          light!.open();
          light!.setTool("strip");
        } else sides!.setEditing(true);
      }, []);
      return null;
    }
    mounted = renderIntoDocument(
      <LightingProvider
        input={row.design!.input}
        roof={row.design!.roof}
        onChange={changed}
      >
        <PreviewBlindProvider
          input={row.design!.input}
          roof={row.design!.roof}
          onChange={changed}
        >
          <Activate />
          <StudioHouseCanvas
            edit={edit}
            selected="p"
            onSelect={select}
            section={section}
            directDrag={drag}
            view="Plan"
            persistentViewport
          />
        </PreviewBlindProvider>
      </LightingProvider>,
    );
    const svg = mounted.container.querySelector(
        'svg[aria-label="Studio design Plan"]',
      )!,
      target = svg.querySelector(
        section === "Sides" ? "[data-blind-opening]" : "[data-light-member]",
      )!;
    expect(target).toBeTruthy();
    const grab = svg.querySelector("[data-selected-product-grab]")!;
    expect(
      grab.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    pointer(target.firstElementChild ?? target, "pointerdown");
    pointer(svg, "pointerup");
    expect(drag.press).not.toHaveBeenCalled();
    expect(captured).toEqual([]);
    act(() => target.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    if (section === "Sides")
      expect(target.getAttribute("aria-pressed")).toBe("true");
    else
      expect(changed.mock.calls[0][0].lighting.strips).toContain(
        target.getAttribute("data-light-member"),
      );
    act(() =>
      target.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(select).not.toHaveBeenCalled();
    expect(drag.press).not.toHaveBeenCalled();
    pointer(
      svg.querySelector('[aria-label="Select Pergola 1"] polygon')!,
      "pointerdown",
    );
    expect(drag.press).toHaveBeenCalledOnce();
  },
);
function selectRoofText(svg: SVGSVGElement) {
  const text = svg.querySelector("[data-roof-fall-label]")!;
  expect(text).toBeTruthy();
  const range = document.createRange();
  range.selectNodeContents(text);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
  expect(window.getSelection()!.toString()).toBe("Roof fall");
}

it("suppresses the native default with existing roof text selected and releases the exact grabbed delta", () => {
  const drag = handlers(),
    svg = open(drag);
  selectRoofText(svg);
  const down = pointer(
    svg.querySelector("[data-selected-product-grab]")!,
    "pointerdown",
  );
  expect(down.defaultPrevented).toBe(true);
  expect(captured).toEqual([svg]);
  expect(drag.press).toHaveBeenCalledExactlyOnceWith(
    "p",
    expect.objectContaining({
      screen: { x: 10, y: 20 },
      world: { x: 10, y: -20 },
    }),
  );
  // CTM is identity in this test; the actual Plan flips screen Y into world Y.
  pointer(svg, "pointermove", 50, 70);
  expect(drag.move).toHaveBeenLastCalledWith(
    expect.objectContaining({
      screen: { x: 50, y: 70 },
      world: { x: 50, y: -70 },
    }),
  );
  pointer(svg, "pointerup", 60, 80);
  expect(drag.release).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      screen: { x: 60, y: 80 },
      world: { x: 60, y: -80 },
    }),
  );
});

it("prevents native selection even when placement preparation denies the start", () => {
  const drag = handlers(false),
    svg = open(drag);
  selectRoofText(svg);
  expect(
    pointer(svg.querySelector("[data-selected-product-grab]")!, "pointerdown")
      .defaultPrevented,
  ).toBe(true);
  expect(captured).toEqual([]);
  expect(drag.press).toHaveBeenCalledOnce();
  pointer(svg, "pointermove", 80, 80);
  pointer(svg, "pointerup", 80, 80);
  expect(drag.release).not.toHaveBeenCalled();
});

it("keeps capture on the stable SVG when selecting an inactive product replaces its descendant", () => {
  const edit = design(),
    drag = handlers();
  function Harness() {
    const [selected, setSelected] = useState("");
    return (
      <StudioHouseCanvas
        edit={edit}
        selected={selected}
        onSelect={setSelected}
        directDrag={drag}
        view="Plan"
        persistentViewport
      />
    );
  }
  mounted = renderIntoDocument(<Harness />);
  drag.cancel.mockClear();
  const svg = mounted.container.querySelector<SVGSVGElement>(
      'svg[aria-label="Studio design Plan"]',
    )!,
    oldProduct = svg.querySelector('[aria-label="Select Pergola 1"]')!;
  pointer(oldProduct, "pointerdown");
  expect(oldProduct.isConnected).toBe(false);
  expect(captured).toEqual([svg]);
  expect(svg.isConnected).toBe(true);
  pointer(svg, "pointermove", 40, 50);
  pointer(svg, "pointerup", 40, 50);
  expect(drag.release).toHaveBeenCalledOnce();
  expect(
    mounted.container.querySelector('svg[aria-label="Studio design Plan"]'),
  ).toBe(svg);
});

it("cancels native dragstart only inside Plan and leaves external numeric selection and input events intact", () => {
  const svg = open(handlers());
  selectRoofText(svg);
  const nativeDrag = new Event("dragstart", {
    bubbles: true,
    cancelable: true,
  });
  act(() =>
    svg
      .querySelector("[data-selected-product-grab]")!
      .dispatchEvent(nativeDrag),
  );
  expect(nativeDrag.defaultPrevented).toBe(true);
  const input = mounted!.container.querySelector("input")!;
  expect(pointer(input, "pointerdown").defaultPrevented).toBe(false);
  input.select();
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  const outsideDrag = new Event("dragstart", {
    bubbles: true,
    cancelable: true,
  });
  input.dispatchEvent(outsideDrag);
  expect(outsideDrag.defaultPrevented).toBe(false);
});

it.each(["pointercancel", "escape", "lostpointercapture"] as const)(
  "retains cancellation without committing after %s",
  (kind) => {
    const drag = handlers(),
      svg = open(drag);
    pointer(svg.querySelector("[data-selected-product-grab]")!, "pointerdown");
    pointer(svg, "pointermove", 50, 70);
    if (kind === "escape")
      act(() =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
    else pointer(svg, kind, 50, 70);
    expect(drag.cancel).toHaveBeenCalledOnce();
    pointer(svg, "pointerup", 50, 70);
    expect(drag.release).not.toHaveBeenCalled();
  },
);

it("forwards subthreshold screen coordinates for the real controller to classify", () => {
  const drag = handlers(),
    svg = open(drag);
  pointer(svg.querySelector("[data-selected-product-grab]")!, "pointerdown");
  pointer(svg, "pointermove", 12, 20);
  pointer(svg, "pointerup", 12, 20);
  expect(drag.move).toHaveBeenCalledWith(
    expect.objectContaining({ screen: { x: 12, y: 20 } }),
  );
  expect(drag.release).toHaveBeenCalledOnce();
});

it("holds the press mapping through a layout CTM change and samples a distinct final pointer coordinate", () => {
  const drag = handlers(),
    svg = open(drag);
  let inverse = { a: 10, b: 0, c: 0, d: 10, e: 3, f: 7 };
  Object.defineProperty(svg, "getScreenCTM", {
    configurable: true,
    value: () => ({ inverse: () => inverse }),
  });
  pointer(
    svg.querySelector("[data-selected-product-grab]")!,
    "pointerdown",
    10,
    20,
  );
  inverse = { a: 10.1, b: 0, c: 0, d: 10.1, e: 9, f: 17 };
  pointer(svg, "pointermove", 50, 70);
  expect(drag.move).toHaveBeenLastCalledWith(
    expect.objectContaining({
      world: { x: 503, y: -707 },
      screen: { x: 50, y: 70 },
    }),
  );
  pointer(svg, "pointerup", 60, 80);
  expect(drag.release).toHaveBeenLastCalledWith(
    expect.objectContaining({
      world: { x: 603, y: -807 },
      screen: { x: 60, y: 80 },
    }),
  );
  pointer(
    svg.querySelector("[data-selected-product-grab]")!,
    "pointerdown",
    10,
    20,
  );
  expect(drag.press).toHaveBeenLastCalledWith(
    "p",
    expect.objectContaining({ world: { x: 110, y: -219 } }),
  );
});

it("cancels a held placement when the actual manual Plan camera changes", () => {
  const drag = handlers(),
    svg = open(drag);
  pointer(svg.querySelector("[data-selected-product-grab]")!, "pointerdown");
  pointer(svg, "pointermove", 50, 70);
  const zoom = mounted!.container.querySelector<HTMLButtonElement>(
    'button[aria-label="Zoom in"]',
  )!;
  act(() => zoom.click());
  expect(drag.cancel).toHaveBeenCalledOnce();
  pointer(svg, "pointerup", 60, 80);
  expect(drag.release).not.toHaveBeenCalled();
});

it.each(['held','released-waiting'] as const)('cancels %s authority on a real drawable resize and reverses the manual Plan frame',kind=>{
 const callbacks=new Set<ResizeObserverCallback>();vi.stubGlobal('ResizeObserver',class{constructor(callback:ResizeObserverCallback){callbacks.add(callback);}observe(){}disconnect(){}unobserve(){}});
 let width=1000,waiting=false;Object.defineProperty(SVGSVGElement.prototype,'clientWidth',{configurable:true,get:()=>width});
 const drag=handlers();Object.defineProperty(drag,'phase',{get:()=>waiting?'waiting':drag.pointerId===null?'idle':'dragging'});
 drag.cancel.mockImplementation(()=>{waiting=false;drag.pointerId=null;});
 if(kind==='released-waiting')drag.release.mockImplementation(()=>{drag.pointerId=null;waiting=true;});
 const svg=open(drag),frame=svg.getAttribute('viewBox');pointer(svg.querySelector('[data-selected-product-grab]')!,'pointerdown');pointer(svg,'pointermove',50,70);
 if(kind==='released-waiting')pointer(svg,'pointerup',60,80);drag.cancel.mockClear();
 width=448;act(()=>callbacks.forEach(callback=>callback([],{} as ResizeObserver)));
 expect(drag.cancel).toHaveBeenCalledOnce();pointer(svg,'pointerup',90,100);expect(drag.release).toHaveBeenCalledTimes(kind==='released-waiting'?1:0);
 width=1000;act(()=>callbacks.forEach(callback=>callback([],{} as ResizeObserver)));expect(svg.getAttribute('viewBox')).toBe(frame);
});

function touch(target:EventTarget,type:string,id:number,x:number,y:number){
 const event=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1});Object.defineProperties(event,{pointerId:{value:id},pointerType:{value:'touch'},isPrimary:{value:id===1}});act(()=>target.dispatchEvent(event));
}
it('hands a one-finger object drag to two-finger Plan pan/pinch without a model commit, then admits the next grab',()=>{
 const drag=handlers(),svg=open(drag),body=svg.querySelector('[data-selected-product-grab]')!,before=svg.getAttribute('viewBox')!.split(' ').map(Number);
 touch(body,'pointerdown',1,100,100);touch(svg,'pointermove',1,110,100);expect(drag.press).toHaveBeenCalledOnce();
 touch(svg,'pointerdown',2,210,100);expect(drag.cancel).toHaveBeenCalledOnce();
 touch(svg,'pointermove',1,60,120);touch(svg,'pointermove',2,260,120);const zoomed=svg.getAttribute('viewBox')!.split(' ').map(Number);
 expect(zoomed[2]).toBeLessThan(before[2]);expect(zoomed[0]+zoomed[2]/2).not.toBe(before[0]+before[2]/2);
 touch(svg,'pointerup',2,260,120);touch(svg,'pointerup',1,60,120);expect(drag.release).not.toHaveBeenCalled();
 const click=vi.fn();svg.addEventListener('click',click);act(()=>body.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})));expect(click).not.toHaveBeenCalled();
 touch(body,'pointerdown',1,100,100);touch(svg,'pointermove',1,130,120);touch(svg,'pointerup',1,140,125);expect(drag.press).toHaveBeenCalledTimes(2);expect(drag.release).toHaveBeenCalledOnce();
});

it.each(['pointercancel','lostpointercapture','escape','resize','mode'] as const)('retires a two-finger Plan camera after %s without committing and rearms fresh input',kind=>{
 const callbacks=new Set<ResizeObserverCallback>();vi.stubGlobal('ResizeObserver',class{constructor(callback:ResizeObserverCallback){callbacks.add(callback);}observe(){}disconnect(){}unobserve(){}});
 let width=1000;Object.defineProperty(SVGSVGElement.prototype,'clientWidth',{configurable:true,get:()=>width});
 const drag=handlers(),svg=open(drag),before=svg.getAttribute('viewBox');const body=svg.querySelector('[data-selected-product-grab]')!;
 touch(body,'pointerdown',1,100,100);touch(svg,'pointerdown',2,200,100);touch(svg,'pointermove',2,250,140);
 if(kind==='escape')act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
 else if(kind==='resize'){width=448;act(()=>callbacks.forEach(callback=>callback([],{} as ResizeObserver)));}
 else if(kind==='mode')mounted!.rerender(<><input aria-label="Exact X" defaultValue="123.45"/><StudioHouseCanvas edit={design()} selected="p" onSelect={()=>{}} directDrag={drag} view="Split" persistentViewport/></>);
 else touch(svg,kind,2,250,140);
 touch(svg,'pointerup',2,250,140);touch(svg,'pointerup',1,100,100);expect(drag.release).not.toHaveBeenCalled();
 const current=mounted!.container.querySelector<SVGSVGElement>('svg[aria-label="Studio design Plan"]')!;touch(current.querySelector('[data-selected-product-grab]')!,'pointerdown',3,100,100);touch(current,'pointermove',3,130,120);touch(current,'pointerup',3,140,125);expect(drag.release).toHaveBeenCalledOnce();
 if(kind!=='resize'&&kind!=='mode')expect(current.getAttribute('viewBox')).toBe(before);
});

it.each(['pointerup','pointercancel','lostpointercapture','escape','resize','mode','zoom','fit'] as const)('keeps physical contacts camera-only after %s until outside release, then permits a fresh grab',kind=>{
 const callbacks=new Set<ResizeObserverCallback>();vi.stubGlobal('ResizeObserver',class{constructor(callback:ResizeObserverCallback){callbacks.add(callback);}observe(){}disconnect(){}unobserve(){}});
 let width=1000;Object.defineProperty(SVGSVGElement.prototype,'clientWidth',{configurable:true,get:()=>width});
 const drag=handlers(),svg=open(drag);touch(svg.querySelector('[data-selected-product-grab]')!,'pointerdown',1,100,100);touch(svg,'pointerdown',2,200,100);touch(svg,'pointermove',2,250,140);
 if(kind==='escape')act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
 else if(kind==='resize'){width=448;act(()=>callbacks.forEach(callback=>callback([],{} as ResizeObserver)));}
 else if(kind==='mode')mounted!.rerender(<><input aria-label="Exact X" defaultValue="123.45"/><StudioHouseCanvas edit={design()} selected="p" onSelect={()=>{}} directDrag={drag} view="Split" persistentViewport/></>);
 else if(kind==='zoom'||kind==='fit')act(()=>mounted!.container.querySelector<HTMLButtonElement>(kind==='zoom'?'button[aria-label="Zoom in"]':'button[aria-label="Fit design"]')!.click());
 else touch(svg,kind,2,250,140);
 const current=mounted!.container.querySelector<SVGSVGElement>('svg[aria-label="Studio design Plan"]')!;
 touch(current.querySelector('[data-selected-product-grab]')!,'pointerdown',3,180,160);touch(current,'pointermove',3,230,190);touch(current,'pointerup',3,240,195);
 expect(drag.press).toHaveBeenCalledOnce();expect(drag.release).not.toHaveBeenCalled();
 touch(window,'pointerup',1,100,100);touch(window,'pointercancel',2,250,140);
 touch(current.querySelector('[data-selected-product-grab]')!,'pointerdown',4,100,100);touch(current,'pointermove',4,130,120);touch(current,'pointerup',4,140,125);
 expect(drag.press).toHaveBeenCalledTimes(2);expect(drag.release).toHaveBeenCalledOnce();
});
