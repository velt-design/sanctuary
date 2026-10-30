import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import {
  useStudioEditingSession,
  type StudioEditingSessionProps,
} from "./useStudioEditingSession";
import StudioWebsiteEditor from "./StudioWebsiteEditor";
import {StudioDocumentContext} from "./StudioDocumentContext";
import * as sessionOwner from "./useStudioEditingSession";
import * as attachmentEvaluation from "@/lib/designStudio/studioAttachmentResolver";
import * as clearanceEvaluation from "@/lib/designStudio/demoContactClearance";
import {
  parseStudioWebsiteDesign,
  type StudioWebsiteDesign,
} from "@/lib/designStudio/websiteDesign";
import * as geometryOwner from "@sp/configurator/geometry";
import { defaultSidePanel } from "@sp/configurator/website";
import * as websiteDesignOwner from "@/lib/designStudio/websiteDesign";
import * as registryOwner from "@/lib/drawings/state/projectHouseGeometryRegistry";
import * as compositionOwner from "@/lib/designStudio/websiteComposition";
import * as joinOwner from "@/lib/designStudio/websiteJoins";
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from "@/lib/drawings/state/objectFirstWorkbenchModel";
import { applyStudioHouseEdit } from "@/lib/designStudio/houseEditing";
import { studioHouseScene } from "@/lib/designStudio/studioHouseScene";
import {
  addWebsitePergola,
  positionWebsitePergola,
  websiteComposition,
} from "@/lib/designStudio/websiteComposition";
import {
  previewStudioAttachment,
  updateStudioHouse,
  changeStudioProduct,
} from "@/lib/designStudio/studioHouseCommands";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import { invalidateStudioLifecycle } from "@/lib/designStudio/studioLifecycle";
import { studioHouseContextKey } from "./studioHouseContext";
import { studioViewContextKey } from "./studioViewContext";
import { studioPreparationReply } from "../../../../test/studioPlacementTestWorker";
import {studioOpeningPrice,studioWebsitePricePayload,type StudioOpeningPrice} from '@/lib/designStudio/studioOpening';

const webgl = vi.hoisted(() => ({ children: null as any, saved: null as any, renders: 0, lighting: null as any, blinds: null as any }));
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  keys: vi.fn(),
  update: vi.fn(),
  owner: vi.fn(),
  api: vi.fn(),
}));
vi.mock('next/link',()=>({default:({prefetch,...props}:React.ComponentProps<'a'>&{prefetch?:boolean})=><a data-prefetch={String(prefetch)} {...props}/>}));
vi.mock("idb-keyval", () => ({
  get: mocks.get,
  keys: mocks.keys,
  update: mocks.update,
}));
vi.mock("@/lib/localFirst/store", () => ({
  getLocalFirstStoreOwner: mocks.owner,
}));
vi.mock("@/lib/repo/apiClient", async (load) => ({
  ...(await load<typeof import("@/lib/repo/apiClient")>()),
  apiJson: mocks.api,
}));
vi.mock("@sp/geometry-viewer/react/canvas", async () => {
  const {useLighting,usePreviewBlinds}=await import("@sp/configurator/react/controls");
  return {
  SceneCanvas: ({ children }: any) => {
    // The real active host bridges both contexts. Subscribe here too, so a
    // Model prop bailout cannot hide fresh provider values in this regression.
    webgl.lighting=useLighting();webgl.blinds=usePreviewBlinds();webgl.renders++;
    webgl.children = children;
    return null;
  },
};});
vi.mock("next/dynamic", async () => {
  const scene = await import("./StudioHouseCanvas");
  return {
    default: (loader: () => unknown) =>
      loader.toString().includes("StudioHouseCanvas")
        ? scene.default
        : (props: any) => {
            webgl.saved = props;
            return <div data-saved-preview />;
          },
  };
});

const scope = {
  actorId: "10000000-0000-4000-8000-000000000001",
  projectId: "proj_20000000-0000-4000-8000-000000000001",
  estimateId: "est_30000000-0000-4000-8000-000000000001",
  designId: "connected-placement",
};
const db = new Map<string, unknown>();
let queue: Promise<unknown>, heldStorage: Promise<void> | null;
let latest: ReturnType<typeof useStudioEditingSession>,
  mounted: ReturnType<typeof renderIntoDocument> | undefined;
const workers: TestWorker[] = [];
class TestWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  request: any;
  terminated = false;
  constructor() {
    workers.push(this);
  }
  postMessage(value: unknown) {
    this.request = structuredClone(value);
  }
  terminate() {
    this.terminated = true;
  }
  reply() {
    this.onmessage?.({
      data: structuredClone(
        studioPreparationReply(structuredClone(this.request)),
      ),
    } as MessageEvent);
  }
}
function fixture(method: "facade" | "soffit" = "facade"): StudioAuthoringEdit {
  let edit: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: scope.designId,
    revision: 3,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  const added = applyStudioHouseEdit(edit.spatial, {
    kind: "add",
    id: "house",
    label: "House",
  });
  if (!added.ok) throw Error(added.message);
  edit.spatial = added.spatial;
  const house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
  edit = updateStudioHouse(edit, {
    ...house,
    widthMm: "8000",
    depthMm: "4000",
    wallHeightMm: "3200",
    eaveHeightMm: "3200",
    roof: { ...house.roof, fasciaHeightMm: "350" },
  });
  edit = previewStudioAttachment(addWebsitePergola(edit, "p1"), {
    objectId: "p1",
    houseId: "house",
    edge: "rear",
    kind: method === "facade" ? "wall" : "eave",
    method,
  });
  return positionWebsitePergola(addWebsitePergola(edit, "p2"), "p2", {
    originXMm: "15000",
    originYMm: "1000",
  });
}
function Harness(props: StudioEditingSessionProps & { versionLabel?: string;openingPrice?:StudioOpeningPrice }) {
  return (
    <StudioWebsiteEditor {...props} versionLabel={props.versionLabel ?? "V1"} />
  );
}
const flush = () => act(async () => {});
async function open(
  selected = "p2",
  method: "facade" | "soffit" = "facade",
  initial?: StudioAuthoringEdit,
) {
  const edit = initial ?? fixture(method);
  sessionStorage.setItem(
    studioHouseContextKey(scope),
    JSON.stringify({
      selected,
      mode: "position",
      section: "Shape",
      view: "Plan",
    }),
  );
  mounted = renderIntoDocument(
    <Harness
      scope={scope}
      editable
      updatedAt="2026-10-21T00:00:00Z"
      view={{
        ...edit,
        schemaVersion: "studio_authoring_view.v1",
        pricing: "unpriced",
      }}
    />,
  );
  await flush();
  expect(latest.canEdit).toBe(true);
  return mounted.container.querySelector<SVGSVGElement>(
    'svg[aria-label="Studio design Plan"]',
  )!;
}
function pointer(target: Element, type: string, x = 10, y = 20) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
  });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: "mouse" },
  });
  act(() => target.dispatchEvent(event));
}
function grab(svg: SVGSVGElement) {
  return svg.querySelector('[data-selected-product-grab="p2"]')!;
}
function button(text: string) {
  return [...mounted!.container.querySelectorAll("button")].find(
    (b) => b.textContent === text,
  )!;
}
const pose = () =>
  websiteComposition(latest.edit!).find((p) => p.object.id === "p2")!.position!;

beforeEach(() => {
  const actualSession = sessionOwner.useStudioEditingSession;
  vi.spyOn(sessionOwner, "useStudioEditingSession").mockImplementation(
    (props) => {
      latest = actualSession(props);
      return latest;
    },
  );
  invalidateStudioLifecycle();
  sessionStorage.clear();
  db.clear();
  workers.length = 0;
  queue = Promise.resolve();
  heldStorage = null;
  vi.clearAllMocks();
  mocks.owner.mockReturnValue(scope.actorId);
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: vi.fn(async (name, _options, callback) => callback({ name })),
    },
  });
  mocks.get.mockImplementation(async (key) => structuredClone(db.get(key)));
  mocks.keys.mockImplementation(async () => [...db.keys()]);
  mocks.update.mockImplementation(
    (key: string, update: (old: unknown) => unknown) => {
      const gate = heldStorage;
      const result = queue.then(async () => {
        if (gate) await gate;
        db.set(key, structuredClone(update(structuredClone(db.get(key)))));
      });
      queue = result.catch(() => undefined);
      return result;
    },
  );
  vi.stubGlobal("Worker", TestWorker);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          status: "priced",
          amount: 10000,
          requestKey: body.requestKey,
        }),
      };
    }),
  );
  vi.stubGlobal(
    "DOMPoint",
    class {
      constructor(
        public x: number,
        public y: number,
      ) {}
      matrixTransform() {
        return { x: this.x, y: this.y };
      }
    },
  );
  Object.defineProperty(Element.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(SVGSVGElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 1000,
  });
  Object.defineProperty(SVGSVGElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 700,
  });
});
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([2, 3])(
  "keeps the real Editor's %s-product pose/durability/Undo path free of obsolete composition, join and solver work",
  async (count) => {
    let initial = fixture();
    if (count === 3)
      initial = positionWebsitePergola(addWebsitePergola(initial, "p3"), "p3", {
        originXMm: "23000",
        originYMm: "1000",
      });
    const svg = await open("p2", "facade", initial),
      original = structuredClone(latest.edit!);
    const solve = vi.spyOn(geometryOwner, "solvePergolaPreview"),
      registry = vi.spyOn(registryOwner, "buildProjectHouseGeometryRegistry"),
      composition = vi.spyOn(compositionOwner, "websiteComposition"),
      joins = vi.spyOn(joinOwner, "websiteJoinStates");
    const counts = () => ({
      solve: solve.mock.calls.length,
      registry: registry.mock.calls.length,
      composition: composition.mock.calls.length,
      joins: joins.mock.calls.length,
    });
    const clear = () => {
      solve.mockClear();
      registry.mockClear();
      composition.mockClear();
      joins.mockClear();
    };
    let release!: () => void;
    heldStorage = new Promise((resolve) => {
      release = resolve;
    });
    pointer(grab(svg), "pointerdown");
    pointer(svg, "pointermove", 50, 70);
    expect(counts()).toEqual({
      solve: 0,
      registry: 0,
      composition: 0,
      joins: 0,
    });
    pointer(svg, "pointerup", 60, 80);
    const released = counts();
    expect(latest.session!.generation).toBe(1);
    expect(svg.querySelector("[data-direct-footprint]")).toBeNull();
    clear();
    await act(async () => {
      heldStorage = null;
      release();
      await queue;
    });
    const durable = counts();
    clear();
    act(() => button("Undo").click());
    const undone = counts();
    expect(latest.edit!.spatial).toEqual(original.spatial);
    expect(latest.edit!.objectOptions).toEqual(original.objectOptions);
    await act(async () => {
      await queue;
    });
    expect(released).toEqual({
      solve: 0,
      registry: 1,
      composition: 0,
      joins: 0,
    });
    expect(durable).toEqual({
      solve: 0,
      registry: 0,
      composition: 0,
      joins: 0,
    });
    expect(undone).toEqual({ solve: 0, registry: 0, composition: 0, joins: 0 });
  },
);
function parentProps(
  edit = fixture(),
  editable = true,
): StudioEditingSessionProps {
  return {
    scope,
    editable,
    updatedAt: "2026-10-21T00:00:00Z",
    view: {
      ...edit,
      schemaVersion: "studio_authoring_view.v1",
      pricing: "unpriced",
    },
  };
}
it.each([false,true])('admits a clean opening price but excludes same-key retained raw house input (raw=%s)',async raw=>{
  const edit=fixture(),payload=studioWebsitePricePayload({designId:edit.designId,revision:edit.revision,composition:edit,design:null});
  const cancel=vi.fn(),opening=studioOpeningPrice({...scope,role:'staff',revision:edit.revision,requestKey:payload.requestKey},Promise.resolve({ok:true,price:{status:'priced',amount:54321,requestKey:payload.requestKey}}),cancel);
  sessionStorage.setItem(studioHouseContextKey(scope),JSON.stringify({selected:'house',mode:'position',section:'Shape',view:'Plan'}));
  if(raw){const house=studioHouseScene(edit.site,edit.spatial)!.houses[0];sessionStorage.setItem(`${scope.actorId}:${scope.projectId}:${scope.estimateId}:${edit.designId}:${edit.revision}:studio-house-pending`,JSON.stringify({schemaVersion:'studio_house_pending.v1',draft:{...house,widthMm:'-'},basis:house.source}));}
  mounted=renderIntoDocument(<Harness {...parentProps(edit)} openingPrice={opening}/>);await flush();await flush();
  expect(latest.edit).toEqual(edit);expect(latest.session?.dirty).toBe(false);
  if(raw){expect(cancel).toHaveBeenCalled();expect(mounted.container.textContent).not.toContain('54,321');expect(mounted.container.querySelector<HTMLInputElement>('[aria-label="Width (mm)"]')?.value).toBe('-');}
  else{
   expect(cancel).not.toHaveBeenCalled();expect(mounted.container.textContent).toContain('54,321');expect(fetch).not.toHaveBeenCalled();
   await queue;expect(db.size).toBeGreaterThan(0);mounted.unmount();await flush();
   const repeatCancel=vi.fn(),repeat=studioOpeningPrice({...scope,role:'staff',revision:edit.revision,requestKey:payload.requestKey},Promise.resolve({ok:true,price:{status:'priced',amount:54322,requestKey:payload.requestKey}}),repeatCancel);
   mounted=renderIntoDocument(<Harness {...parentProps(edit)} openingPrice={repeat}/>);await flush();await flush();
   expect(latest.edit).toEqual(edit);expect(latest.session?.dirty).toBe(false);expect(repeatCancel).not.toHaveBeenCalled();expect(mounted.container.textContent).toContain('54,322');expect(fetch).not.toHaveBeenCalled();
  }
});
it.each([false,true])('waits through the real first durable write while the opening price is held (raw=%s)',async raw=>{
  const edit=fixture(),payload=studioWebsitePricePayload({designId:edit.designId,revision:edit.revision,composition:edit,design:null}),cancel=vi.fn();
  let complete!:(value:any)=>void,release!:()=>void;
  const opening=studioOpeningPrice({...scope,role:'staff',revision:edit.revision,requestKey:payload.requestKey},new Promise(resolve=>{complete=resolve;}),cancel);
  sessionStorage.setItem(studioHouseContextKey(scope),JSON.stringify({selected:'p2',mode:'position',section:'Shape',view:'Plan'}));
  if(raw){const house=studioHouseScene(edit.site,edit.spatial)!.houses[0];sessionStorage.setItem(`${scope.actorId}:${scope.projectId}:${scope.estimateId}:${edit.designId}:${edit.revision}:studio-house-pending`,JSON.stringify({schemaVersion:'studio_house_pending.v1',draft:{...house,widthMm:'-'},basis:house.source}));}
  heldStorage=new Promise(resolve=>{release=resolve;});mounted=renderIntoDocument(<Harness {...parentProps(edit)} openingPrice={opening}/>);await flush();await flush();
  expect(latest.edit).toEqual(edit);expect(latest.status).toBe('loading');expect(latest.localDurable).toBe(false);expect(latest.canEdit).toBe(false);
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));});expect(fetch).not.toHaveBeenCalled();expect(cancel).not.toHaveBeenCalled();
  await act(async()=>{heldStorage=null;release();await queue;});await flush();expect(latest.status).toBe('ready');expect(latest.localDurable).toBe(true);expect(latest.canEdit).toBe(true);
  if(raw){expect(cancel).toHaveBeenCalled();await act(async()=>complete({ok:true,price:{status:'priced',amount:54321,requestKey:payload.requestKey}}));expect(mounted.container.textContent).not.toContain('54,321');}
  else{
    expect(cancel).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
    await act(async()=>complete({ok:true,price:{status:'priced',amount:54321,requestKey:payload.requestKey}}));expect(mounted.container.textContent).toContain('54,321');expect(fetch).not.toHaveBeenCalled();expect(latest.edit).toEqual(edit);
  }
});
it("waits for the real hydrated session without building a temporary saved scene", async () => {
  const waiting: Array<(value: unknown) => void> = [];
  mocks.get.mockImplementation(
    () => new Promise((resolve) => waiting.push(resolve)),
  );
  sessionStorage.setItem(`${studioViewContextKey(scope)}:selected`, "p2");
  sessionStorage.setItem(
    studioHouseContextKey(scope),
    JSON.stringify({
      selected: "p2",
      mode: "position",
      section: "Shape",
      view: "Plan",
    }),
  );
  const first = parentProps();
  const composition = vi.spyOn(compositionOwner, "websiteComposition");
  const solve = vi.spyOn(geometryOwner, "solvePergolaPreview");
  const registry = vi.spyOn(registryOwner, "buildProjectHouseGeometryRegistry");
  webgl.saved = null;
  mounted = renderIntoDocument(<Harness {...first} />);
  await flush();
  expect(latest.edit).toBeNull();
  expect(mounted.container.textContent).toContain("Opening your saved choices");
  expect(composition).not.toHaveBeenCalled();
  expect(solve).not.toHaveBeenCalled();
  expect(registry).not.toHaveBeenCalled();
  expect(webgl.saved).toBeNull();
  expect(mounted.container.querySelector('[data-saved-preview]')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  expect(button("Save design").disabled).toBe(true);
  expect(
    mounted.container.querySelector('a[href$="/studio-placeholder"]'),
  ).toBeNull();
  expect(
    mounted.container.querySelector(
      `a[href="/staff/design-studio/${scope.projectId}/${scope.estimateId}"]`,
    ),
  ).toBeTruthy();
  const next = structuredClone(first);
  next.view.revision = 4;
  (
    next.view.objectOptions.find((row) => row.objectId === "p2")!.values
      .websiteDesign as any
  ).rawDimensions.widthMm = "7100";
  mounted.rerender(<Harness {...next} />);
  await flush();
  expect(webgl.saved).toBeNull();
  expect(composition).not.toHaveBeenCalled();
  expect(solve).not.toHaveBeenCalled();
  expect(latest.edit).toBeNull();
  mocks.get.mockImplementation(async () => undefined);
  await act(async () => {
    for (const resolve of waiting.splice(0)) resolve(undefined);
  });
  await flush();
  expect(latest.edit!.revision).toBe(4);
  expect(latest.canEdit).toBe(true);
  expect(
    mounted.container.querySelector('svg[aria-label="Studio design Plan"]'),
  ).toBeTruthy();
  expect(mounted.container.textContent).not.toContain(
    "Opening your saved choices",
  );
  expect(latest.edit!.objectOptions).toEqual(next.view.objectOptions);
  expect(websiteComposition(latest.edit!).find(row => row.object.id === "p2")!.value!.rawDimensions.widthMm).toBe("7100");
});
it("keeps a locked saved version current and read-only without opening a second session", async () => {
  const props = parentProps(fixture(), false);
  mounted = renderIntoDocument(<Harness {...props} />);
  await flush();
  expect(latest.edit).toBeNull();
  expect(latest.status).toBe("locked");
  expect(latest.canEdit).toBe(false);
  expect(mounted.container.textContent).toContain(
    "This saved version is locked",
  );
  expect(button("Save design").disabled).toBe(true);
  expect(mounted.container.querySelector("fieldset")?.disabled).toBe(true);
  expect(webgl.saved.design.input.widthMm).toBe(6000);
  const next = structuredClone(props);
  (
    next.view.objectOptions.find((row) => row.objectId === "p1")!.values
      .websiteDesign as any
  ).rawDimensions.widthMm = "7250";
  mounted.rerender(<Harness {...next} />);
  await flush();
  expect(latest.edit).toBeNull();
  expect(webgl.saved.design.input.widthMm).toBe(7250);
  expect(mocks.api).not.toHaveBeenCalled();
});
it("retains an unavailable local-storage recovery and useful current saved view without an alternate authoring path", async () => {
  mocks.get.mockRejectedValue(Error("storage unavailable"));
  const props = parentProps();
  mounted = renderIntoDocument(<Harness {...props} />);
  await flush();
  expect(latest.edit).toBeNull();
  expect(latest.status).toBe("unavailable");
  expect(latest.message).toBeTruthy();
  expect(mounted.container.textContent).toContain(latest.message!);
  expect(mounted.container.querySelector("[data-saved-preview]")).toBeTruthy();
  expect(button("Save design").disabled).toBe(true);
  expect(mocks.api).not.toHaveBeenCalled();
});
it("retains a complex saved house during loading, then reports its unavailable preview and exposes valid peers through current Workspace", async () => {
  const initial = fixture(),
    form = initial.spatial.houseAssembly!.houseForms[0];
  const primitive = form.composition.primitives[0];
  if (primitive.kind !== "axisAlignedRectangle")
    throw Error("Expected rectangle fixture");
  form.composition.primitives.push({
    ...primitive,
    originXMm: primitive.originXMm + 8000,
  });
  const original = structuredClone(initial),
    waiting: Array<(value: unknown) => void> = [];
  mocks.get.mockImplementation(
    () => new Promise((resolve) => waiting.push(resolve)),
  );
  sessionStorage.setItem(
    studioHouseContextKey(scope),
    JSON.stringify({
      selected: "p2",
      mode: "position",
      section: "Shape",
      view: "Plan",
    }),
  );
  const props = parentProps(initial);
  mounted = renderIntoDocument(<Harness {...props} />);
  await flush();
  expect(latest.edit).toBeNull();
  expect(mounted.container.textContent).toContain("Opening your saved choices");
  expect(props.view.spatial).toEqual(original.spatial);
  expect(button("Save design").disabled).toBe(true);
  mocks.get.mockImplementation(async () => undefined);
  await act(async () => {
    for (const resolve of waiting.splice(0)) resolve(undefined);
  });
  await flush();
  expect(latest.edit!.spatial).toEqual(original.spatial);
  act(() => button("House").click());
  expect(mounted.container.textContent).toContain("cannot be edited as a simple rectangle");
  expect(button("Pergola 2")).toBeTruthy();
  act(() => button("Pergola 2").click());
  expect(
    mounted.container.querySelector('[aria-label="Select Pergola 2"]'),
  ).toBeTruthy();
  expect(latest.edit!.spatial).toEqual(original.spatial);
});

it("keeps the original session input boundary when presentation metadata changes", async () => {
  const svg = await open();
  pointer(grab(svg), "pointerdown");
  pointer(svg, "pointermove", 50, 70);
  pointer(svg, "pointerup", 60, 80);
  await act(async () => {
    await queue;
  });
  const epoch = latest.epoch,
    original = structuredClone(latest.edit!);
  mounted!.rerender(<Harness {...parentProps()} versionLabel="V2" />);
  await flush();
  expect(latest.epoch).toBe(epoch);
  expect(latest.session!.generation).toBe(1);
  expect(latest.edit).toEqual(original);
  expect(mounted!.container.textContent).toContain("V2");
});

function mixed(count: 2 | 3) {
  let edit = fixture("soffit");
  const house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
  edit = updateStudioHouse(edit, {
    ...house,
    widthMm: "8000",
    depthMm: "6500",
    wallHeightMm: "3200",
    eaveHeightMm: "3200",
    roof: {
      ...house.roof,
      form: "flat",
      pitchDeg: "0",
      fasciaHeightMm: "350",
      overhangMm: "450",
    },
    position: { xMm: "0", yMm: "-4000", rotationDeg: "0" },
  });
  const set = (
    id: string,
    roof: Partial<StudioWebsiteDesign["selection"]["roof"]>,
  ) => {
    const parsed = parseStudioWebsiteDesign(
      edit.objectOptions.find((row) => row.objectId === id)!.values
        .websiteDesign,
      id,
    );
    if (!parsed.ok) throw Error(parsed.message);
    edit = changeStudioProduct(edit, {
      ...parsed.value,
      selection: {
        ...parsed.value.selection,
        roof: { ...parsed.value.selection.roof, ...roof },
      },
    });
  };
  const finish = {
    material: "combination",
    layout: "central",
    acrylicBays: 2,
    profile: "corrugated",
    trayWidth: 400,
    ceiling: "cedar-100",
  } as const;
  set("p1", {
    frameFinish: "black",
    finish,
    blinds: [
      {
        opening: "front-1of2",
        fabric: "urban",
        colour: "Carbon",
        cover: "PELMET",
        lowered: 50,
        infill: true,
      },
    ],
    lighting: {
      rafterCount: 4,
      cedarCount: 0,
      rafterLayout: "even",
      cedarLayout: "even",
      strips: [],
      rafterAmount: "low",
    },
  });
  set("p2", {
    family: "box",
    frameFinish: "white",
    attachmentIntent: "freestanding",
    finish: { ...finish, material: "acrylic" },
  });
  edit = positionWebsitePergola(edit, "p2", {
    originXMm: "10000",
    originYMm: "0",
    rotationDeg: "0",
  });
  if (count === 3) {
    edit = addWebsitePergola(edit, "p3");
    set("p3", {
      family: "gable",
      orientation: "parallel",
      frameFinish: "black",
      attachmentIntent: "freestanding",
      finish: { ...finish, material: "acrylic" },
    });
    edit = positionWebsitePergola(edit, "p3", {
      originXMm: "10000",
      originYMm: "6000",
      rotationDeg: "0",
    });
  }
  return edit;
}

it("reuses exact warm mixed base outcomes on unrelated release and complete Undo", async () => {
  const initial = mixed(3),
    svg = await open("p2", "soffit", initial),
    original = structuredClone(latest.edit!);
  const replied = new Set<unknown>();
  let tasks = 0;
  for (let limit = 0; limit < 30; limit++) {
    const worker = workers.find(
      (w) => !w.terminated && w.request && !replied.has(w.request),
    );
    if (!worker) break;
    replied.add(worker.request);
    tasks++;
    await act(async () => worker.reply());
    await flush();
  }
  expect(tasks).toBe(9);
  const evaluate = vi.spyOn(attachmentEvaluation, "evaluateStudioAttachment"),
    clearance = vi.spyOn(clearanceEvaluation, "evaluateDemoClearance"),
    registry = vi.spyOn(registryOwner, "buildProjectHouseGeometryRegistry");
  const baseline = [...svg.querySelectorAll('[role="button"][transform]')].map(
    (node) => node.getAttribute("transform"),
  );
  pointer(grab(svg), "pointerdown");
  pointer(svg, "pointermove", 32, 20);
  pointer(svg, "pointerup", 32, 20);
  expect(latest.session!.generation).toBe(1);
  const release = {
    evaluate: evaluate.mock.calls.length,
    clearance: clearance.mock.calls.length,
    registry: registry.mock.calls.length,
  };
  evaluate.mockClear();
  clearance.mockClear();
  registry.mockClear();
  await act(async () => {
    await queue;
  });
  act(() => button("Undo").click());
  expect(latest.edit!.spatial).toEqual(original.spatial);
  expect(latest.edit!.objectOptions).toEqual(original.objectOptions);
  expect(
    [...svg.querySelectorAll('[role="button"][transform]')].map((node) =>
      node.getAttribute("transform"),
    ),
  ).toEqual(baseline);
  const undo = {
    evaluate: evaluate.mock.calls.length,
    clearance: clearance.mock.calls.length,
    registry: registry.mock.calls.length,
  };
  await act(async () => {
    await queue;
  });
  expect({ release, undo }).toEqual({
    release: { evaluate: 0, clearance: 0, registry: 1 },
    undo: { evaluate: 0, clearance: 0, registry: 0 },
  });
});

it.each([2,3] as const)("does not reserialize the unchanged %s-product authoring on held frames, but invalidates keys on release and Undo",async count=>{
  const initial=mixed(count),svg=await open("p2","soffit",initial),original=structuredClone(latest.edit!);
  const replied=new Set<unknown>();
  for(let limit=0;limit<30;limit++) {
    const worker=workers.find(w=>!w.terminated&&w.request&&!replied.has(w.request));
    if(!worker)break;replied.add(worker.request);await act(async()=>worker.reply());await flush();
  }
  expect(replied.size).toBe(count*3);
  const raw=JSON.stringify.bind(JSON),snapshots:StudioAuthoringEdit[]=[],sceneKeys:unknown[]=[],priceIdentities:unknown[]=[];
  const stringify=vi.spyOn(JSON,"stringify").mockImplementation((value:any,replacer?:any,space?:any)=>{
    if(Array.isArray(value)&&value.length===4&&value[0]===scope.designId&&value[1]?.pergolas)sceneKeys.push(value);
    if(value?.designId===scope.designId&&value.composition)snapshots.push(value.composition);
    if(Array.isArray(value)&&value[0]===scope.actorId&&value[1]===scope.projectId&&value[2]===scope.estimateId&&typeof value[3]==="string")priceIdentities.push(value);
    return raw(value,replacer,space);
  });
  try {
    const committed=latest.edit;pointer(grab(svg),"pointerdown");
    snapshots.length=0;sceneKeys.length=0;priceIdentities.length=0;
    for(let i=1;i<=6;i++)pointer(svg,"pointermove",20+i*5,20+i*2);
    expect(latest.edit).toBe(committed);expect(svg.getAttribute("data-gesture-phase")).toBe("dragging");
    expect({authoring:snapshots.length,scene:sceneKeys.length,priceIdentity:priceIdentities.length}).toEqual({authoring:0,scene:0,priceIdentity:0});
    pointer(svg,"pointerup",60,32);
    expect(latest.session!.generation).toBe(1);expect(latest.edit!.spatial).not.toEqual(original.spatial);
    expect(sceneKeys.length).toBeGreaterThan(0);expect(snapshots.some(edit=>raw(edit.spatial)===raw(latest.edit!.spatial))).toBe(true);
    await act(async()=>{await queue;});
    snapshots.length=0;sceneKeys.length=0;
    act(()=>button("Undo").click());
    expect(latest.edit!.spatial).toEqual(original.spatial);expect(latest.canSave).toBe(false);
    expect(sceneKeys.length).toBeGreaterThan(0);expect(snapshots.some(edit=>raw(edit.spatial)===raw(original.spatial))).toBe(true);
  } finally {stringify.mockRestore();}
});

it("shows the promised night preview from Plan and returns in daylight without authoring or losing the Plan frame",async()=>{
  const svg=await open(),frame=svg.getAttribute("viewBox"),original=structuredClone(latest.edit!),identity={...latest.authoredIdentity};
  act(()=>button("Design choices").click());act(()=>button("Lights").click());
  expect(button("Plan").getAttribute("aria-pressed")).toBe("true");
  act(()=>button("Night").click());
  expect(button("3D").getAttribute("aria-pressed")).toBe("true");
  expect(webgl.children.props.presentation.current).toBe(1);
  expect(button("Day")).toBeTruthy();
  act(()=>button("Day").click());
  expect(button("3D").getAttribute("aria-pressed")).toBe("true");
  expect(webgl.children.props.presentation.current).toBe(0);
  act(()=>button("Plan").click());
  expect(mounted!.container.querySelector('svg[aria-label="Studio design Plan"]')?.getAttribute("viewBox")).toBe(frame);
  expect(latest.edit).toEqual(original);expect(latest.authoredIdentity).toEqual(identity);expect(latest.canSave).toBe(false);
  expect(button("Save design").disabled).toBe(true);expect(button("Undo").disabled).toBe(true);
});


it.each(["Shape", "Roof"] as const)("skips unchanged %s fields during real held moves and keeps current option/Undo authority", async section => {
  const initial = mixed(3), selected = section === "Roof" ? "p1" : "p2";
  const svg = await open(selected, "soffit", initial);
  act(() => button("Design choices").click());
  if (section === "Roof") act(() => button("Design").click());
  const replied = new Set<unknown>();
  for (let limit = 0; limit < 30; limit++) {
    const worker = workers.find(w => !w.terminated && w.request && !replied.has(w.request));
    if (!worker) break;
    replied.add(worker.request); await act(async () => worker.reply()); await flush();
  }
  expect(replied.size).toBe(9);
  const original = latest.edit!, frame = svg.getAttribute("viewBox");
  const target = svg.querySelector('[data-selected-product-grab="' + selected + '"]')!;
  pointer(target, "pointerdown");
  const resolve = vi.spyOn(websiteDesignOwner, "resolveStudioWebsiteDesign"),
    roofBand = vi.spyOn(geometryOwner, "allowsHouseBand");
  for (let move = 1; move <= 6; move++) {
    pointer(svg, "pointermove", 20 + move * 5, 20 + move * 2);
    expect(svg.getAttribute("data-gesture-phase")).toBe("dragging");
    expect(latest.edit).toBe(original);
  }
  expect({ shape: resolve.mock.calls.length, roof: roofBand.mock.calls.length }).toEqual({ shape: 0, roof: 0 });
  resolve.mockRestore(); roofBand.mockRestore();
  pointer(svg, "pointercancel");
  expect(latest.edit).toBe(original); expect(latest.canSave).toBe(false);
  expect(svg.getAttribute("viewBox")).toBe(frame);

  // A real accepted pose must become the next option callback's complete basis.
  act(() => button("Pergola 2").click()); act(() => button("Design choices").click());
  const nextTarget = svg.querySelector('[data-selected-product-grab="p2"]')!;
  pointer(nextTarget, "pointerdown"); pointer(svg, "pointermove", 40, 30); pointer(svg, "pointerup", 40, 30);
  await act(async () => { await queue; });
  const moved = structuredClone(latest.edit!);
  expect(moved.spatial).not.toEqual(original.spatial);
  act(() => button("Design choices").click()); act(() => button("Design").click());
  const width = mounted!.container.querySelector<HTMLInputElement>('[aria-label="Width in millimetres"]')!;
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(width, "6200"); width.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(latest.edit!.spatial).toEqual(moved.spatial);
  expect(latest.edit!.objectOptions.find(row => row.objectId === "p2")!.values.websiteDesign).toMatchObject({ rawDimensions: { widthMm: "6200" } });
  expect(latest.edit!.objectOptions.filter(row => row.objectId !== "p2")).toEqual(moved.objectOptions.filter(row => row.objectId !== "p2"));
  act(() => button("Undo").click()); expect(latest.edit).toEqual(moved);

  // Selection changes must route the same stable callback to the current object.
  act(() => button("Pergola 1").click()); act(() => button("Design choices").click()); act(() => button("Design").click());
  const beforeRoof = structuredClone(latest.edit!);
  act(() => button("Solid + timber").click());
  expect(latest.edit!.objectOptions.find(row => row.objectId === "p1")!.values.websiteDesign).toMatchObject({ selection: { roof: { finish: { material: "solid" } } } });
  expect(latest.edit!.objectOptions.find(row => row.objectId === "p2")).toEqual(beforeRoof.objectOptions.find(row => row.objectId === "p2"));
  act(() => button("Undo").click()); expect(latest.edit).toEqual(beforeRoof);
});


it("refreshes memoized option callbacks when the actual session scope changes", async () => {
  await open("p2", "soffit", mixed(3));
  act(() => button("Design choices").click()); act(() => button("Design").click());
  const oldScope = { ...latest.session!.scope }, oldEdit = structuredClone(latest.edit!);
  const nextScope = { ...scope, actorId: "10000000-0000-4000-8000-000000000002", estimateId: "est_30000000-0000-4000-8000-000000000002" },
    incoming = mixed(2);
  incoming.revision = 19;
  mocks.owner.mockReturnValue(nextScope.actorId);
  sessionStorage.setItem(studioHouseContextKey(nextScope), JSON.stringify({ selected: "p2", mode: "options", section: "Roof", view: "Plan" }));
  mounted!.rerender(<Harness {...parentProps(incoming)} scope={nextScope} />); await flush();
  expect(latest.canEdit).toBe(true); expect(latest.session!.scope).toEqual(nextScope);
  const current = structuredClone(latest.edit!);
  act(() => button("Solid + timber").click());
  expect(latest.session!.scope).toEqual(nextScope); expect(latest.edit!.revision).toBe(19);
  expect(latest.edit!.spatial).toEqual(current.spatial);
  expect(latest.edit!.objectOptions.find(row => row.objectId === "p2")!.values.websiteDesign).toMatchObject({ selection: { roof: { finish: { material: "solid" } } } });
  expect(latest.edit!.objectOptions.some(row => row.objectId === "p3")).toBe(false);
  act(() => button("Undo").click()); expect(latest.edit).toEqual(current);
  expect(oldScope).toEqual(scope); expect(oldEdit.objectOptions.some(row => row.objectId === "p3")).toBe(true);
});


it.each(["Discard changes", "repair"])("reviews the retained invalid rotation visibly with keyboard activation before %s and the next real grab", async action => {
  const svg = await open("house"), original = structuredClone(latest.edit!);
  const field = mounted!.container.querySelector<HTMLInputElement>('[aria-label="House rotationDeg"]')!;
  act(() => { field.closest("details")!.open = true; field.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "-"); field.dispatchEvent(new Event("input", { bubbles: true })); field.blur(); });
  act(() => button("Pergola 1").click());
  const retained = sessionStorage.getItem(scope.actorId + ":" + scope.projectId + ":" + scope.estimateId + ":" + scope.designId + ":3:studio-house-pending");
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  const review = button("Review house changes");
  act(() => { review.focus(); review.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); review.click(); }); // jsdom does not supply native button keyboard activation.
  act(() => frames.splice(0).forEach(callback => callback(0)));
  const current = mounted!.container.querySelector<HTMLInputElement>('[aria-label="House rotationDeg"]')!;
  expect(current.value).toBe("-"); expect(current.getAttribute("aria-invalid")).toBe("true");
  expect(current.closest("details")!.open).toBe(true); expect(document.activeElement).toBe(current);
  expect(latest.edit).toEqual(original); expect(button("Undo").disabled).toBe(true);
  expect(sessionStorage.getItem(scope.actorId + ":" + scope.projectId + ":" + scope.estimateId + ":" + scope.designId + ":3:studio-house-pending")).toBe(retained);
  if (action === "repair") {
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(current, "0"); current.dispatchEvent(new Event("input", { bubbles: true })); current.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
  } else act(() => button("Discard unfinished input").click());
  act(() => button("Pergola 2").click());
  const beforeMove = structuredClone(latest.edit!);
  pointer(grab(svg), "pointerdown"); pointer(svg, "pointermove", 40, 30); pointer(svg, "pointerup", 40, 30);
  expect(latest.edit!.spatial).not.toEqual(beforeMove.spatial);
  act(() => button("Undo").click()); expect(latest.edit).toEqual(beforeMove);
});

it("keeps Width fallback and cancels obsolete focus/reveal after newer selection or session scope", async () => {
  await open("house");
  const type = (label: string, raw: string) => act(() => { const field = mounted!.container.querySelector<HTMLInputElement>('[aria-label="' + label + '"]')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, raw); field.dispatchEvent(new Event("input", { bubbles: true })); });
  type("Width (mm)", "8100"); act(() => button("Pergola 1").click());
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  act(() => button("Review house changes").click()); act(() => frames.splice(0).forEach(callback => callback(0)));
  expect(document.activeElement).toBe(mounted!.container.querySelector('[aria-label="Width (mm)"]'));
  type("House rotationDeg", "-"); act(() => button("Pergola 1").click()); act(() => button("Review house changes").click());
  act(() => { button("Pergola 1").click(); }); act(() => { button("House").click(); button("House").focus(); });
  act(() => frames.splice(0).forEach(callback => callback(0)));
  expect(mounted!.container.querySelector('[aria-label="House rotationDeg"]')!.closest("details")!.open).toBe(false);
  expect(document.activeElement).toBe(button("House"));
  act(() => button("Pergola 1").click()); act(() => button("Review house changes").click());
  const nextScope = { ...scope, actorId: "10000000-0000-4000-8000-000000000002", estimateId: "est_30000000-0000-4000-8000-000000000002" };
  mocks.owner.mockReturnValue(nextScope.actorId);
  sessionStorage.setItem(studioHouseContextKey(nextScope), JSON.stringify({ selected: "house", mode: "options", section: "Shape", view: "Plan" }));
  mounted!.rerender(<Harness {...parentProps()} scope={nextScope} />); await flush();
  act(() => { button("House").focus(); frames.splice(0).forEach(callback => callback(0)); });
  expect(latest.session!.scope).toEqual(nextScope);
  expect(mounted!.container.querySelector('[aria-label="House rotationDeg"]')!.closest("details")!.open).toBe(false);
  expect(document.activeElement).toBe(button("House"));
});


it("avoids unused Cedar-panel opening solves on Position entry and the first Shape selection", async () => {
  let initial = mixed(3);
  const row = websiteComposition(initial).find(row => row.object.id === "p1")!, value = structuredClone(row.value!);
  value.selection.roof.sidePanels = [{ ...defaultSidePanel("left-1of1", "timber"), species: "cedar" }];
  initial = changeStudioProduct(initial, value);
  const raw = structuredClone(initial), actualResolve = websiteDesignOwner.resolveStudioWebsiteDesign, actualOpenings = geometryOwner.previewBlindOpenings;
  let resolving = 0, unused = 0;
  vi.spyOn(websiteDesignOwner, "resolveStudioWebsiteDesign").mockImplementation((...args) => { resolving++; try { return actualResolve(...args); } finally { resolving--; } });
  vi.spyOn(geometryOwner, "previewBlindOpenings").mockImplementation((...args) => { if (resolving) unused++; return actualOpenings(...args); });
  const svg = await open("p2", "soffit", initial), entry = unused;
  const original = latest.edit!, frame = svg.getAttribute("viewBox");
  pointer(svg.querySelector('[aria-label="Select Pergola 1"]')!, "pointerdown"); pointer(svg, "pointercancel");
  const position = unused - entry;
  act(() => button("Design choices").click()); const shape = unused - entry - position;
  expect({ entry, position, shape }).toEqual({ entry: 0, position: 0, shape: 0 });
  expect(latest.edit).toBe(original); expect(latest.edit).toEqual(raw); expect(latest.canSave).toBe(false);
  expect(svg.getAttribute("viewBox")).toBe(frame);
});

it("keeps one authored session and all three tab choices while lighting and Plan tools remain in Split", async()=>{
  const svg=await open(),original=structuredClone(latest.edit!),identity={...latest.authoredIdentity};
  act(()=>button("Design choices").click());
  act(()=>button("Split").click());
  expect(button("Split").getAttribute("aria-pressed")).toBe("true");
  act(()=>button("Lights").click());
  act(()=>button("Night").click());
  expect(button("Split").getAttribute("aria-pressed")).toBe("true");
  expect(webgl.children.props.presentation.current).toBe(1);
  expect(mounted!.container.querySelector('svg[aria-label="Studio design Plan"]')).toBeTruthy();
  act(()=>button("Choose members on plan").click());
  expect(button("Split").getAttribute("aria-pressed")).toBe("true");
  act(()=>button("Day").click());
  expect(webgl.children.props.presentation.current).toBe(0);
  act(()=>button("Sides").click());
  expect([...mounted!.container.querySelectorAll('[role="tab"]')].map(t=>t.textContent)).toEqual(['Design','Lights','Sides']);
  expect(mounted!.container.querySelector('svg[aria-label="Select a side opening"]')).toBeTruthy();
  act(()=>button("Design").click());
  expect(mounted!.container.querySelector('input[aria-label="Width in millimetres"]')).toBeTruthy();
  expect(latest.edit).toEqual(original);expect(latest.authoredIdentity).toEqual(identity);expect(latest.canSave).toBe(false);
  expect(button("Save design").disabled).toBe(true);expect(button("Undo").disabled).toBe(true);
});

it("arms the real LED member targets from fresh Lights in Split and toggles one authored member with complete Undo",async()=>{
  await open();
  const original=structuredClone(latest.edit!);
  act(()=>button("Design choices").click());
  act(()=>button("Split").click());
  act(()=>button("Lights").click());
  act(()=>button("Choose members on plan").click());
  expect(button("Split").getAttribute("aria-pressed")).toBe("true");
  const svg=mounted!.container.querySelector<SVGSVGElement>('svg[aria-label="Studio design Plan"]')!;
  const member=svg.querySelector<SVGElement>('[role="button"][data-light-member]');
  expect(member,"fresh Lights must expose actual selectable LED members").not.toBeNull();
  const id=member!.getAttribute("data-light-member")!;
  expect(latest.edit).toEqual(original);
  pointer(member!,"pointerdown");pointer(svg,"pointerup");
  act(()=>member!.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,detail:1})));
  const selected=websiteComposition(latest.edit!).find(row=>row.object.id==="p2")!.value!;
  expect(selected.selection.roof.lighting?.strips).toContain(id);
  expect(latest.edit!.spatial).toEqual(original.spatial);
  expect(latest.edit!.objectOptions.filter(row=>row.objectId!=="p2")).toEqual(original.objectOptions.filter(row=>row.objectId!=="p2"));
  expect(latest.session!.generation).toBe(1);
  await act(async()=>{await queue;});
  act(()=>button("Undo").click());
  expect(latest.edit).toEqual(original);expect(latest.canSave).toBe(false);
  expect(button("Split").getAttribute("aria-pressed")).toBe("true");
  expect(button("Undo").disabled).toBe(true);
});

it("retains explicit Day and Night across Plan, Split and 3D layouts with authored lights populated",async()=>{
  await open();const original=structuredClone(latest.edit!);
  act(()=>button("Design choices").click());act(()=>button("Lights").click());
  act(()=>button("Outer perimeter").click());
  expect(websiteComposition(latest.edit!).find(row=>row.object.id==="p2")!.value!.selection.roof.lighting!.strips.length).toBeGreaterThan(0);
  const lit=structuredClone(latest.edit!);
  act(()=>button("Day").click());expect(webgl.children.props.presentation.current).toBe(0);
  act(()=>button("Plan").click());act(()=>button("Split").click());
  expect(webgl.children.props.presentation.current,"layout-only Plan to Split must retain explicit Day").toBe(0);
  act(()=>button("3D").click());expect(webgl.children.props.presentation.current).toBe(0);
  act(()=>button("Night").click());expect(webgl.children.props.presentation.current).toBe(1);
  act(()=>button("Plan").click());act(()=>button("Split").click());expect(webgl.children.props.presentation.current).toBe(1);
  act(()=>button("3D").click());expect(webgl.children.props.presentation.current).toBe(1);
  expect(latest.edit).toEqual(lit);expect(latest.session!.generation).toBe(1);
  await act(async()=>{await queue;});act(()=>button("Undo").click());
  expect(latest.edit).toEqual(original);expect(latest.canSave).toBe(false);
});

it.each(['Design','Lights','Sides'])('retains the %s inspector after ordinary Plan movement and complete Undo',async tab=>{
 const svg=await open(),original=structuredClone(latest.edit!);
 act(()=>button('Design choices').click());act(()=>button(tab).click());
 pointer(grab(svg),'pointerdown');pointer(svg,'pointermove',60,35);pointer(svg,'pointerup',66,39);
 expect(latest.session!.generation).toBe(1);expect(latest.edit!.spatial).not.toEqual(original.spatial);
 expect(mounted!.container.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toBe(tab);
 expect(mounted!.container.querySelector('input[aria-label="X (mm)"]')).toBeNull();
 await act(async()=>{await queue;});act(()=>button('Undo').click());expect(latest.edit).toEqual(original);expect(latest.canSave).toBe(false);
});

it('dismisses current object tools after navigation, Escape and outside interaction',async()=>{
 await open();const summary=mounted!.container.querySelector<HTMLElement>('summary[aria-label="Design tools"]')!,menu=summary.closest('details')!;
 act(()=>summary.click());expect(menu.open).toBe(true);act(()=>button('Design choices').click());
 expect(menu.open).toBe(false);expect(document.activeElement).toBe(summary);
 act(()=>summary.click());expect(menu.open).toBe(true);
 act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));expect(menu.open).toBe(false);expect(document.activeElement).toBe(summary);
 act(()=>summary.click());const outside=button('3D');outside.focus();pointer(outside,'pointerdown');expect(menu.open).toBe(false);expect(document.activeElement).toBe(outside);
});

it('places frequent Design choices first, prioritises fitted ceiling lights and reveals current Design roof options through keyboard navigation',async()=>{
 let initial=mixed(2);const value=websiteComposition(initial).find(row=>row.object.id==='p1')!.value!;
 initial=changeStudioProduct(initial,{...value,selection:{...value.selection,roof:{...value.selection.roof,finish:{...value.selection.roof.finish!,material:'solid',ceiling:'cedar-100'}}}});
 await open('p1','soffit',initial);const original=structuredClone(latest.edit!);act(()=>button('Design choices').click());
 const finish=mounted!.container.querySelector('[aria-label="Frame finish"]')!,details=mounted!.container.querySelector('[data-studio-roof-options]')!;
 expect(finish.compareDocumentPosition(details)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 const tab=mounted!.container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!;
 act(()=>tab.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true})));
 expect(document.activeElement?.textContent).toBe('Lights');
 expect(mounted!.container.querySelector('[role="tabpanel"] h3')?.textContent).toBe('Ceiling downlights');
 expect(mounted!.container.textContent).not.toContain('in Roof & ceiling');
 const frames:FrameRequestCallback[]=[];vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.push(callback);return frames.length;});
 act(()=>button('Open Design roof options').click());act(()=>frames.splice(0).forEach(callback=>callback(0)));
 const current=mounted!.container.querySelector<HTMLDetailsElement>('[data-studio-roof-options]')!;
 expect(current.open).toBe(true);expect(document.activeElement).toBe(current.querySelector('summary'));
 expect(latest.edit).toEqual(original);expect(latest.canSave).toBe(false);
});

it('keeps every actual opening selectable and authors one chosen treatment without editing its neighbour',async()=>{
 const initial=mixed(2),row=websiteComposition(initial).find(row=>row.object.id==='p1')!,openings=geometryOwner.previewBlindOpenings(row.design!.input,row.design!.roof),front=openings.filter(opening=>opening.side==='front');
 expect(front.length).toBeGreaterThan(1);await open('p1','soffit',initial);const original=structuredClone(latest.edit!);act(()=>button('Design choices').click());act(()=>button('Sides').click());
 const picker=mounted!.container.querySelector('svg[aria-label="Select a side opening"]')!;expect(picker.querySelectorAll('[role="button"]')).toHaveLength(openings.length);
 const target=picker.querySelector(`[aria-label="Choose ${front[1].label}"]`)!;act(()=>target.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
 const select=mounted!.container.querySelector<HTMLSelectElement>('[aria-label="Selected opening treatment"]')!;
 act(()=>{Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(select,'timber');select.dispatchEvent(new Event('change',{bubbles:true}));});
 const current=websiteComposition(latest.edit!).find(row=>row.object.id==='p1')!.value!;
 expect(current.selection.roof.sidePanels).toEqual([expect.objectContaining({opening:front[1].id,kind:'timber'})]);
 expect(current.selection.roof.blinds).toEqual(row.value!.selection.roof.blinds);expect(latest.edit!.objectOptions.filter(r=>r.objectId!=='p1')).toEqual(original.objectOptions.filter(r=>r.objectId!=='p1'));
 await act(async()=>{await queue;});act(()=>button('Undo').click());expect(latest.edit).toEqual(original);expect(latest.canSave).toBe(false);
});

it('completes a real side group at the finish choice, with no Apply gate and one full Undo',async()=>{
 await open('p1','soffit',mixed(2));act(()=>button('Design choices').click());act(()=>button('Sides').click());
 const original=structuredClone(latest.edit!),group=[...mounted!.container.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent==='Side groups')!;
 act(()=>group.querySelector('summary')!.click());
 const choices=[...group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].slice(0,2);expect(choices).toHaveLength(2);
 act(()=>choices[0].click());act(()=>choices[1].click());expect(latest.edit).toEqual(original);
 const finish=group.querySelector('select')!;act(()=>{finish.value='aluminium';finish.dispatchEvent(new Event('change',{bubbles:true}));});
 const panels=websiteComposition(latest.edit!).find(r=>r.object.id==='p1')!.value!.selection.roof.sidePanels!;
 expect(panels).toHaveLength(2);expect(panels.every(p=>p.kind==='aluminium')).toBe(true);
 expect([...group.querySelectorAll('button')].some(b=>b.textContent==='Apply finish')).toBe(false);
 act(()=>button('Undo').click());expect(latest.edit).toEqual(original);await act(async()=>{await queue;});
});

it('retains planned support truth, explicit independent supports, first attach, method change and detach with complete Undo',async()=>{
 await open();const original=structuredClone(latest.edit!);act(()=>button('Design choices').click());
 expect(websiteComposition(latest.edit!).find(r=>r.object.id==='p2')!.studioAttachment).toBeNull();expect(websiteComposition(latest.edit!).find(r=>r.object.id==='p2')!.value!.selection.roof.attachmentIntent).toBeUndefined();
 act(()=>button('Freestanding').click());expect(websiteComposition(latest.edit!).find(r=>r.object.id==='p2')!.value!.selection.roof.attachmentIntent).toBe('freestanding');
 await act(async()=>{await queue;});act(()=>button('Undo').click());expect(latest.edit).toEqual(original);
 const edge=mounted!.container.querySelector<HTMLSelectElement>('section[aria-label="House connection"] select')!;expect(edge).toBeTruthy();act(()=>{edge.value='house:front';edge.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(button('Apply connection')).toBeUndefined();await act(async()=>{await queue;});
 expect(websiteComposition(latest.edit!).find(r=>r.object.id==='p2')!.studioAttachment?.method).toBe('facade');
 const attached=structuredClone(latest.edit!);act(()=>button('Fascia').click());expect(button('Apply connection')).toBeUndefined();await act(async()=>{await queue;});
 expect(websiteComposition(latest.edit!).find(r=>r.object.id==='p2')!.studioAttachment?.method).toBe('fascia');act(()=>button('Undo').click());expect(latest.edit).toEqual(attached);
 act(()=>button('Position & height').click());act(()=>button('Detach').click());await act(async()=>{await queue;});expect(websiteComposition(latest.edit!).find(r=>r.object.id==='p2')!.studioAttachment).toBeNull();
 act(()=>button('Undo').click());expect(latest.edit).toEqual(attached);
});

it('cancels actual authored placement on the second touch, keeps camera-only movement outside Undo and allows the next touch grab',async()=>{
 const svg=await open(),original=structuredClone(latest.edit!);act(()=>button('Design choices').click());
 const touch=(target:Element,type:string,id:number,x:number,y:number)=>{const event=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1});Object.defineProperties(event,{pointerId:{value:id},pointerType:{value:'touch'}});act(()=>target.dispatchEvent(event));};
 touch(grab(svg),'pointerdown',1,100,100);touch(svg,'pointermove',1,130,120);expect(svg.getAttribute('data-gesture-phase')).toBe('dragging');expect(latest.edit).toEqual(original);
 touch(svg,'pointerdown',2,200,100);touch(svg,'pointermove',2,260,130);touch(svg,'pointerup',2,260,130);touch(svg,'pointerup',1,130,120);
 expect(latest.edit).toEqual(original);expect(latest.session!.generation).toBe(0);expect(button('Undo').disabled).toBe(true);expect(latest.canSave).toBe(false);
 const frame=svg.getAttribute('viewBox');touch(grab(svg),'pointerdown',1,100,100);touch(svg,'pointermove',1,140,125);touch(svg,'pointerup',1,150,130);expect(latest.session!.generation).toBe(1);
 await act(async()=>{await queue;});act(()=>button('Undo').click());expect(latest.edit).toEqual(original);expect(svg.getAttribute('viewBox')).toBe(frame);expect(latest.canSave).toBe(false);
});

it('keeps a replacement contact camera-only while the other physical Plan contact remains down',async()=>{
 const svg=await open(),original=structuredClone(latest.edit!);
 const touch=(target:EventTarget,type:string,id:number,x:number,y:number)=>{const event=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1});Object.defineProperties(event,{pointerId:{value:id},pointerType:{value:'touch'}});act(()=>target.dispatchEvent(event));};
 touch(svg,'pointerdown',1,100,100);touch(svg,'pointerdown',2,200,100);touch(svg,'pointermove',2,250,130);
 touch(svg,'pointerup',2,250,130);touch(svg,'lostpointercapture',2,250,130);
 // Contact 1 remains physically down. A replacement finger on the product
 // must continue camera input, never acquire the object's authored controller.
 touch(grab(svg),'pointerdown',3,180,160);touch(svg,'pointermove',3,230,190);touch(svg,'pointerup',3,240,195);
 expect(latest.edit).toEqual(original);expect(latest.session!.generation).toBe(0);expect(button('Undo').disabled).toBe(true);expect(latest.canSave).toBe(false);
 // Release outside the SVG after capture retirement, then a fresh one-finger
 // gesture is a real object move and still has one complete Undo.
 touch(window,'pointerup',1,100,100);const frame=svg.getAttribute('viewBox');
 touch(grab(svg),'pointerdown',4,100,100);touch(svg,'pointermove',4,140,125);touch(svg,'pointerup',4,150,130);expect(latest.session!.generation).toBe(1);
 await act(async()=>{await queue;});act(()=>button('Undo').click());expect(latest.edit).toEqual(original);expect(svg.getAttribute('viewBox')).toBe(frame);expect(latest.canSave).toBe(false);
});

it('keeps the stationary Split model and accessory contexts unchanged through held Plan overlays, then publishes the accepted edit and complete Undo',async()=>{
 const svg=await open(),original=structuredClone(latest.edit!),frame=svg.getAttribute('viewBox');act(()=>button('Design choices').click());act(()=>button('Split').click());
 pointer(grab(svg),'pointerdown');pointer(svg,'pointermove',30,35);
 const renders=webgl.renders,children=webgl.children,lighting=webgl.lighting,blinds=webgl.blinds,ghost=svg.querySelector('[data-direct-footprint]')!.outerHTML;
 for(let i=1;i<=6;i++)pointer(svg,'pointermove',30+i*5,35+i*3);
 expect(svg.querySelector('[data-direct-footprint]')!.outerHTML).not.toBe(ghost);expect(latest.edit).toEqual(original);expect(latest.session!.generation).toBe(0);
 expect(webgl.renders-renders,'unchanged visible Model/context work during six Plan overlay updates').toBe(0);
 expect(webgl.children).toBe(children);expect(webgl.lighting).toBe(lighting);expect(webgl.blinds).toBe(blinds);
 pointer(svg,'pointerup',70,59);expect(latest.session!.generation).toBe(1);expect(latest.edit).not.toEqual(original);expect(webgl.renders).toBeGreaterThan(renders);
 await act(async()=>{await queue;});act(()=>button('Undo').click());expect(latest.edit).toEqual(original);expect(svg.getAttribute('viewBox')).toBe(frame);expect(latest.canSave).toBe(false);expect(button('Split').getAttribute('aria-pressed')).toBe('true');
});

it('keeps loading, live Workspace and saved-only exits native without unused prefetch, retaining protected fallback defaults',async()=>{
 const value={callback:`/staff/design-studio/${scope.projectId}/${scope.estimateId}/edit`,admission:null,visible:false,error:null,leaving:false,frame:{current:null},retry:vi.fn()};
 const props=parentProps(),waiting:Array<(value:unknown)=>void>=[];
 mocks.get.mockImplementation(()=>new Promise(resolve=>waiting.push(resolve)));
 mounted=renderIntoDocument(<StudioDocumentContext.Provider value={value}><Harness {...props}/></StudioDocumentContext.Provider>);
 await flush();expect(latest.edit).toBeNull();
 const links=()=>[...mounted!.container.querySelectorAll<HTMLAnchorElement>('a')].filter(a=>a.href.includes('/staff/'));
 expect(links()).toHaveLength(2);expect(links().every(a=>a.dataset.prefetch==='false')).toBe(true);
 mocks.get.mockImplementation(async()=>undefined);await act(async()=>{for(const resolve of waiting.splice(0))resolve(undefined);});await flush();
 expect(latest.canEdit).toBe(true);expect(links()).toHaveLength(3);expect(links().every(a=>a.dataset.prefetch==='false')).toBe(true);
 mounted.unmount();mounted=renderIntoDocument(<StudioDocumentContext.Provider value={value}><Harness {...parentProps(fixture(),false)}/></StudioDocumentContext.Provider>);await flush();
 expect(latest.status).toBe('locked');expect(links()).toHaveLength(2);expect(links().every(a=>a.dataset.prefetch==='false')).toBe(true);
 mounted.unmount();mounted=renderIntoDocument(<Harness {...parentProps(fixture(),false)}/>);await flush();
 expect(links()).toHaveLength(2);expect(links().every(a=>a.dataset.prefetch==='undefined')).toBe(true);
});
