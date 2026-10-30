import {studioConnectionSwitchTarget,previewStudioConnectionSwitch} from '@/lib/designStudio/studioConnectionSwitch';
import { studioAlignmentFixture } from "../../../../test/studioAlignmentFixture";
import { studioWallAcquisitionFixture } from "../../../../test/studioWallAcquisitionFixture";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import {
  useStudioEditingSession,
  type StudioEditingSessionProps,
} from "./useStudioEditingSession";
import StudioHouseWorkspace from "./StudioHouseWorkspace";
import StudioCommercialFields from "./StudioCommercialFields";
import { loadCostingConfigV1, ACCESSORY_REVIEW_RATES } from "@sp/costing";
import { buildAdditionalAluminiumCatalogue } from "@/lib/costing/additionalAluminiumCatalogue";
import { calculateStudioCommercialPricing } from "@/lib/designStudio/studioCommercialPricing.server";
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
import { applyStudioPergolaEdit } from "@/lib/designStudio/pergolaEditing";
import { createStudioAuthoringEdit, mergeStudioAuthoringEdit, projectStudioAuthoringView, type StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import type { StudioAuthoredV1 } from "@/lib/designStudio/contracts";
import { invalidateStudioLifecycle } from "@/lib/designStudio/studioLifecycle";
import { studioHouseContextKey } from "./studioHouseContext";
import * as scenes from "@/lib/designStudio/interaction/resolvedScene";
import * as preparation from "@/lib/designStudio/interaction/preparation";
import { studioAttachmentFixture } from "../../../../test/studioAttachmentFixture";
import { studioPreparationReply } from "../../../../test/studioPlacementTestWorker";
import { websiteJoinStates } from "@/lib/designStudio/websiteJoins";
import { previewBlindOpenings } from '@sp/configurator/geometry';
import type { StudioWebsiteDesign } from '@/lib/designStudio/websiteDesign';

const webgl = vi.hoisted(() => ({ children: null as any, events: false }));
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  keys: vi.fn(),
  update: vi.fn(),
  owner: vi.fn(),
  api: vi.fn(),
}));
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
vi.mock("@sp/geometry-viewer/react/canvas", () => ({
  SceneCanvas: ({ children }: any) => {
    webgl.children = children;
    return webgl.events ? <div data-studio-renderer-source /> : null;
  },
}));
vi.mock("next/dynamic", async () => {
  const scene = await import("./StudioHouseCanvas");
  return { default: () => scene.default };
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
let commercialFields = false;
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
      data: studioPreparationReply(this.request),
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
function Harness(props: StudioEditingSessionProps) {
  latest = useStudioEditingSession(props);
  return latest.edit ? (
    <>
    <StudioHouseWorkspace controller={latest} scope={props.scope} versionLabel="V1" />
    {commercialFields && <StudioCommercialFields edit={latest.edit} disabled={!latest.canEdit} onChange={latest.change} />}
    </>
  ) : (
    <p>Loading</p>
  );
}
const flush = () => act(async () => {});
async function open(
  selected = "p2",
  method: "facade" | "soffit" = "facade",
  initial?: StudioAuthoringEdit,
  updatedAt = "2026-10-21T00:00:00Z",
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
      updatedAt={updatedAt}
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
  return event;
}
function grab(svg: SVGSVGElement) {
  return svg.querySelector('[data-selected-product-grab="p2"]')!;
}
function button(text: string) {
  return [...mounted!.container.querySelectorAll("button")].find(
    (b) => b.textContent === (({Duplicate:"Duplicate pergola", "Change connection":"Change house connection", "Connect to house":"Attach to house", Wall:"Fa\u00e7ade", "Soffit brackets":"Soffit"} as Record<string,string>)[text] ?? text),
  )!;
}
const pose = () =>
  websiteComposition(latest.edit!).find((p) => p.object.id === "p2")!.position!;

beforeEach(() => {
  commercialFields = false;
  webgl.events = false;
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

function shortcut(target: Element, key: string, options: KeyboardEventInit = {}, type = "keydown") {
  const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, key, ...options });
  act(() => target.dispatchEvent(event));
  return event;
}

function captureMergedStudioSave(initial:StudioAuthoringEdit){
 let captured:StudioAuthoringEdit|undefined;
 const authored:StudioAuthoredV1={schemaVersion:'studio_authored.v1',designId:initial.designId,revision:initial.revision,spatialOutputKey:'drawing_object_first',site:{validation:'preserved_unvalidated',values:initial.site},objectOptions:initial.objectOptions.map(row=>({objectId:row.objectId,options:{validation:'preserved_unvalidated',values:row.values}})),legacyCommercialAssociations:[],provenance:{sourceEstimateId:null,sourceKind:'authored',sourcePayload:null}};
 mocks.api.mockImplementationOnce(async(_url,options)=>{const command=JSON.parse(options.body),merged=mergeStudioAuthoringEdit({storedAuthored:authored,storedSpatial:initial.spatial,edit:command.edit});expect(merged.ok).toBe(true);if(!merged.ok)throw Error(merged.message);
 const revision=initial.revision+1,loaded=projectStudioAuthoringView({authored:{...merged.value.authored,revision},spatial:merged.value.spatial});expect(loaded.ok).toBe(true);if(!loaded.ok)throw Error(loaded.message);captured=createStudioAuthoringEdit(loaded.value);
 return {receipt:{revision,savedAt:'2026-10-29T06:00:00Z',alreadyExisted:false},pricing:'unpriced'};});
 return ()=>{expect(captured,JSON.stringify({status:latest.status,message:latest.message,dirty:latest.session?.dirty,pending:!!latest.session?.pending,durable:latest.localDurable})).toBeTruthy();return captured!;};
}
function chooseHouseEdge(edge:string){const select=mounted!.container.querySelector<HTMLSelectElement>('select[aria-label="House edge"]')!;expect(select).toBeTruthy();act(()=>{select.value='house:'+edge;select.dispatchEvent(new Event('change',{bubbles:true}));});}
it.each(['blur','Enter'])('connects inline from 3D with actual 200 mm clearance through measured house repair on %s and complete Undo',async(completion)=>{
 let initial:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:scope.designId,revision:3,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
 const added=applyStudioHouseEdit(initial.spatial,{kind:'add',id:'house',label:'House'});if(!added.ok)throw Error(added.message);initial.spatial=added.spatial;
 initial=addWebsitePergola(initial,'p2');const value=websiteComposition(initial)[0].value!;initial=changeStudioProduct(initial,{...value,rawDimensions:{widthMm:'6000',projectionMm:'4000'}});
 await open('p2','facade',initial);act(()=>button('Design choices').click());act(()=>button('3D').click());
 expect(button('Wall')).toBeTruthy();expect(button('Freestanding')).toBeTruthy();expect(websiteComposition(latest.edit!)[0].studioAttachment).toBeNull();
 chooseHouseEdge('rear');await flush();expect(button('3D').getAttribute('aria-pressed')).toBe('true');
 expect(mounted!.container.textContent).toMatch(/2000.5000/);expect(websiteComposition(latest.edit!)[0].studioAttachment).toBeNull();
 act(()=>button('Check house height').click());await act(async()=>{await new Promise(resolve=>setTimeout(resolve,35));});
 const field=mounted!.container.querySelector<HTMLInputElement>('input[aria-label="Eave height (mm)"]')!;expect(document.activeElement).toBe(field);
 act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,'3000');field.dispatchEvent(new Event('input',{bubbles:true}));});
 act(()=>completion==='blur'?field.blur():field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));await flush();
 expect(studioHouseScene(latest.edit!.site,latest.edit!.spatial)!.houses[0].eaveHeightMm).toBe('3000');
 act(()=>button('Return to Pergola 1 '+String.fromCharCode(183)+' Shape').click());await flush();
 const connected=websiteComposition(latest.edit!)[0];expect(connected.error).toBeNull();expect(connected.studioAttachment).toMatchObject({edge:'rear',method:'facade'});
 expect(connected.value?.facadeClearanceMm).toBe('200');expect(connected.geometryOptions?.supportDatumMm).toBeGreaterThanOrEqual(2000);
 expect(button('3D').getAttribute('aria-pressed')).toBe('true');expect(mounted!.container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Design');
 act(()=>button('Plan').click());act(()=>button('Design choices').click());expect(button('Plan').getAttribute('aria-pressed')).toBe('true');
 act(()=>button('House').click());act(()=>button('Pergola 1').click());act(()=>button('Position & height').click());expect(button('Plan').getAttribute('aria-pressed')).toBe('true');
 act(()=>button('Undo').click());await flush();expect(websiteComposition(latest.edit!)[0].studioAttachment).toBeNull();expect(studioHouseScene(latest.edit!.site,latest.edit!.spatial)!.houses[0].eaveHeightMm).toBe('3000');
 act(()=>button('Redo').click());await flush();expect(websiteComposition(latest.edit!)[0].studioAttachment?.method).toBe('facade');
});
it('keeps an unconnected inline choice out of a separate task, preserving 3D and normal movement when changing inspector tabs',async()=>{
 await open();act(()=>button('Design choices').click());act(()=>button('3D').click());
 const original=structuredClone(latest.edit!);act(()=>button('Connect to house').click());await flush();
 expect(button('3D').getAttribute('aria-pressed')).toBe('true');expect(mounted!.container.querySelector('select[aria-label="House edge"]')).toBeTruthy();
 const lights=mounted!.container.querySelector<HTMLButtonElement>('[role="tab"][id="studio-tab-Lighting"]')!;act(()=>lights.click());
 expect(mounted!.container.textContent).not.toContain('Preview only');expect(latest.edit).toEqual(original);
});
it("keyboard nudges coalesce one held key and support real Undo/Redo and snapshot paste with stable redo IDs", async () => {
  const svg = await open(), start = pose(), original = structuredClone(latest.edit!);
  shortcut(svg, "ArrowRight"); shortcut(svg, "ArrowRight", { repeat: true }); shortcut(svg, "ArrowRight", { repeat: true });
  shortcut(svg, "ArrowRight", {}, "keyup");
  expect(pose().x).toBe(start.x + 30);
  shortcut(svg, "z", { ctrlKey: true }); expect(pose()).toEqual(start);
  shortcut(svg, "y", { ctrlKey: true }); expect(pose().x).toBe(start.x + 30);
  shortcut(svg, "c", { ctrlKey: true });
  const copied = structuredClone(latest.edit!.objectOptions.find(r => r.objectId === "p2")!.values);
  act(() => { const edit = structuredClone(latest.edit!); edit.site.access = "hard"; latest.change(edit); });
  shortcut(svg, "v", { ctrlKey: true });
  const pasted = latest.edit!.spatial.pergolas.at(-1)!;
  expect(pasted.id).not.toBe("p2"); expect(latest.edit!.spatial.pergolas).toHaveLength(original.spatial.pergolas.length + 1);
  const value = latest.edit!.objectOptions.find(r => r.objectId === pasted.id)!.values;
  expect(value.websiteDesign).toMatchObject({ ...(copied.websiteDesign as object), objectId: pasted.id });
  shortcut(svg, "z", { ctrlKey: true }); expect(latest.edit!.spatial.pergolas.some(p => p.id === pasted.id)).toBe(false);
  shortcut(svg, "y", { ctrlKey: true }); expect(latest.edit!.spatial.pergolas.at(-1)!.id).toBe(pasted.id);
  expect(latest.edit!.site.access).toBe("hard");
});
it("keyboard history survives the same working-copy Review/remount lifetime", async () => {
  const original = fixture(), svg = await open("p2", "facade", original), start = pose();
  shortcut(svg, "ArrowUp"); shortcut(svg, "ArrowUp", {}, "keyup");
  expect(pose().y).toBe(start.y + 10); await flush();
  mounted!.unmount(); await flush();
  const returned = await open("p2", "facade", original);
  shortcut(returned, "z", { ctrlKey: true }); expect(pose()).toEqual(start);
  shortcut(returned, "Z", { metaKey: true, shiftKey: true }); expect(pose().y).toBe(start.y + 10);
});
it("owns unclaimed ready-editor focus so the first physical shortcut needs no canvas click",async()=>{
  await open();const main=mounted!.container.querySelector('main')!;
  expect(document.activeElement).toBe(main);
  expect(shortcut(document.activeElement as Element,'c',{ctrlKey:true}).defaultPrevented).toBe(true);
  shortcut(document.activeElement as Element,'v',{ctrlKey:true});expect(latest.edit!.spatial.pergolas).toHaveLength(3);
});
it("returns focus from BODY to the ready Workspace and immediately undoes the actual House2 deletion after Review remount",async()=>{
  const initial=fixture();await open('house','facade',initial);
  act(()=>button('Duplicate house').click());const house2=latest.edit!.spatial.houseAssembly!.houseForms.at(-1)!.id;
  act(()=>button('Remove house').click());expect(latest.edit!.spatial.houseAssembly!.houseForms.some(h=>h.id===house2)).toBe(false);
  await flush();mounted!.unmount();mounted=undefined;await flush();expect(document.activeElement).toBe(document.body);
  await open('house','facade',initial);expect(button('Undo').disabled).toBe(false);
  shortcut(document.activeElement as Element,'z',{ctrlKey:true});
  expect(latest.edit!.spatial.houseAssembly!.houseForms.some(h=>h.id===house2)).toBe(true);
  expect(JSON.parse(sessionStorage.getItem(studioHouseContextKey(scope))!).selected).toBe(house2);
  expect(document.activeElement).toBe(mounted!.container.querySelector('main'));
});
it.each(['input','selected text'])('does not acquire ready Workspace focus over existing %s ownership',async kind=>{
  const claimed=document.createElement(kind==='input'?'input':'p');claimed.textContent='Existing selected text';document.body.append(claimed);
  try{
    if(kind==='input')claimed.focus();else {const range=document.createRange();range.selectNodeContents(claimed);window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);}
    await open();expect(document.activeElement).toBe(kind==='input'?claimed:document.body);
    if(kind==='selected text')expect(window.getSelection()!.isCollapsed).toBe(false);
  }finally{window.getSelection()!.removeAllRanges();claimed.remove();}
});
it.each(['BODY','input'])('reconciles keyboard focus after Save acknowledgement with %s owning focus',async owner=>{
  await open('house');act(()=>button('Duplicate house').click());const house2=latest.edit!.spatial.houseAssembly!.houseForms.at(-1)!.id;
  mocks.api.mockResolvedValueOnce({receipt:{revision:4,savedAt:'2026-10-23T08:00:00Z',alreadyExisted:false},pricing:'unpriced'});
  await act(async()=>{await latest.save();});
  act(()=>button('Remove house').click());expect(latest.edit!.spatial.houseAssembly!.houseForms.some(h=>h.id===house2)).toBe(false);
  let confirm!:(value:unknown)=>void,saving!:Promise<void>;
  mocks.api.mockImplementationOnce(()=>new Promise(resolve=>{confirm=resolve;}));
  const save=button('Save design');act(()=>save.focus());await act(async()=>{saving=latest.save();});expect(save.disabled).toBe(true);
  // Model Chrome's observed disabled-button retirement with actual DOM focus.
  // jsdom keeps a disabled button focused and ignores blur on that button.
  act(()=>{document.body.setAttribute('tabindex','-1');document.body.focus();document.body.removeAttribute('tabindex');});
  expect(document.activeElement).toBe(document.body);
  const input=mounted!.container.querySelector<HTMLInputElement>('input[aria-label="Width (mm)"]')!;
  if(owner==='input')act(()=>input.focus());
  await act(async()=>{confirm({receipt:{revision:5,savedAt:'2026-10-23T08:01:00Z',alreadyExisted:false},pricing:'unpriced'});await saving;});
  expect(latest.status).toBe('ready');expect(button('Save design').disabled).toBe(true);expect(button('Undo').disabled).toBe(false);
  if(owner==='input')expect(document.activeElement).toBe(input);
  else {
    shortcut(document.activeElement as Element,'z',{ctrlKey:true});
    expect(latest.edit!.spatial.houseAssembly!.houseForms.some(h=>h.id===house2)).toBe(true);
    expect(latest.canSave).toBe(true);expect(document.activeElement).toBe(mounted!.container.querySelector('main'));
  }
});
it("keeps scene Undo Redo and Paste available from an ordinary option button after clicking a real edit",async()=>{
  const svg=await open(),before=structuredClone(latest.edit!);
  shortcut(svg,'c',{ctrlKey:true});
  act(()=>button('Design choices').click());
  act(()=>{button('Box').focus();button('Box').click();});
  const edited=structuredClone(latest.edit!);expect(edited).not.toEqual(before);expect(button('Undo').disabled).toBe(false);
  expect(shortcut(button('Box'),'z',{ctrlKey:true}).defaultPrevented).toBe(true);expect(latest.edit).toEqual(before);
  act(()=>button('Box').focus());shortcut(button('Box'),'y',{ctrlKey:true});expect(latest.edit).toEqual(edited);
  act(()=>button('Box').focus());shortcut(button('Box'),'v',{ctrlKey:true});
  const pasted=latest.edit!.spatial.pergolas.at(-1)!.id;expect(pasted).not.toBe('p2');
  expect(latest.edit!.spatial.pergolas).toHaveLength(before.spatial.pergolas.length+1);
  expect(latest.edit!.objectOptions.find(row=>row.objectId===pasted)!.values.websiteDesign).toMatchObject({objectId:pasted,selection:{roof:{family:'mono'}}});
  act(()=>button('Box').focus());shortcut(button('Box'),'Delete');expect(latest.edit!.spatial.pergolas.some(p=>p.id===pasted)).toBe(false);
  shortcut(mounted!.container.querySelector('main')!,'z',{ctrlKey:true});expect(latest.edit!.spatial.pergolas.at(-1)!.id).toBe(pasted);
});
it("allows navigator arrows while preserving the actual inspector tab's native arrow navigation",async()=>{
  await open();const start=pose(),nav=[...mounted!.container.querySelectorAll<HTMLButtonElement>('nav[aria-label="Design objects"] button')].find(b=>b.textContent==='Pergola 2')!;
  act(()=>{nav.focus();nav.click();});
  expect(shortcut(nav,'ArrowRight',{shiftKey:true}).defaultPrevented).toBe(true);shortcut(window as unknown as Element,'ArrowRight',{},'keyup');
  expect(pose().x).toBe(start.x+100);
  act(()=>button('Design choices').click());
  const tab=mounted!.container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!,before=structuredClone(latest.edit!);
  act(()=>tab.focus());expect(shortcut(tab,'ArrowRight').defaultPrevented).toBe(true);
  expect(mounted!.container.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toBe('Lights');
  expect(latest.edit).toEqual(before);
  let active=mounted!.container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!;
  expect(shortcut(active,'z',{ctrlKey:true}).defaultPrevented).toBe(true);expect(pose()).toEqual(start);
  active=mounted!.container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!;
  shortcut(active,'y',{ctrlKey:true});expect(pose().x).toBe(start.x+100);
});
it("ends a held arrow group on window interruption and keeps Shift100 separate from the next nudge",async()=>{
  const svg=await open(),before=structuredClone(latest.edit!),start=pose();
  shortcut(svg,'ArrowRight',{shiftKey:true});shortcut(svg,'ArrowRight',{shiftKey:true,repeat:true});
  expect(pose().x).toBe(start.x+200);
  act(()=>window.dispatchEvent(new Event('blur')));
  shortcut(svg,'ArrowUp');shortcut(window as unknown as Element,'ArrowUp',{},'keyup');
  expect(pose().y).toBe(start.y+10);
  shortcut(svg,'z',{ctrlKey:true});expect(pose()).toEqual({...start,x:start.x+200});
  shortcut(svg,'z',{ctrlKey:true});expect(latest.edit).toEqual(before);
});
it("keyboard Copy/Delete/Paste works after real object navigation, keeps the snapshot and restores selection through Undo/Redo",async()=>{
  await open();const original=structuredClone(latest.edit!),frame=mounted!.container.querySelector('svg[aria-label="Studio design Plan"]')!.getAttribute('viewBox');
  const nav=[...mounted!.container.querySelectorAll<HTMLButtonElement>('nav[aria-label="Design objects"] button')].find(b=>b.textContent==='Pergola 2')!;
  act(()=>nav.focus());expect(shortcut(nav,'c',{ctrlKey:true}).defaultPrevented).toBe(true);
  const main=mounted!.container.querySelector('main')!;expect(document.activeElement).toBe(main);
  shortcut(main,'Delete');expect(latest.edit!.spatial.pergolas.some(p=>p.id==='p2')).toBe(false);
  shortcut(main,'v',{ctrlKey:true});const pasted=latest.edit!.spatial.pergolas.at(-1)!;expect(pasted.id).not.toBe('p2');
  expect(latest.edit!.objectOptions.find(r=>r.objectId===pasted.id)!.values.websiteDesign).toMatchObject({objectId:pasted.id});
  shortcut(main,'z',{ctrlKey:true});shortcut(main,'z',{ctrlKey:true});expect(latest.edit).toEqual(original);
  expect(JSON.parse(sessionStorage.getItem(studioHouseContextKey(scope))!).selected).toBe('p2');
  shortcut(main,'y',{ctrlKey:true});shortcut(main,'y',{ctrlKey:true});expect(latest.edit!.spatial.pergolas.at(-1)!.id).toBe(pasted.id);
  expect(mounted!.container.querySelector('svg[aria-label="Studio design Plan"]')!.getAttribute('viewBox')).toBe(frame);
});
it("keyboard preserves native fields/widgets/text/IME and belongs to mouse-acquired canvas rather than the document",async()=>{
  const svg=await open(),before=structuredClone(latest.edit!);const main=mounted!.container.querySelector('main')!;
  pointer(grab(svg),'pointerdown');pointer(svg,'pointerup');expect(document.activeElement).toBe(main);
  for(const tag of ['input','textarea','select','div']){
    const node=document.createElement(tag);if(tag==='div')node.setAttribute('contenteditable','');main.append(node);
    for(const key of ['Delete','ArrowRight','z','v'])expect(shortcut(node,key,{ctrlKey:key==='z'||key==='v'}).defaultPrevented).toBe(false);
    node.remove();
  }
  const nav=mounted!.container.querySelector('nav[aria-label="Design objects"] button')!;
  for(const role of ['combobox','spinbutton','menu','menuitem']){
    const widget=document.createElement('div');widget.setAttribute('role',role);main.append(widget);
    for(const key of ['Delete','ArrowRight','z','v'])expect(shortcut(widget,key,{ctrlKey:key==='z'||key==='v'}).defaultPrevented).toBe(false);
    widget.remove();
  }
  for(const role of ['tab','listbox','slider','tree','grid']){
    const widget=document.createElement('div');widget.setAttribute('role',role);main.append(widget);
    expect(shortcut(widget,'ArrowRight').defaultPrevented).toBe(false);widget.remove();
  }
  expect(shortcut(svg,'ArrowRight',{isComposing:true}).defaultPrevented).toBe(false);
  const range=document.createRange();range.selectNodeContents(nav);window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);expect(window.getSelection()!.isCollapsed).toBe(false);
  expect(shortcut(main,'Delete').defaultPrevented).toBe(false);window.getSelection()!.removeAllRanges();
  const stop=(event:Event)=>event.preventDefault();svg.addEventListener('keydown',stop);expect(shortcut(svg,'Delete').defaultPrevented).toBe(true);svg.removeEventListener('keydown',stop);
  const menu=main.querySelector('summary[aria-label="Design tools"]')!.parentElement as HTMLDetailsElement;menu.open=true;
  expect(shortcut(main,'Delete').defaultPrevented).toBe(false);menu.open=false;
  shortcut(document.body,'Delete');expect(latest.edit).toEqual(before);
  shortcut(main,'ArrowRight');shortcut(window as unknown as Element,'ArrowRight',{},'keyup');expect(pose().x).toBe(websiteComposition(before).find(p=>p.object.id==='p2')!.position!.x+10);
});
it("keyboard slides a House37 attachment through current canonical intent and restores its full binding with Undo/Redo",async()=>{
  const base={...studioAttachmentFixture(37),designId:scope.designId};
  const initial=previewStudioAttachment(base,{objectId:'p2',houseId:'house',edge:'rear',kind:'wall',method:'facade',alongEdgeMm:500});
  const svg=await open('p2','facade',initial),before=structuredClone(latest.edit!);
  shortcut(svg,'ArrowLeft');shortcut(svg,'ArrowLeft',{},'keyup');const moved=structuredClone(latest.edit!);
  const original=websiteComposition(before)[0],after=websiteComposition(moved)[0];
  expect(Math.abs(after.studioAttachment!.alongEdgeMm!-500)).toBe(10);expect(after.object.attachment).toEqual(original.object.attachment);expect(after.value).toEqual(original.value);
  shortcut(svg,'z',{ctrlKey:true});expect(latest.edit).toEqual(before);
  shortcut(svg,'y',{ctrlKey:true});expect(latest.edit).toEqual(moved);
});
it("keyboard Undo shares the header's pending-save authority and Redo waits without changing the frozen request",async()=>{
  const svg=await open(),original=structuredClone(latest.edit!);shortcut(svg,'ArrowRight');shortcut(svg,'ArrowRight',{},'keyup');
  const moved=structuredClone(latest.edit!);let confirm!:(value:unknown)=>void,saving!:Promise<void>;
  mocks.api.mockImplementationOnce(()=>new Promise(resolve=>{confirm=resolve;}));
  await act(async()=>{saving=latest.save();});
  const sent=structuredClone(latest.session!.pending!.command);expect(button('Undo').disabled).toBe(false);
  shortcut(svg,'z',{ctrlKey:true});expect(latest.edit).toEqual(original);expect(latest.session!.pending!.command).toEqual(sent);
  const future=structuredClone(latest.session!.history!.future);expect(button('Redo').disabled).toBe(true);
  shortcut(svg,'y',{ctrlKey:true});expect(latest.edit).toEqual(original);expect(latest.session!.history!.future).toEqual(future);expect(latest.session!.pending!.command).toEqual(sent);
  await act(async()=>{confirm({receipt:{revision:4,savedAt:'2026-10-23T06:20:00Z',alreadyExisted:false},pricing:'unpriced'});await saving;});
  expect(latest.session!.dirty).toBe(true);shortcut(svg,'y',{ctrlKey:true});
  expect(latest.edit).toEqual({...moved,revision:4});expect(latest.session!.dirty).toBe(false);
});
it("keyboard clipboard cannot cross actor/epoch authority and a captured old read cannot copy the new owner's work",async()=>{
  const initial=fixture(),svg=await open('p2','facade',initial);shortcut(svg,'c',{ctrlKey:true});
  const capture=latest.captureEdit,identity=latest.authoredIdentity;
  const nextScope={...scope,actorId:'10000000-0000-4000-8000-000000000002'};
  mocks.owner.mockReturnValue(nextScope.actorId);invalidateStudioLifecycle();
  await act(async()=>mounted!.rerender(<Harness scope={nextScope} editable updatedAt='2026-10-21T00:00:00Z' view={{...initial,schemaVersion:'studio_authoring_view.v1',pricing:'unpriced'}}/>));await flush();
  expect(latest.canEdit).toBe(true);expect(capture(identity)).toBeNull();
  const before=structuredClone(latest.edit!);shortcut(mounted!.container.querySelector('main')!,'v',{ctrlKey:true});expect(latest.edit).toEqual(before);
});
it("roundtrips keyboard Paste Save Delete Save Undo Save through actual merge and a fresh hook reopen",async()=>{
  const initial=fixture(),svg=await open('p2','facade',initial),frame=svg.getAttribute('viewBox');
  let server:{authored:StudioAuthoredV1;spatial:StudioAuthoringEdit['spatial']}={authored:{schemaVersion:'studio_authored.v1',designId:initial.designId,revision:initial.revision,spatialOutputKey:'drawing_object_first',site:{validation:'preserved_unvalidated',values:initial.site},objectOptions:initial.objectOptions.map(row=>({objectId:row.objectId,options:{validation:'preserved_unvalidated',values:row.values}})),legacyCommercialAssociations:[],provenance:{sourceEstimateId:null,sourceKind:'authored',sourcePayload:null}},spatial:initial.spatial};
  let calls=0,savedAt='';
  mocks.api.mockImplementation(async(_url,options)=>{const command=JSON.parse(options.body),merged=mergeStudioAuthoringEdit({storedAuthored:server.authored,storedSpatial:server.spatial,edit:command.edit});expect(merged.ok).toBe(true);if(!merged.ok)throw Error(merged.message);const revision=server.authored.revision+1;savedAt=`2026-10-23T07:10:0${++calls}Z`;server={authored:{...merged.value.authored,revision},spatial:merged.value.spatial};return{receipt:{revision,savedAt,alreadyExisted:false},pricing:'unpriced'};});
  shortcut(svg,'c',{ctrlKey:true});shortcut(svg,'v',{ctrlKey:true});const copy=latest.edit!.spatial.pergolas.at(-1)!.id;
  await act(async()=>{await latest.save();});
  act(()=>button('Pergola 2').click());shortcut(button('Pergola 2'),'Delete');await act(async()=>{await latest.save();});
  shortcut(mounted!.container.querySelector('main')!,'z',{ctrlKey:true});expect(latest.edit!.spatial.pergolas.some(p=>p.id==='p2')).toBe(true);
  await act(async()=>{await latest.save();});expect(latest.session!.dirty).toBe(false);expect(calls).toBe(3);
  const saved=structuredClone(latest.edit!),loaded=projectStudioAuthoringView(server);expect(loaded.ok).toBe(true);if(!loaded.ok)throw Error(loaded.message);
  expect(saved.objectOptions).toEqual(loaded.value.objectOptions);expect(saved.objectOptions.map(r=>r.objectId)).toEqual(['p1',copy,'p2']);
  mounted!.unmount();mounted=undefined;await flush();
  const reopened=await open('p2','facade',createStudioAuthoringEdit(loaded.value),savedAt);expect(latest.status).toBe('ready');expect(latest.canEdit).toBe(true);expect(latest.session!.dirty).toBe(false);expect(latest.edit).toEqual(saved);expect(reopened.getAttribute('viewBox')).toBe(frame);
});

type WorkspaceApply = "house" | "connection" | "join";
it('completes house appearance through the real session, full Undo, durable merge and normal reopen without moving the scene',async()=>{
 const svg=await open('house'),before=structuredClone(latest.edit!),frame=svg.getAttribute('viewBox');
 const typeColour=(raw:string)=>{const field=mounted!.container.querySelector<HTMLInputElement>('input[aria-label="House roof colour HEX"]')!;act(()=>{field.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,raw);field.dispatchEvent(new Event('input',{bubbles:true}));});return field;};
 let field=typeColour('#506070');act(()=>field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 const completed=structuredClone(latest.edit!);expect(completed.spatial.houseAssembly!.houseForms[0].appearance).toEqual({roofColour:'#506070'});
 const generation=latest.authoredIdentity!.generation;act(()=>field.blur());expect(latest.authoredIdentity!.generation).toBe(generation);
 expect(completed.spatial.pergolas).toEqual(before.spatial.pergolas);expect(completed.objectOptions).toEqual(before.objectOptions);expect(completed.site).toEqual(before.site);
 act(()=>button('Undo').click());expect(latest.edit).toEqual(before);expect(latest.session!.dirty).toBe(false);
 const config={...loadCostingConfigV1(),accessoryRates:structuredClone(ACCESSORY_REVIEW_RATES)},price=calculateStudioCommercialPricing(before,config);
 const change=(label:string,value:string)=>act(()=>{const select=mounted!.container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
 change('House wall material','brick');change('House roof profile','tray');change('House roof tray width','300');
 field=typeColour('#506070');act(()=>field.blur());
 const edited=structuredClone(latest.edit!);expect(edited.spatial.houseAssembly!.houseForms[0].appearance).toEqual({wallMaterial:'brick',roofProfile:'tray',roofTrayWidth:300,roofColour:'#506070'});
 expect(calculateStudioCommercialPricing(edited,config)).toEqual(price);expect(svg.getAttribute('viewBox')).toBe(frame);
 let server={authored:{schemaVersion:'studio_authored.v1',designId:scope.designId,revision:before.revision,spatialOutputKey:'drawing_object_first',site:{validation:'preserved_unvalidated',values:before.site},objectOptions:before.objectOptions.map(row=>({objectId:row.objectId,options:{validation:'preserved_unvalidated',values:row.values}})),legacyCommercialAssociations:[],provenance:{sourceEstimateId:null,sourceKind:'authored',sourcePayload:null}} as StudioAuthoredV1,spatial:before.spatial};
 const savedAt='2026-10-23T04:00:00Z';mocks.api.mockImplementationOnce(async(_url,options)=>{const command=JSON.parse(options.body),merged=mergeStudioAuthoringEdit({storedAuthored:server.authored,storedSpatial:server.spatial,edit:command.edit});if(!merged.ok)throw Error(merged.message);server={authored:{...merged.value.authored,revision:before.revision+1},spatial:merged.value.spatial};return{receipt:{revision:before.revision+1,savedAt,alreadyExisted:false},pricing:'unpriced'};});
 await act(async()=>{await latest.save();});expect(latest.session!.dirty).toBe(false);
 const projected=projectStudioAuthoringView(server);if(!projected.ok)throw Error(projected.message);expect(projected.value.spatial).toEqual(edited.spatial);
 mounted!.unmount();mounted=undefined;await flush();const reopened=await open('house','facade',createStudioAuthoringEdit(projected.value),savedAt);
 expect(latest.session!.dirty).toBe(false);expect(button('Save design').disabled).toBe(true);expect(latest.edit!.spatial).toEqual(edited.spatial);expect(reopened.getAttribute('viewBox')).toBe(frame);
 expect(mounted!.container.querySelector<HTMLSelectElement>('select[aria-label="House roof tray width"]')!.value).toBe('300');
 expect(mounted!.container.querySelector<HTMLInputElement>('input[aria-label="House roof colour HEX"]')!.value).toBe('#506070');
});
it('removes a saved optional house appearance through full Undo, a second Save and actual reopened projection',async()=>{
 await open('house');const before=structuredClone(latest.edit!);
 const colour=mounted!.container.querySelector<HTMLInputElement>('input[aria-label="House roof colour HEX"]')!;
 act(()=>{colour.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(colour,'#123456');colour.dispatchEvent(new Event('input',{bubbles:true}));});act(()=>colour.blur());
 let server={authored:{schemaVersion:'studio_authored.v1',designId:scope.designId,revision:before.revision,spatialOutputKey:'drawing_object_first',site:{validation:'preserved_unvalidated',values:before.site},objectOptions:before.objectOptions.map(row=>({objectId:row.objectId,options:{validation:'preserved_unvalidated',values:row.values}})),legacyCommercialAssociations:[],provenance:{sourceEstimateId:null,sourceKind:'authored',sourcePayload:null}} as StudioAuthoredV1,spatial:before.spatial};
 let saves=0,savedAt='';mocks.api.mockImplementation(async(_url,options)=>{const command=JSON.parse(options.body),merged=mergeStudioAuthoringEdit({storedAuthored:server.authored,storedSpatial:server.spatial,edit:command.edit});if(!merged.ok)throw Error(merged.message);const revision=server.authored.revision+1;savedAt=`2026-10-23T04:0${++saves}:00Z`;server={authored:{...merged.value.authored,revision},spatial:merged.value.spatial};return{receipt:{revision,savedAt,alreadyExisted:false},pricing:'unpriced'};});
 await act(async()=>{await latest.save();});expect(latest.session!.dirty).toBe(false);expect(server.spatial.houseAssembly!.houseForms[0].appearance?.roofColour).toBe('#123456');
 act(()=>button('Undo').click());expect(latest.edit!.spatial).toEqual(before.spatial);expect(latest.session!.dirty).toBe(true);
 await act(async()=>{await latest.save();});expect(latest.session!.dirty).toBe(false);
 const projected=projectStudioAuthoringView(server);if(!projected.ok)throw Error(projected.message);expect(projected.value.spatial).toEqual(before.spatial);expect(projected.value.spatial.houseAssembly!.houseForms[0]).not.toHaveProperty('appearance');
 mounted!.unmount();mounted=undefined;await flush();await open('house','facade',createStudioAuthoringEdit(projected.value),savedAt);
 expect(latest.edit!.spatial).toEqual(before.spatial);expect(latest.session!.dirty).toBe(false);expect(button('Save design').disabled).toBe(true);
});
it('offers only actual compatible Flat5 soffit edges in the native picker, retaining complete Undo and the held Plan',async()=>{
 let initial=studioAttachmentFixture(37),house=studioHouseScene(initial.site,initial.spatial)!.houses[0];initial=updateStudioHouse(initial,{...house,roof:{...house.roof,form:'flat',pitchDeg:'5',fall:'rear'}});initial.designId=scope.designId;
 const svg=await open('p2','facade',initial),before=structuredClone(latest.edit!),frame=svg.getAttribute('viewBox');
 act(()=>button('Attach to house').click());act(()=>button('Soffit brackets').click());
 const select=mounted!.container.querySelector<HTMLSelectElement>('select[aria-label="House edge"]')!;
 const eligible=[...select.options].filter(o=>o.value&&!o.disabled);expect(eligible.some(o=>o.value==='house:front')).toBe(false);expect(eligible.map(o=>o.value)).toEqual(['house:rear']);
 const methodChoice=structuredClone(latest.edit!);chooseHouseEdge('rear');
 expect(websiteComposition(latest.edit!)[0].studioAttachment?.edge).toBe('rear');expect(svg.getAttribute('viewBox')).toBe(frame);
 act(()=>button('Undo').click());expect(latest.edit).toEqual(methodChoice);act(()=>button('Undo').click());expect(latest.edit).toEqual(before);expect(svg.getAttribute('viewBox')).toBe(frame);
});
it('edits a real independent rear opening and all four side groups, fully undoes, then saves and reopens the canonical selections', async()=>{
 const initial=fixture(),value=initial.objectOptions.find(row=>row.objectId==='p2')!.values.websiteDesign as unknown as StudioWebsiteDesign;
 value.selection.roof.family='box';value.selection.roof.attachmentIntent='freestanding';initial.spatial.pergolas.find(p=>p.id==='p2')!.family='box';
 await open('p2','facade',initial);const before=structuredClone(latest.edit!);
 act(()=>button('Design choices').click());act(()=>button('Sides').click());
 const chooseRear=()=>mounted!.container.querySelector('[aria-label="Choose Rear 1"]')!.dispatchEvent(new MouseEvent('click',{bubbles:true}));
 const changeSelect=(select:HTMLSelectElement,next:string)=>act(()=>{select.value=next;select.dispatchEvent(new Event('change',{bubbles:true}));});
 act(chooseRear);changeSelect(mounted!.container.querySelector('[aria-label="Selected opening treatment"]')!,'blind');
 expect(websiteComposition(latest.edit!).find(r=>r.object.id==='p2')!.design!.roof.blinds).toMatchObject([{opening:'rear-1of2'}]);
 act(()=>button('Undo').click());expect(latest.edit).toEqual(before);
 const group=[...mounted!.container.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent==='Side groups')!;
 const targets=[...group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];expect(targets).toHaveLength(6);
 for(const target of targets)act(()=>target.click());
 changeSelect(group.querySelector('select')!,'timber');
 const completed=structuredClone(latest.edit!),row=websiteComposition(completed).find(r=>r.object.id==='p2')!;
 expect(new Set(previewBlindOpenings(row.design!.input,row.design!.roof,row.geometryOptions).map(o=>o.side))).toEqual(new Set(['front','left','right','rear']));
 expect(row.design!.roof.sidePanels).toHaveLength(6);expect(row.design!.roof.sidePanels!.every(p=>p.kind==='timber')).toBe(true);
 const config={...loadCostingConfigV1(),accessoryRates:structuredClone(ACCESSORY_REVIEW_RATES)},price=calculateStudioCommercialPricing(completed,config);
 expect(price.breakdown.some(line=>line.label.includes('Rear 1'))).toBe(true);
 act(()=>button('Undo').click());expect(latest.edit).toEqual(before);
 // Target selection is transient; finishing the choice authors one complete operation.
 changeSelect(group.querySelector('select')!,'timber');
 const authored=structuredClone(latest.edit!);expect(authored.objectOptions).toEqual(completed.objectOptions);
 let server={authored:{schemaVersion:'studio_authored.v1',designId:scope.designId,revision:before.revision,spatialOutputKey:'drawing_object_first',site:{validation:'preserved_unvalidated',values:before.site},objectOptions:before.objectOptions.map(r=>({objectId:r.objectId,options:{validation:'preserved_unvalidated',values:r.values}})),legacyCommercialAssociations:[],provenance:{sourceEstimateId:null,sourceKind:'authored',sourcePayload:null}} as StudioAuthoredV1,spatial:before.spatial};
 const savedAt='2026-10-23T03:00:00Z';mocks.api.mockImplementationOnce(async(_url,options)=>{const command=JSON.parse(options.body),merged=mergeStudioAuthoringEdit({storedAuthored:server.authored,storedSpatial:server.spatial,edit:command.edit});if(!merged.ok)throw Error(merged.message);server={authored:{...merged.value.authored,revision:before.revision+1},spatial:merged.value.spatial};return{receipt:{revision:before.revision+1,savedAt,alreadyExisted:false},pricing:'unpriced'};});
 await act(async()=>{await latest.save();});expect(latest.session!.dirty).toBe(false);
 const projected=projectStudioAuthoringView(server);if(!projected.ok)throw Error(projected.message);expect(projected.value.objectOptions).toEqual(authored.objectOptions);
 mounted!.unmount();mounted=undefined;await flush();await open('p2','facade',createStudioAuthoringEdit(projected.value),savedAt);
 const reopened=websiteComposition(latest.edit!).find(r=>r.object.id==='p2')!;expect(reopened.geometryOptions?.rearOpenings).toBe(true);expect(reopened.design!.roof.sidePanels).toEqual(row.design!.roof.sidePanels);expect(calculateStudioCommercialPricing(latest.edit!,config)).toEqual(price);expect(latest.session!.dirty).toBe(false);
 const saved=structuredClone(latest.edit!),svg=mounted!.container.querySelector<SVGSVGElement>('svg[aria-label="Studio design Plan"]')!,frame=svg.getAttribute('viewBox');
 pointer(grab(svg),'pointerdown',10,20);pointer(svg,'pointermove',35,40);pointer(svg,'pointerup',40,45);expect(latest.edit!.spatial).not.toEqual(saved.spatial);expect(svg.getAttribute('viewBox')).toBe(frame);
 act(()=>button('Undo').click());expect(latest.edit).toEqual(saved);expect(latest.session!.dirty).toBe(false);expect(svg.getAttribute('viewBox')).toBe(frame);
});

it('applies the actual Box next-inner-rafter LED preset through the current selected callback with one full Undo',async()=>{
 const initial=fixture(),value=initial.objectOptions.find(row=>row.objectId==='p2')!.values.websiteDesign as unknown as StudioWebsiteDesign;value.selection.roof.family='box';value.selection.roof.attachmentIntent='freestanding';initial.spatial.pergolas.find(p=>p.id==='p2')!.family='box';
 await open('p2','facade',initial);const before=structuredClone(latest.edit!);
 act(()=>button('Design choices').click());act(()=>button('Lights').click());act(()=>button('Outer perimeter').click());
 const lighting=websiteComposition(latest.edit!).find(r=>r.object.id==='p2')!.design!.roof.lighting!;
 expect(lighting.strips).toEqual(expect.arrayContaining(['box-rafter-0-1','box-rafter-0-9']));expect(lighting.strips).not.toContain('box-left');expect(lighting.strips).not.toContain('box-rafter-0-0');expect(latest.edit!.objectOptions.find(r=>r.objectId==='p1')).toEqual(before.objectOptions.find(r=>r.objectId==='p1'));
 act(()=>button('Undo').click());expect(latest.edit).toEqual(before);expect(latest.session!.dirty).toBe(false);
});
it("joins through real task/panel/Canvas and current session, keeps the committed model stationary, then saves and reopens canonical joins",async()=>{
 const complete=await pendingWorkspaceApply("join"),before=structuredClone(latest.edit!),svg=mounted!.container.querySelector('svg[aria-label="Studio design Plan"]')!,frame=svg.getAttribute('viewBox');
 const productTransforms=()=>[...svg.querySelectorAll('g[role="button"][transform]')].map(p=>p.getAttribute('transform'));
 const points=productTransforms();expect(points).toHaveLength(2);
 expect(latest.edit).toEqual(before);
 act(complete);let joined=structuredClone(latest.edit!);
 expect(websiteJoinStates(joined)[0].error).toBeNull();expect(svg.getAttribute('viewBox')).toBe(frame);
 act(()=>button('Undo').click());expect(latest.edit).toEqual(before);expect(svg.getAttribute('viewBox')).toBe(frame);
 expect(productTransforms()).toEqual(points);
 act(()=>button('Pergola joins').click());act(()=>button('Join to pergola').click());
 act(()=>mounted!.container.querySelector('[aria-label="Join target Pergola 1 · left"]')!.dispatchEvent(new MouseEvent('click',{bubbles:true})));
 const second=structuredClone(latest.edit!),firstJoin=websiteJoinStates(joined)[0].join,secondJoin=websiteJoinStates(second)[0].join;
 expect(secondJoin.id).not.toBe(firstJoin.id);
 expect(second).toEqual({...joined,site:{...joined.site,websiteJoins:{schemaVersion:'studio_website_joins.v1',joins:[{...firstJoin,id:secondJoin.id}]}}});joined=second;
 let server:{authored:StudioAuthoredV1;spatial:StudioAuthoringEdit['spatial']}={authored:{schemaVersion:'studio_authored.v1',designId:scope.designId,revision:before.revision,spatialOutputKey:'drawing_object_first',site:{validation:'preserved_unvalidated',values:before.site},objectOptions:before.objectOptions.map(row=>({objectId:row.objectId,options:{validation:'preserved_unvalidated',values:row.values}})),legacyCommercialAssociations:[],provenance:{sourceEstimateId:null,sourceKind:'authored',sourcePayload:null}},spatial:before.spatial};
 const savedAt='2026-10-23T00:00:00Z';
 mocks.api.mockImplementationOnce(async(_url,options)=>{const command=JSON.parse(options.body),merged=mergeStudioAuthoringEdit({storedAuthored:server.authored,storedSpatial:server.spatial,edit:command.edit});if(!merged.ok)throw Error(merged.message);server={authored:{...merged.value.authored,revision:before.revision+1},spatial:merged.value.spatial};return{receipt:{revision:before.revision+1,savedAt,alreadyExisted:false},pricing:'unpriced'};});
 await act(async()=>{await latest.save();});expect(latest.session!.dirty).toBe(false);
 const projected=projectStudioAuthoringView(server);if(!projected.ok)throw Error(projected.message);
 expect(projected.value.spatial).toEqual(joined.spatial);expect(projected.value.site).toEqual(joined.site);expect(projected.value.objectOptions).toEqual(joined.objectOptions);
 mounted!.unmount();mounted=undefined;await flush();await open('p2','facade',createStudioAuthoringEdit(projected.value),savedAt);
 expect(latest.session!.dirty).toBe(false);expect(websiteJoinStates(latest.edit!)[0].error).toBeNull();
 act(()=>button('Pergola joins · view or repair').click());expect(button('Reposition to join')).toBeTruthy();
 const reopened=structuredClone(latest.edit!);act(()=>button('Remove join').click());expect(websiteJoinStates(latest.edit!)).toEqual([]);expect(latest.edit!.spatial).toEqual(reopened.spatial);
 act(()=>button('Undo').click());expect(latest.edit).toEqual(reopened);
});
async function pendingWorkspaceApply(
  kind: WorkspaceApply,
  beforeIntent?: () => Promise<void>,
) {
  let initial: StudioAuthoringEdit | undefined;
  if (kind === "join") {
    initial = fixture();
    initial.site = {};
    initial.spatial.pergolas = [];
    initial.objectOptions = [];
    initial = positionWebsitePergola(
      addWebsitePergola(addWebsitePergola(initial, "p1"), "p2"),
      "p2",
      { originXMm: "15000", originYMm: "1000" },
    );
  }
  await open(
    kind === "house" ? "house" : kind === "connection" ? "p1" : "p2",
    "facade",
    initial,
  );
  act(() => {
    const next = structuredClone(latest.edit!);
    next.site.access = "hard";
    next.deletions = [
      { scope: "site", collection: "blinds.items", ids: ["ack-retired"] },
    ];
    latest.change(next);
  });
  await flush();
  await beforeIntent?.();
  const prepare = () => {
    if (kind === "house") {
      const field = mounted!.container.querySelector<HTMLInputElement>(
        'input[aria-label="Width (mm)"]',
      )!;
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(field, "8100");
      field.dispatchEvent(new Event("input", { bubbles: true }));
      return () => field.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter",bubbles:true}));
    }
    if (kind === "connection") {
      button("Change connection").click();
      return () => button("Fascia").click();
    }
    button("Pergola joins").click();
    return () => mounted!.container.querySelector('[aria-label="Join target Pergola 1 · left"]')!.dispatchEvent(new MouseEvent("click", {bubbles:true}));
  };
  let complete!: () => unknown;
  act(() => {
    complete = prepare();
  });
  if (kind === "join") {
    act(() => button("Join to pergola").click());
    const target = mounted!.container.querySelector(
      '[aria-label="Join target Pergola 1 · left"]',
    );
    expect(target).toBeTruthy();
  }
  expect(button("Apply house changes")).toBeUndefined();
  expect(button("Apply connection")).toBeUndefined();
  return complete;
}
it.each(["house", "connection", "join"] as const)(
  "applies %s intent from current source after a revision-only acknowledgement and restores one complete Undo",
  async (kind) => {
    let confirm!: (value: unknown) => void;
    mocks.api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    );
    let saving!: Promise<void>;
    const complete = await pendingWorkspaceApply(kind, async () => {
      await act(async () => {
        saving = latest.save();
      });
    });
    const generation = latest.session!.generation;
    expect(latest.authoredIdentity.scopeKey).toBe(JSON.stringify(scope));
    await act(async () => {
      confirm({
        receipt: {
          revision: 4,
          savedAt: "2026-10-21T01:00:00Z",
          alreadyExisted: false,
        },
        pricing: "unpriced",
      });
      await saving;
    });
    expect(latest.session!.generation).toBe(generation);
    expect(latest.edit!.revision).toBe(4);
    const previous = structuredClone(latest.edit!);
    act(complete);
    expect(latest.session!.generation).toBe(generation + 1);
    expect(latest.edit!.revision).toBe(4);
    expect(latest.edit!.deletions).toEqual([]);
    expect(button("Apply connection")).toBeUndefined();
    expect(button("Undo").disabled).toBe(false);
    act(() => button("Undo").click());
    expect(latest.edit).toEqual(previous);
    expect(button("Redo").disabled).toBe(false);
    await act(async () => {
      await queue;
    });
  },
);
it.each(["house", "connection", "join"] as const)(
  "retains %s intent and shows the real session refusal without success cleanup or Undo",
  async (kind) => {
    const complete = await pendingWorkspaceApply(kind),
      previous = structuredClone(latest.edit!), history = structuredClone(latest.session!.history);
    act(() => {
      invalidateStudioLifecycle();
      complete();
    });
    expect(latest.edit).toEqual(previous);
    expect(mounted!.container.textContent).not.toContain("Apply connection");
    expect(mounted!.container.textContent).toContain(
      "cannot currently be edited",
    );
    expect(latest.session!.history).toEqual(history);
    expect(latest.undo().kind).toBe("refused");
    if (kind === "house")
      expect(
        mounted!.container.querySelector<HTMLInputElement>(
          'input[aria-label="Width (mm)"]',
        )!.value,
      ).toBe("8100");
  },
);
it("applies the rotated explicit method switch and its measured house adjustment as one complete Undo",async()=>{
 let initial={...studioAttachmentFixture(37),designId:scope.designId};const house=studioHouseScene(initial.site,initial.spatial)!.houses[0];
 initial=updateStudioHouse(initial,{...house,wallHeightMm:'2500',eaveHeightMm:'2500'});
 initial=previewStudioAttachment(initial,{objectId:'p2',houseId:'house',edge:'rear',kind:'eave',method:'soffit',alongEdgeMm:925});
 await open('p2','soffit',initial);const before=structuredClone(latest.edit!);act(()=>button('Change connection').click());act(()=>button('Wall').click());
 const changed=structuredClone(latest.edit!),row=websiteComposition(changed)[0];
 expect(row).toMatchObject({error:null,studioAttachment:{method:'facade',edge:'rear'}});expect(row.value?.facadeClearanceMm).toBe('200');expect(row.geometryOptions!.supportDatumMm).toBeGreaterThanOrEqual(2000);
 expect(changed.spatial.houseAssembly).not.toEqual(before.spatial.houseAssembly);expect(row.position?.rotation).toBeCloseTo(websiteComposition(before)[0].position!.rotation);
 expect(button('Apply connection')).toBeUndefined();await act(async()=>{await queue;});act(()=>button('Undo').click());expect(latest.edit).toEqual(before);act(()=>button('Redo').click());expect(latest.edit).toEqual(changed);
 await act(async()=>{await queue;});
});

it("selects without a ghost, crosses four screen pixels once and survives deferred durability through exact release and whole Undo", async () => {
  const svg = await open(),
    original = structuredClone(latest.edit!),
    start = pose();
  pointer(grab(svg), "pointerdown");
  expect(svg.querySelector("[data-direct-footprint]")).toBeNull();
  expect(mounted!.container.textContent).not.toContain("Preview only");
  pointer(svg, "pointermove", 13, 20);
  expect(svg.querySelector("[data-direct-footprint]")).toBeNull();
  pointer(svg, "pointerup", 13, 20);
  expect(latest.session!.generation).toBe(0);
  let release!: () => void;
  heldStorage = new Promise((resolve) => {
    release = resolve;
  });
  act(() => {
    const edit = structuredClone(latest.edit!);
    edit.site.access = "hard";
    latest.change(edit);
  });
  pointer(grab(svg), "pointerdown");
  pointer(svg, "pointermove", 14, 20);
  expect(svg.querySelector("[data-direct-footprint]")).toBeTruthy();
  pointer(svg, "pointermove", 50, 70);
  const generation = latest.session!.generation;
  await act(async () => {
    heldStorage = null;
    release();
    await queue;
  });
  expect(latest.session!.generation).toBe(generation);
  expect(svg.querySelector("[data-direct-footprint]")).toBeTruthy();
  pointer(svg, "pointerup", 60, 80);
  expect(pose()).toMatchObject({ x: start.x + 50, y: start.y - 60 });
  expect(latest.session!.generation).toBe(generation + 1);
  expect(svg.querySelector("[data-direct-footprint]")).toBeNull();
  expect(svg.getAttribute("data-scene-generation")).toBe(
    String(generation + 1),
  );
  act(() => button("Undo").click());
  expect(pose()).toEqual(start);
  expect(latest.edit!.site.access).toBe("hard");
  expect(latest.edit!.objectOptions).toEqual(original.objectOptions);
  await flush();
});

it("commits a house then immediately grabs a valid pergola with no mounted full rebase or same-state resolver rebuild", async () => {
  const actualFactory = scenes.createStudioSceneResolver,
    resolveCalls: ReturnType<typeof vi.fn>[] = [];
  vi.spyOn(scenes, "createStudioSceneResolver").mockImplementation(() => {
    const resolver = actualFactory(),
      resolve = vi.fn(resolver.resolve);
    resolveCalls.push(resolve);
    return { ...resolver, resolve };
  });
  const rebase = vi.spyOn(preparation, "prepareStudioPlacement"),
    svg = await open();
  const count = () =>
    resolveCalls.reduce((sum, call) => sum + call.mock.calls.length, 0);
  const initial = count(),
    generation = latest.session!.generation;
  const house = svg.querySelector('[aria-label="Select House"]')!;
  pointer(house, "pointerdown");
  pointer(svg, "pointermove", 50, 70);
  pointer(svg, "pointerup", 60, 80);
  expect(latest.session!.generation).toBe(generation + 1);
  expect(count()).toBe(initial + 1);
  expect(rebase).not.toHaveBeenCalled();
  act(() => button("Pergola 2").click());
  const afterRelease = count();
  pointer(grab(svg), "pointerdown");
  pointer(svg, "pointermove", 50, 70);
  expect(svg.querySelector("[data-direct-footprint]")).toBeTruthy();
  expect(count()).toBe(afterRelease);
  expect(rebase).not.toHaveBeenCalled();
  expect(workers.slice(0, -1).every((worker) => worker.terminated)).toBe(true);
  const old = workers[0];
  act(() =>
    old.onmessage?.({
      data: {
        ...studioPreparationReply(old.request),
        result: { kind: "refused", reason: "obsolete" },
        incarnation: -1,
      },
    } as MessageEvent),
  );
  expect(svg.querySelector("[data-direct-footprint]")).toBeTruthy();
  expect(mounted!.container.textContent).not.toContain("obsolete");
  act(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(svg.querySelector("[data-direct-footprint]")).toBeNull();
  pointer(svg, "pointerup", 50, 70);
  expect(latest.session!.generation).toBe(generation + 1);
  await flush();
});

it("keeps an accepted 37-degree house movable through repeated applied rotations and immediate House/pergola gestures", async () => {
  const initial=fixture(),house=studioHouseScene(initial.site,initial.spatial)!.houses[0];
  const svg=await open("house","facade",updateStudioHouse(initial,{...house,position:{...house.position,rotationDeg:"37"}}));
  const frame=svg.getAttribute("viewBox");
  const moveAndUndo=(id:"house"|"p2")=>{
    act(()=>button(id==="house"?"House":"Pergola 2").click());
    const before=structuredClone(latest.edit!),generation=latest.session!.generation;
    const target=svg.querySelector(id==="house"?'[aria-label="Select House"]':'[data-selected-product-grab="p2"]')!;
    pointer(target,"pointerdown");expect(svg.getAttribute("data-gesture-phase")).toBe("pressed");
    pointer(svg,"pointermove",40,20);expect(svg.querySelector("[data-direct-footprint]")).toBeTruthy();
    pointer(svg,"pointerup",50,20);
    expect(latest.session!.generation).toBe(generation+1);expect(latest.edit).not.toEqual(before);
    expect(svg.getAttribute("viewBox")).toBe(frame);
    act(()=>button("Undo").click());expect(latest.edit).toEqual(before);
    expect(svg.getAttribute("viewBox")).toBe(frame);expect(button("Redo").disabled).toBe(false);
  };
  moveAndUndo("house");moveAndUndo("p2");
  for(const angle of ["0","90","-53","37"]){
    act(()=>button("House").click());
    const field=mounted!.container.querySelector<HTMLInputElement>('input[aria-label="House rotationDeg"]')!;
    const before=structuredClone(latest.edit!),generation=latest.session!.generation;
    act(()=>{
      const detail=field.closest("details")!;if(!detail.open)detail.querySelector("summary")!.click();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(field,angle);
      field.dispatchEvent(new Event("input",{bubbles:true}));
    });
    expect(latest.edit).toEqual(before);expect(latest.session!.generation).toBe(generation);
    act(()=>field.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})));
    expect(Number(studioHouseScene(latest.edit!.site,latest.edit!.spatial)!.houses[0].position.rotationDeg)).toBe(Number(angle));
    expect(latest.session!.generation).toBe(generation+1);
    moveAndUndo("house");moveAndUndo("p2");
  }
  await flush();
});

it("retains a refused immediate Turn 90 rotation until Discard, then accepts both next grabs",async()=>{
  const initial=fixture(),house=studioHouseScene(initial.site,initial.spatial)!.houses[0];
  const svg=await open("house","facade",updateStudioHouse(initial,{...house,position:{...house.position,rotationDeg:"37"}}));
  const before=structuredClone(latest.edit!),frame=svg.getAttribute("viewBox");
  const field=mounted!.container.querySelector<HTMLInputElement>('input[aria-label="House rotationDeg"]')!;
  mocks.owner.mockReturnValue(null);
  act(()=>{field.closest("details")!.querySelector("summary")!.click();button("Turn 90°").click();});
  expect(mounted!.container.querySelector<HTMLInputElement>('input[aria-label="House rotationDeg"]')!.value).toBe("127");
  expect(latest.edit).toEqual(before);
  expect(latest.edit).toEqual(before);
  expect(mounted!.container.querySelector<HTMLInputElement>('input[aria-label="House rotationDeg"]')!.value).toBe("127");
  expect(mounted!.container.textContent).toContain("Your work is kept");
  mocks.owner.mockReturnValue(scope.actorId);
  for(const id of ["house","p2"]){
    act(()=>button(id==="house"?"House":"Pergola 2").click());
    const target=svg.querySelector(id==="house"?'[aria-label="Select House"]':'[data-selected-product-grab="p2"]')!;
    pointer(target,"pointerdown");pointer(svg,"pointermove",40,20);pointer(svg,"pointerup",50,20);
    expect(latest.edit).not.toEqual(before);expect(svg.querySelector("[data-direct-footprint]")).toBeNull();
    act(()=>button("Undo").click());expect(latest.edit).toEqual(before);
  }
  act(()=>button("Review house changes").click());
  act(()=>button("Discard unfinished input").click());
  expect(latest.edit).toEqual(before);
  for(const id of ["house","p2"]){
    act(()=>button(id==="house"?"House":"Pergola 2").click());
    const target=svg.querySelector(id==="house"?'[aria-label="Select House"]':'[data-selected-product-grab="p2"]')!;
    pointer(target,"pointerdown");expect(svg.getAttribute("data-gesture-phase")).toBe("pressed");
    pointer(svg,"pointermove",40,20);expect(svg.querySelector("[data-direct-footprint]")).toBeTruthy();
    pointer(svg,"pointerup",50,20);expect(latest.edit).not.toEqual(before);
    act(()=>button("Undo").click());expect(latest.edit).toEqual(before);expect(svg.getAttribute("viewBox")).toBe(frame);
  }
  await flush();
});

it("finishes rotation on Enter once across the following blur, with one full Undo", async () => {
  const initial = fixture(), house = studioHouseScene(initial.site, initial.spatial)!.houses[0];
  const before = updateStudioHouse(initial, {...house, position: {...house.position, rotationDeg: "37"}});
  const svg = await open("house", "facade", before), frame = svg.getAttribute("viewBox");
  const field = mounted!.container.querySelector<HTMLInputElement>('input[aria-label="House rotationDeg"]')!;
  act(() => {
    field.closest("details")!.querySelector("summary")!.click();
    field.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "90");
    field.dispatchEvent(new Event("input", {bubbles: true}));
  });
  expect(latest.edit).toEqual(before);
  const live = studioHouseScene(before.site, before.spatial)!.houses[0];
  const expected = updateStudioHouse(before, {...live, position: {...live.position, rotationDeg: "90"}});
  act(() => field.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", bubbles: true, cancelable: true})));
  expect(latest.edit).toEqual(expected);
  expect(latest.session!.generation).toBe(1);
  act(() => field.blur());
  expect(latest.session!.generation).toBe(1);
  expect(mounted!.container.textContent).not.toContain("Apply or discard house changes before moving objects");
  expect(svg.getAttribute("viewBox")).toBe(frame);
  act(() => button("Undo").click());
  expect(latest.edit).toEqual(before);
  expect(button("Undo").disabled).toBe(true);
  await flush();
});

it("finishes rotation on Tab to the adjacent house action without activating it, then accepts the first pergola grab", async () => {
  const initial=fixture(),house=studioHouseScene(initial.site,initial.spatial)!.houses[0];
  const before=updateStudioHouse(initial,{...house,position:{...house.position,rotationDeg:"90"}});
  const svg=await open("house","facade",before),frame=svg.getAttribute("viewBox");
  const field=mounted!.container.querySelector<HTMLInputElement>('input[aria-label="House rotationDeg"]')!;
  act(()=>{
    field.closest("details")!.querySelector("summary")!.click();field.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(field,"37");
    field.dispatchEvent(new Event("input",{bubbles:true}));
  });
  const turn=button("Turn 90°");
  act(()=>{field.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true}));turn.focus();});
  const expected=updateStudioHouse(before,{...studioHouseScene(before.site,before.spatial)!.houses[0],position:{...house.position,rotationDeg:"37"}});
  expect(document.activeElement).toBe(turn);expect(latest.edit).toEqual(expected);expect(latest.session!.generation).toBe(1);
  expect(mounted!.container.textContent).not.toContain("Apply or discard house changes before moving objects");
  pointer(svg.querySelector('[aria-label="Select Pergola 1"]')!,"pointerdown");
  expect(svg.getAttribute("data-gesture-phase")).toBe("pressed");
  pointer(svg,"pointermove",60,-80);pointer(svg,"pointerup",70,-90);
  expect(latest.session!.generation).toBe(2);expect(latest.edit).not.toEqual(expected);
  act(()=>button("Undo").click());expect(latest.edit).toEqual(expected);expect(svg.getAttribute("viewBox")).toBe(frame);expect(button("Redo").disabled).toBe(false);
  await flush();
});

it("finishes a focused rotation before the very first House or pergola pointer-down, then samples release and full Undo", async () => {
  const svg = await open("house"), frame = svg.getAttribute("viewBox");
  for (const [id, angle] of [["house", "37"], ["p2", "0"], ["house", "90"], ["p2", "-53"], ["house", "37"]]) {
    act(() => button("House").click());
    const field = mounted!.container.querySelector<HTMLInputElement>('input[aria-label="House rotationDeg"]')!;
    act(() => {
      const details = field.closest("details")!;
      if (!details.open) details.querySelector("summary")!.click();
      field.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, angle);
      field.dispatchEvent(new Event("input", {bubbles: true}));
    });
    expect(document.activeElement).toBe(field);
    const generation = latest.session!.generation;
    const target = svg.querySelector(id === "house" ? '[aria-label="Select House"]' : '[aria-label="Select Pergola 2"]')!;
    pointer(target, "pointerdown");
    expect(document.activeElement).not.toBe(field);
    expect(svg.getAttribute("data-gesture-phase")).toBe("pressed");
    expect(latest.session!.generation).toBe(generation + 1);
    const afterRotation = structuredClone(latest.edit!);
    expect(studioHouseScene(afterRotation.site, afterRotation.spatial)!.houses[0].position.rotationDeg).toBe(angle);
    pointer(svg, "pointermove", 40, 20);
    expect(svg.querySelector("[data-direct-footprint]")).toBeTruthy();
    pointer(svg, "pointerup", 50, 20);
    expect(latest.session!.generation).toBe(generation + 2);
    expect(latest.edit).not.toEqual(afterRotation);
    expect(svg.getAttribute("viewBox")).toBe(frame);
    act(() => button("Undo").click());
    expect(latest.edit).toEqual(afterRotation);
    expect(button("Redo").disabled).toBe(false);
  }
  await flush();
});

it("finishes house width on leaving the field and accepts the first inactive pergola grab without Apply", async () => {
  const svg = await open("house"), frame = svg.getAttribute("viewBox");
  const width = mounted!.container.querySelector<HTMLInputElement>('input[aria-label="Width (mm)"]')!;
  act(() => width.focus());
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(width, "8300");
    width.dispatchEvent(new Event("input", {bubbles: true}));
  });
  const before = structuredClone(latest.edit!);
  expect(studioHouseScene(before.site, before.spatial)!.houses[0].widthMm).not.toBe("8300");
  pointer(svg.querySelector('[aria-label="Select Pergola 2"]')!, "pointerdown");
  expect(svg.getAttribute("data-gesture-phase")).toBe("pressed");
  expect(studioHouseScene(latest.edit!.site, latest.edit!.spatial)!.houses[0].widthMm).toBe("8300");
  const completed = structuredClone(latest.edit!);
  pointer(svg, "pointermove", 40, 20);
  pointer(svg, "pointerup", 50, 20);
  expect(latest.edit).not.toEqual(completed);
  act(() => button("Undo").click());
  expect(latest.edit).toEqual(completed);
  expect(svg.getAttribute("viewBox")).toBe(frame);
  expect(mounted!.container.textContent).not.toContain("Applied placement");
  await flush();
});

it.each([{raws:["7", "71", "710", "7100"],enter:false}, {raws:["6100", "7100"],enter:true}])("restores one complete pre-field edit after real keystrokes $raws and leaving the field", async ({raws,enter}) => {
  const svg = await open("p2"), before=structuredClone(latest.edit!),frame=svg.getAttribute("viewBox");
  act(()=>button("Design choices").click());
  const field=mounted!.container.querySelector<HTMLInputElement>('input[aria-label="Width in millimetres"]')!;
  act(()=>field.focus());
  for(const raw of raws) act(()=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(field,raw);
    field.dispatchEvent(new Event("input",{bubbles:true}));
  });
  expect(websiteComposition(latest.edit!).find(row=>row.object.id==="p2")!.value!.rawDimensions.widthMm).toBe("7100");
  if(enter)act(()=>field.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})));
  act(()=>field.blur());
  act(()=>button("Undo").click());
  expect(latest.edit).toEqual(before);
  expect(svg.getAttribute("viewBox")).toBe(frame);
  expect(button("Undo").disabled).toBe(true);
  expect(button("Save design").disabled).toBe(true);
  await flush();
});

it("completes the focused house field before the first Save click and sends that exact accepted value", async()=>{
  await open("house");const field=mounted!.container.querySelector<HTMLInputElement>('input[aria-label="Width (mm)"]')!;
  act(()=>{field.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(field,"8300");field.dispatchEvent(new Event("input",{bubbles:true}));});
  const save=button("Save design");expect(save.disabled).toBe(false);
  mocks.api.mockImplementationOnce(async(_url,options)=>{
    const command=JSON.parse(options.body);
    expect(studioHouseScene(command.edit.site,command.edit.spatial)!.houses[0].widthMm).toBe("8300");
    return {receipt:{revision:4,savedAt:"2026-10-23T00:00:00Z",alreadyExisted:false},pricing:"unpriced"};
  });
  pointer(save,"pointerdown");act(()=>save.click());await act(async()=>{await queue;});await flush();
  expect(mocks.api).toHaveBeenCalledOnce();expect(latest.session!.dirty).toBe(false);expect(button("Save design").disabled).toBe(true);
  expect(studioHouseScene(latest.edit!.site,latest.edit!.spatial)!.houses[0].widthMm).toBe("8300");
});

it.each([{invalidWidth:false,reload:true},{invalidWidth:true,reload:false}])("completes a retained Hipped choice by repairing its required pitch, without another confirmation ($invalidWidth/$reload)", async ({invalidWidth,reload})=>{
  let initial=fixture();const house=studioHouseScene(initial.site,initial.spatial)!.houses[0];
  initial=updateStudioHouse(initial,{...house,roof:{...house.roof,form:"flat",pitchDeg:"0"}});
  await open("house","facade",initial);const before=structuredClone(latest.edit!);
  if(invalidWidth)act(()=>{const width=mounted!.container.querySelector<HTMLInputElement>('[aria-label="Width (mm)"]')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(width,"-");width.dispatchEvent(new Event("input",{bubbles:true}));});
  act(()=>button("Hipped").click());
  expect(latest.edit).toEqual(before);expect(button("Hipped").getAttribute("aria-pressed")).toBe("true");
  if(reload){mounted!.unmount();mounted=undefined;await flush();await open("house","facade",before);expect(button("Hipped").getAttribute("aria-pressed")).toBe("true");}
  const pitch=mounted!.container.querySelector<HTMLInputElement>('[aria-label="Roof pitch (degrees)"]')!;
  act(()=>{pitch.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(pitch,"15");pitch.dispatchEvent(new Event("input",{bubbles:true}));pitch.blur();});
  const actual=studioHouseScene(latest.edit!.site,latest.edit!.spatial)!.houses[0];
  expect(actual.roof).toMatchObject({form:"hipped",pitchDeg:"15"});
  expect(actual.widthMm).toBe(house.widthMm);expect(latest.session!.generation).toBe(1);
  if(invalidWidth)expect(mounted!.container.querySelector<HTMLInputElement>('[aria-label="Width (mm)"]')!.value).toBe("-");
  expect(button("Apply house changes")).toBeUndefined();
  act(()=>button("Undo").click());expect(latest.edit).toEqual(before);expect(button("Undo").disabled).toBe(true);
  await flush();
});

it.each(["Discard unfinished input"])("finishes rotation on keyboard focus of %s without activating other raw house changes",async action=>{
  await open("house");const before=structuredClone(latest.edit!);
  const type=(label:string,raw:string)=>act(()=>{const input=mounted!.container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,raw);input.dispatchEvent(new Event("input",{bubbles:true}));});
  type("Width (mm)","8123.");const field=mounted!.container.querySelector<HTMLInputElement>('input[aria-label="House rotationDeg"]')!;
  act(()=>{field.closest("details")!.querySelector("summary")!.click();field.focus();});type("House rotationDeg","37");
  act(()=>button(action).focus());
  const afterRotation=structuredClone(latest.edit!),house=studioHouseScene(afterRotation.site,afterRotation.spatial)!.houses[0];
  expect(house.position.rotationDeg).toBe("37");expect(house.widthMm).toBe(studioHouseScene(before.site,before.spatial)!.houses[0].widthMm);expect(latest.session!.generation).toBe(1);
  expect(mounted!.container.querySelector<HTMLInputElement>('input[aria-label="Width (mm)"]')!.value).toBe("8123.");expect(mounted!.container.textContent).not.toContain("before moving objects");
  act(()=>button("Discard unfinished input").click());expect(latest.edit).toEqual(afterRotation);expect(latest.session!.generation).toBe(1);
  act(()=>button("Undo").click());expect(latest.edit).toEqual(before);await flush();
});

it("finishes only rotation while retaining raw width and roof changes for explicit Apply or Discard", async () => {
  await open("house");
  const before = structuredClone(latest.edit!);
  const type = (label: string, raw: string) => act(() => {
    const field = mounted!.container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, raw);
    field.dispatchEvent(new Event("input", {bubbles: true}));
  });
  type("Width (mm)", "8123.");
  act(() => button("Single slope").click());
  const field = mounted!.container.querySelector<HTMLInputElement>('input[aria-label="House rotationDeg"]')!;
  act(() => { field.closest("details")!.querySelector("summary")!.click(); field.focus(); });
  type("House rotationDeg", "37");
  act(() => field.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", bubbles: true, cancelable: true})));
  const afterRotation = structuredClone(latest.edit!);
  const actual = studioHouseScene(afterRotation.site, afterRotation.spatial)!.houses[0];
  expect(actual.widthMm).toBe(studioHouseScene(before.site, before.spatial)!.houses[0].widthMm);
  expect(actual.roof.form).toBe("mono");
  expect(actual.position.rotationDeg).toBe("37");
  expect(mounted!.container.querySelector<HTMLInputElement>('input[aria-label="Width (mm)"]')!.value).toBe("8123.");
  expect(mounted!.container.textContent).not.toContain("before moving objects");
  act(() => field.blur());
  expect(latest.session!.generation).toBe(2);
  const width=mounted!.container.querySelector<HTMLInputElement>('input[aria-label="Width (mm)"]')!;
  act(()=>width.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})));
  expect(studioHouseScene(latest.edit!.site, latest.edit!.spatial)!.houses[0].widthMm).toBe("8123");
  expect(studioHouseScene(latest.edit!.site, latest.edit!.spatial)!.houses[0].roof.form).toBe("mono");
  act(() => button("Undo").click());
  expect(latest.edit).toEqual(afterRotation);
  await flush();
});

it("treats Turn 90 and explicit Apply or Discard as single actions when the rotation field is focused", async () => {
  await open("house");
  const before = structuredClone(latest.edit!);
  const field = mounted!.container.querySelector<HTMLInputElement>('input[aria-label="House rotationDeg"]')!;
  const type = (label: string, raw: string) => act(() => {
    const input = mounted!.container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, raw);
    input.dispatchEvent(new Event("input", {bubbles: true}));
  });
  act(() => { field.closest("details")!.querySelector("summary")!.click(); field.focus(); });
  type("House rotationDeg", "37");
  expect(pointer(button("Turn 90°"), "pointerdown").defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(field);
  act(() => button("Turn 90°").click());
  expect(studioHouseScene(latest.edit!.site, latest.edit!.spatial)!.houses[0].position.rotationDeg).toBe("127");
  expect(latest.session!.generation).toBe(1);
  act(() => field.blur());
  expect(latest.session!.generation).toBe(1);
  act(() => button("Undo").click());
  expect(latest.edit).toEqual(before);
  for (const action of ["Discard unfinished input"]) {
    type("Width (mm)", "8123");
    type("House rotationDeg", "37");
    act(() => field.focus());
    const generation = latest.session!.generation;
    expect(pointer(button(action), "pointerdown").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(field);
    expect(latest.session!.generation).toBe(generation);
    act(() => button(action).click());
    expect(latest.edit).toEqual(before);
    expect(button("Undo").disabled).toBe(true);
  }
  type("House rotationDeg", "-");
  act(() => { field.focus(); field.blur(); });
  expect(field.value).toBe("-");
  expect(button("Turn 90°").disabled).toBe(true);
  expect(latest.edit).toEqual(before);
  expect(mounted!.container.textContent).toContain("Enter a valid house rotation");
  await flush();
});

it("uses current revision and acknowledged deletion bookkeeping when a save settles during held movement", async () => {
  const svg = await open();
  act(() => {
    const edit = structuredClone(latest.edit!);
    edit.site.access = "hard";
    edit.deletions = [
      { scope: "site", collection: "blinds.items", ids: ["retired"] },
    ];
    latest.change(edit);
  });
  await flush();
  let confirm!: (result: unknown) => void;
  mocks.api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        confirm = resolve;
      }),
  );
  let saving!: Promise<void>;
  await act(async () => {
    saving = latest.save();
  });
  const generation = latest.session!.generation;
  pointer(grab(svg), "pointerdown");
  pointer(svg, "pointermove", 50, 70);
  await act(async () => {
    confirm({
      receipt: {
        revision: 4,
        savedAt: "2026-10-21T01:00:00Z",
        alreadyExisted: false,
      },
      pricing: "unpriced",
    });
    await saving;
  });
  expect(latest.session!.generation).toBe(generation);
  expect(latest.edit!.revision).toBe(4);
  expect(latest.edit!.deletions).toEqual([]);
  expect(svg.querySelector("[data-direct-footprint]")).toBeTruthy();
  pointer(svg, "pointerup", 60, 80);
  expect(latest.edit!.revision).toBe(4);
  expect(latest.edit!.deletions).toEqual([]);
  act(() => button("Undo").click());
  expect(latest.edit!.revision).toBe(4);
  expect(latest.edit!.deletions).toEqual([]);
  await flush();
});

it("refuses stale authority before constructing an edit, and a genuine authored edit cancels the active gesture", async () => {
  const svg = await open(),
    start = pose();
  pointer(grab(svg), "pointerdown");
  pointer(svg, "pointermove", 50, 70);
  mocks.owner.mockReturnValue(null);
  pointer(svg, "pointerup", 60, 80);
  expect(latest.session!.generation).toBe(0);
  expect(pose()).toEqual(start);
  expect(mounted!.container.textContent).not.toContain("Placement applied.");
  expect(button("Undo").disabled).toBe(true);
  mocks.owner.mockReturnValue(scope.actorId);
  pointer(grab(svg), "pointerdown");
  pointer(svg, "pointermove", 50, 70);
  act(() => {
    const edit = structuredClone(latest.edit!);
    edit.site.access = "easy";
    latest.change(edit);
  });
  expect(svg.querySelector("[data-direct-footprint]")).toBeNull();
  pointer(svg, "pointerup", 60, 80);
  expect(pose()).toEqual(start);
  expect(latest.session!.generation).toBe(1);
  await flush();
});

it("keeps acknowledged deletion/copy operations retired when Undo follows an accepted move and normal save", async () => {
  const svg = await open();
  act(() => {
    const copied = applyStudioPergolaEdit(
      latest.edit!,
      {
        kind: "duplicate",
        pergolaId: "p2",
        id: "p3",
        rowIds: { flashings: {}, infills: {} },
      },
      {
        persistedObjectIds: ["p1", "p2"],
        baselineObjectOptions: latest.session!.baselineObjectOptions,
      },
    );
    if (!copied.ok) throw Error(copied.message);
    copied.edit.deletions = [
      { scope: "site", collection: "blinds.items", ids: ["retired"] },
    ];
    latest.change(copied.edit);
  });
  await flush();
  const before = pose();
  pointer(grab(svg), "pointerdown");
  pointer(svg, "pointermove", 2000, 3000);
  pointer(svg, "pointerup", 2010, 3010);
  expect(latest.edit!.duplications).toHaveLength(1);
  await flush();
  mocks.api.mockResolvedValueOnce({
    receipt: {
      revision: 4,
      savedAt: "2026-10-21T01:00:00Z",
      alreadyExisted: false,
    },
    pricing: "unpriced",
  });
  await act(async () => {
    await latest.save();
  });
  expect(latest.edit!.deletions).toEqual([]);
  expect(latest.edit!.duplications).toEqual([]);
  expect(button("Undo").disabled).toBe(false);
  mocks.owner.mockReturnValue(null);
  act(() => button("Undo").click());
  expect(button("Undo").disabled).toBe(false);
  expect(pose()).not.toEqual(before);
  mocks.owner.mockReturnValue(scope.actorId);
  act(() => button("Undo").click());
  expect(pose()).toEqual(before);
  expect(latest.edit!.revision).toBe(4);
  expect(latest.edit!.deletions).toEqual([]);
  expect(latest.edit!.duplications).toEqual([]);
  expect(latest.edit!.spatial.pergolas.map((p) => p.id)).toEqual([
    "p1",
    "p2",
    "p3",
  ]);
  await flush();
});

it.each(["pointercancel", "lostpointercapture", "view"] as const)(
  "cancels exactly once through %s without a commit",
  async (kind) => {
    const svg = await open(),
      before = structuredClone(latest.edit!);
    pointer(grab(svg), "pointerdown");
    pointer(svg, "pointermove", 50, 70);
    if (kind === "view") act(() => button("3D").click());
    else pointer(svg, kind, 50, 70);
    expect(
      mounted!.container.querySelector("[data-direct-footprint]"),
    ).toBeNull();
    pointer(svg, "pointerup", 60, 80);
    expect(latest.session!.generation).toBe(0);
    expect(latest.edit).toEqual(before);
    expect(button("Undo").disabled).toBe(true);
    await flush();
  },
);

it("keeps an inactive first grab through real selection from a different-method product", async () => {
  const svg = await open("p1", "soffit"),
    before = structuredClone(latest.edit!),
    start = pose();
  const product = svg.querySelector('[aria-label="Select Pergola 2"]')!;
  pointer(product, "pointerdown");
  expect(product.isConnected).toBe(false);
  expect(svg.querySelector("[data-direct-footprint]")).toBeNull();
  pointer(svg, "pointermove", 50, 70);
  expect(svg.querySelector("[data-direct-footprint]")).toBeTruthy();
  pointer(svg, "pointerup", 60, 80);
  expect(pose()).toMatchObject({ x: start.x + 50, y: start.y - 60 });
  expect(websiteComposition(latest.edit!)[0].studioAttachment!.method).toBe(
    "soffit",
  );
  act(() => button("Undo").click());
  expect(latest.edit!.spatial).toEqual(before.spatial);
  expect(latest.edit!.site).toEqual(before.site);
  expect(latest.edit!.objectOptions).toEqual(before.objectOptions);
  await flush();
});

it.each(["cold", "warm"] as const)(
  "keeps a valid peer movable and invalid-house repair controls working from a %s scene",
  async (mode) => {
    const original = fixture("soffit"),
      invalid = structuredClone(original);
    invalid.spatial.houseAssembly!.houseForms[0].wallHeightM = "bad";
    let svg = await open("p2", "facade", mode === "cold" ? invalid : original);
    if (mode === "warm") {
      act(() => {
        latest.change(invalid);
      });
      await flush();
    }
    expect(latest.edit!.spatial.houseAssembly!.houseForms[0].wallHeightM).toBe(
      "bad",
    );
    expect(svg.querySelector('[aria-label="Select House"]')).toBeNull();
    function connectionDetails(node: any): number {
      if (Array.isArray(node))
        return node.reduce(
          (count, child) => count + connectionDetails(child),
          0,
        );
      if (!node || typeof node !== "object") return 0;
      return (
        (node.type?.name === "WebsiteConnectionDetail" ? 1 : 0) +
        connectionDetails(node.props?.children)
      );
    }
    // Hidden 3D is deferred; reveal must consume the current invalid scene.
    act(() => button("3D").click());
    expect(connectionDetails(webgl.children)).toBe(0);
    act(() => button("Plan").click());
    svg = mounted!.container.querySelector<SVGSVGElement>(
      'svg[aria-label="Studio design Plan"]',
    )!;
    const start = pose();
    pointer(grab(svg), "pointerdown");
    pointer(svg, "pointermove", 2010, 2020);
    expect(svg.querySelector("[data-direct-footprint]")).toBeTruthy();
    pointer(svg, "pointerup", 2010, 2020);
    expect(pose()).not.toEqual(start);
    expect(latest.edit!.spatial.houseAssembly!.houseForms[0].wallHeightM).toBe(
      "bad",
    );
    act(() => button("Undo").click());
    expect(pose()).toEqual(start);
    act(() => button("House").click());
    const field = mounted!.container.querySelector<HTMLInputElement>(
      'input[aria-label="Wall height (mm)"]',
    )!;
    expect(field.value).toBe("bad");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(mounted!.container.textContent).toContain(
      "Enter a valid wall height. Your input is kept.",
    );
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(field, "3200");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(()=>field.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})));
    expect(latest.edit!.spatial.houseAssembly!.houseForms[0].wallHeightM).toBe(
      "3.2",
    );
    expect(svg.querySelector('[aria-label="Select House"]')).toBeTruthy();
    expect(websiteComposition(latest.edit!).every((row) => !row.error)).toBe(
      true,
    );
    expect(pose()).toEqual(start);
    act(() => button("3D").click());
    expect(connectionDetails(webgl.children)).toBe(1);
    await flush();
  },
);

it("moves a host-only canonical attachment from its resolved pose through canonical detach and restores with Undo", async () => {
  let edit = fixture();
  delete edit.site.websiteAttachments;
  const house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
  edit = updateStudioHouse(edit, {
    ...house,
    position: { xMm: "1000", yMm: "2000", rotationDeg: "0" },
  });
  const svg = await open("p1", "facade", edit),
    start = websiteComposition(latest.edit!)[0].position!;
  expect(start).toMatchObject({ x: 1000, y: 6000, rotation: 0 });
  const grab = svg.querySelector('[data-selected-product-grab="p1"]')!;
  pointer(grab, "pointerdown");
  pointer(svg, "pointermove", 20010, 20020);
  expect(svg.querySelector("[data-direct-footprint]")).toBeTruthy();
  pointer(svg, "pointerup", 20010, 20020);
  const moved = websiteComposition(latest.edit!)[0];
  expect(moved.object.attachment!.host).toBeNull();
  expect(moved.position).toMatchObject({
    x: start.x + 20000,
    y: start.y - 20000,
  });
  expect(moved.error).toBeNull();
  expect(latest.edit!.site.websiteAttachments).toEqual(
    edit.site.websiteAttachments,
  );
  act(() => button("Undo").click());
  expect(websiteComposition(latest.edit!)[0].position).toEqual(start);
  expect(latest.edit!.spatial.pergolas[0].attachment!.host).toEqual(
    edit.spatial.pergolas[0].attachment!.host,
  );
  await flush();
});

it("commits the exact final screen delta through a transient layout/CTM change and retains full Undo", async () => {
  const svg = await open(),
    original = structuredClone(latest.edit!),
    start = pose();
  let inverse = { a: 14.194, b: 0, c: 0, d: 14.194, e: -10643, f: -11596 };
  Object.defineProperty(svg, "getScreenCTM", {
    configurable: true,
    value: () => ({ inverse: () => inverse }),
  });
  pointer(grab(svg), "pointerdown", 1450, 450);
  pointer(svg, "pointermove", 1490, 450);
  const preview = svg
    .querySelector("[data-direct-footprint] polygon:nth-child(2)")!
    .getAttribute("points");
  inverse = { a: 14.187, b: 0, c: 0, d: 14.187, e: -10636, f: -11580 };
  pointer(svg, "pointerup", 1490, 450);
  expect(pose().x).toBeCloseTo(start.x + 40 * 14.194, 8);
  expect(pose().y).toBeCloseTo(start.y, 8);
  expect(latest.session!.generation).toBe(1);
  expect(preview).toBeTruthy();
  act(() => button("Undo").click());
  expect(latest.edit!.spatial).toEqual(original.spatial);
  pointer(grab(svg), "pointerdown", 1450, 450);
  pointer(svg, "pointermove", 1490, 450);
  inverse = { ...inverse, e: -10000, f: -11000 };
  pointer(svg, "pointerup", 1500, 460);
  expect(pose().x).toBeCloseTo(start.x + 50 * 14.187, 8);
  expect(pose().y).toBeCloseTo(start.y - 10 * 14.187, 8);
  act(() => button("Undo").click());
  expect(latest.edit!.spatial).toEqual(original.spatial);
  await flush();
});

it("retires a held gesture when real method choices complete A to B and back to A without Apply", async () => {
  const svg = await open("p1", "soffit"),
    original = structuredClone(latest.edit!);
  act(() => button("Change connection").click());
  act(() => button("Fascia").click());
  const first=structuredClone(latest.edit!);
  act(() => button("Change connection").click());
  const grab = () => svg.querySelector('[data-selected-product-grab="p1"]')!;
  pointer(grab(), "pointerdown");
  pointer(svg, "pointermove", 50, 70);
  expect(svg.querySelector("[data-direct-footprint]")).toBeTruthy();
  act(() => button("Soffit brackets").click());
  expect(svg.querySelector("[data-direct-footprint]")).toBeNull();
  act(() => button("Change connection").click());
  act(() => button("Fascia").click());
  const completed=structuredClone(latest.edit!);
  pointer(svg, "pointerup", 60, 80);
  expect(latest.edit).toEqual(completed);
  expect(latest.edit!.spatial).toEqual(first.spatial);
  expect(latest.edit!.objectOptions).toEqual(first.objectOptions);
  expect(latest.session!.generation).toBe(3);
  expect(original).not.toEqual(completed);
  // The current A proposal remains movable and can be cancelled without
  // allowing the first A gesture to acquire authority again.
  pointer(grab(), "pointerdown");
  pointer(svg, "pointermove", 50, 70);
  expect(svg.querySelector("[data-direct-footprint]")).toBeTruthy();
  act(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(latest.session!.generation).toBe(3);
  expect(button("Apply connection")).toBeUndefined();
  await flush();
});

it("commits an interior along position using exact final-up support once and restores the whole relationship with Undo", async () => {
  const initial = previewStudioAttachment(
    { ...studioAttachmentFixture(90), designId: scope.designId },
    {
      objectId: "p2",
      houseId: "house",
      edge: "right",
      kind: "wall",
      method: "facade",
    },
  );
  const svg = await open("p2", "facade", initial),
    original = structuredClone(latest.edit!),
    start = pose();
  await act(async () => workers.at(-1)!.reply());
  const mainSolve = vi.spyOn(preparation, "prepareStudioPlacement");
  pointer(grab(svg), "pointerdown", 10, 20);
  pointer(svg, "pointermove", 810, 20);
  expect(latest.session!.generation).toBe(0);
  expect(mounted!.container.textContent).toContain("Release to connect");
  // Final-up is a distinct interior position, not the last move sample.
  pointer(svg, "pointerup", 935, 20);
  expect(mainSolve).not.toHaveBeenCalled();
  mainSolve.mockRestore();
  expect(latest.session!.generation).toBe(1);
  const row = websiteComposition(latest.edit!)[0];
  expect(row.geometryOptions!.supportDatumMm).toBe(2833);
  expect(row.position!.x).toBeCloseTo(start.x + 925, 7);
  expect(row.position!.y).toBeCloseTo(start.y, 7);
  expect(row.studioAttachment!.alongEdgeMm).toBeCloseTo(925, 7);
  expect(row.error).toBeNull();
  act(() => button("Undo").click());
  expect(latest.edit!.spatial).toEqual(original.spatial);
  expect(latest.edit!.site).toEqual(original.site);
  expect(latest.edit!.objectOptions).toEqual(original.objectOptions);
  expect(
    websiteComposition(latest.edit!)[0].geometryOptions!.supportDatumMm,
  ).toBe(2677);
  await flush();
});

it("keeps a controlled exact-variant eviction unresolved through a distinct final-up, rejects the stale refill, and commits only the matching refill", async () => {
  const initial = previewStudioAttachment(
    { ...studioAttachmentFixture(90), designId: scope.designId },
    {
      objectId: "p2",
      houseId: "house",
      edge: "right",
      kind: "wall",
      method: "facade",
    },
  );
  const svg = await open("p2", "facade", initial),
    original = structuredClone(latest.edit!);
  const first = workers.at(-1)!,
    reply = studioPreparationReply(first.request);
  if (reply.result.kind !== "ready") throw Error(reply.result.reason);
  // Controlled eviction exercises a real missing physical artifact. It does not
  // estimate natural miss frequency or replace any canonical result.
  reply.result.value.variants = reply.result.value.variants.filter(
    (v) => v.datum !== 2833,
  );
  await act(async () =>
    first.onmessage!({ data: structuredClone(reply) } as MessageEvent),
  );
  pointer(grab(svg), "pointerdown", 10, 20);
  pointer(svg, "pointermove", 810, 20);
  expect(latest.session!.generation).toBe(0);
  expect(mounted!.container.textContent).toContain(
    "Preparing the exact physical connection.",
  );
  expect(
    svg
      .querySelector("[data-direct-footprint] polygon:nth-child(2)")
      ?.getAttribute("points"),
  ).toBe("");
  const obsolete = workers.at(-1)!,
    oldRequest = obsolete.request,
    oldHandler = obsolete.onmessage!;
  expect(oldRequest.task.requestedDatums).toContain(2833);
  pointer(svg, "pointerup", 935, 20);
  expect(latest.session!.generation).toBe(0);
  expect(latest.edit!.spatial).toEqual(original.spatial);
  pointer(svg, "lostpointercapture", 935, 20);
  pointer(svg, "pointerup", 1100, 30);
  const finalWorker = workers.at(-1)!,
    finalRequest = finalWorker.request;
  expect(finalRequest.task.dependencyKey).not.toBe(
    oldRequest.task.dependencyKey,
  );
  expect(obsolete.terminated).toBe(true);
  await act(async () =>
    oldHandler({ data: studioPreparationReply(oldRequest) } as MessageEvent),
  );
  expect(latest.session!.generation).toBe(0);
  const began = performance.now();
  await act(async () => finalWorker.reply());
  const elapsed = performance.now() - began;
  expect(latest.session!.generation).toBe(1);
  expect(
    websiteComposition(latest.edit!)[0].geometryOptions!.supportDatumMm,
  ).toBe(2833);
  expect(
    websiteComposition(latest.edit!)[0].studioAttachment!.alongEdgeMm,
  ).toBeCloseTo(925, 7);
  console.info(
    "Controlled-eviction synchronous test-worker refill to session commit ms",
    elapsed,
  );
  await act(async () =>
    finalWorker.onmessage?.({
      data: studioPreparationReply(finalRequest),
    } as MessageEvent),
  );
  pointer(svg, "pointerup", 1200, 80);
  expect(latest.session!.generation).toBe(1);
  act(() => button("Undo").click());
  expect(latest.edit!.spatial).toEqual(original.spatial);
  expect(latest.edit!.site).toEqual(original.site);
  await flush();
});

it.each([
  "Escape",
  "new gesture",
  "new identity",
  "view",
  "manual camera",
  "pending replacement",
  "worker failure",
] as const)(
  "cannot apply a released controlled-eviction refill after %s",
  async (reason) => {
    const initial = previewStudioAttachment(
      { ...studioAttachmentFixture(90), designId: scope.designId },
      {
        objectId: "p2",
        houseId: "house",
        edge: "right",
        kind: "wall",
        method: "facade",
      },
    );
    const svg = await open("p2", "facade", initial),
      first = workers.at(-1)!,
      reply = studioPreparationReply(first.request);
    if (reply.result.kind !== "ready") throw Error(reply.result.reason);
    reply.result.value.variants = reply.result.value.variants.filter(
      (v) => v.datum !== 2833,
    );
    await act(async () =>
      first.onmessage!({ data: structuredClone(reply) } as MessageEvent),
    );
    pointer(grab(svg), "pointerdown", 10, 20);
    pointer(svg, "pointermove", 810, 20);
    pointer(svg, "pointerup", 935, 20);
    expect(latest.session!.generation).toBe(0);
    const waiting = workers.at(-1)!,
      request = waiting.request,
      handler = waiting.onmessage!;
    if (reason === "Escape")
      act(() =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
      );
    else if (reason === "new gesture") {
      pointer(grab(svg), "pointerdown", 10, 20);
      pointer(svg, "pointermove", 10010, 10020);
      pointer(svg, "pointerup", 10010, 10020);
      expect(latest.session!.generation).toBe(1);
    } else if (reason === "pending replacement") {
      act(() => button("Change connection").click());
      act(() => button("Fascia").click());
      act(() => button("Wall").click());
    } else if (reason === "worker failure")
      act(() => waiting.onerror?.({} as ErrorEvent));
    else if (reason === "view") act(() => button("3D").click());
    else if (reason === "manual camera")
      act(() =>
        mounted!.container
          .querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!
          .click(),
      );
    else
      act(() =>
        latest.change({
          ...latest.edit!,
          site: { ...latest.edit!.site, access: "hard" },
        }),
      );
    const newer = structuredClone(latest.edit!),
      generation = latest.session!.generation;
    await act(async () =>
      handler({ data: studioPreparationReply(request) } as MessageEvent),
    );
    expect(latest.session!.generation).toBe(generation);
    expect(latest.edit).toEqual(newer);
    expect(
      mounted!.container.querySelector("[data-direct-footprint]"),
    ).toBeNull();
    if (reason === "view") {
      act(() => button("Plan").click());
      expect(
        mounted!.container.querySelector("[data-direct-footprint]"),
      ).toBeNull();
    }
    await flush();
  },
);
it.each([false, true])(
  "detaches a small canonical outward departure with full Undo, host only=%s",
  async (hostOnly) => {
    const initial = previewStudioAttachment(
      { ...studioAttachmentFixture(450), designId: scope.designId },
      {
        objectId: "p2",
        houseId: "house",
        edge: "rear",
        kind: "wall",
        method: "facade",
      },
    );
    if (hostOnly) delete initial.site.websiteAttachments;
    const svg = await open("p2", "facade", initial),
      original = structuredClone(latest.edit!),
      start = pose();
    await act(async () => workers.at(-1)!.reply());
    pointer(grab(svg), "pointerdown", 10, 20);
    pointer(svg, "pointermove", 5, 20);
    pointer(svg, "pointerup", 5, 20);
    const moved = websiteComposition(latest.edit!)[0];
    expect(latest.session!.generation).toBe(1);
    expect(moved.object.attachment!.host).toBeNull();
    expect(moved.position!.x).toBeCloseTo(start.x - 5, 7);
    expect(moved.position!.y).toBeCloseTo(start.y, 7);
    act(() => button("Undo").click());
    expect(latest.edit!.spatial).toEqual(original.spatial);
    expect(latest.edit!.site).toEqual(original.site);
    expect(latest.edit!.objectOptions).toEqual(original.objectOptions);
    await flush();
  },
);

it.each([37, 0])(
  "connects translated37degree finite wall alignment through Plan at product%s without rotation, binding or refit",
  async (rotation) => {
    const f = studioAlignmentFixture(37, rotation),
      initial = { ...f.edit, designId: scope.designId },
      svg = await open("p2", "facade", initial),
      original = structuredClone(latest.edit!),
      start = pose(),
      frame = svg.getAttribute("viewBox");
    const delta = (t: number) => ({
      x: f.normal.x * 40 + f.tangent.x * t,
      y: f.normal.y * 40 + f.tangent.y * t,
    });
    pointer(grab(svg), "pointerdown", 10, 20);
    const held = delta(100);
    pointer(svg, "pointermove", 10 + held.x, 20 - held.y);
    const guide = svg.querySelector("[data-witness-kind]");
    expect(guide?.getAttribute("data-witness-kind")).toBe(
      rotation === 37 ? "edge" : "vertex",
    );
    expect(mounted!.container.textContent).toContain(
      rotation === 37 ? "Edge aligned" : "Corner aligned",
    );
    expect(latest.session!.generation).toBe(0);
    const final = delta(125);
    pointer(svg, "pointerup", 10 + final.x, 20 - final.y);
    const row = websiteComposition(latest.edit!)[0];
    expect(row.position!.rotation).toBe(rotation);
    expect(row.object.attachment?.host ?? null).toBeNull();
    expect(row.studioAttachment).toBeNull();
    const travel = {
      x: row.position!.x - start.x,
      y: row.position!.y - start.y,
    };
    expect(travel.x * f.tangent.x + travel.y * f.tangent.y).toBeCloseTo(125, 7);
    expect(travel.x * f.normal.x + travel.y * f.normal.y).toBeCloseTo(50, 7);
    expect(svg.getAttribute("viewBox")).toBe(frame);
    expect(latest.session!.generation).toBe(1);
    act(() => button("Undo").click());
    expect(latest.edit!.spatial).toEqual(original.spatial);
    expect(latest.edit!.site).toEqual(original.site);
    expect(latest.edit!.objectOptions).toEqual(original.objectOptions);
    await flush();
  },
);

it.each([
  [37, "front", "flat", 4000],
  [0, "front", "flat", 4000],
  [37, "left", "mono", 9500],
] as const)(
  "applies a warm structurally refused but alignable wall without binding: product%s/%s/%s",
  async (rotation, side, form, width) => {
    const f = studioAlignmentFixture(37, rotation, side, form, 50, width);
    const svg = await open("p2", "facade", {
      ...f.edit,
      designId: scope.designId,
    });
    const original = structuredClone(latest.edit!),
      start = pose(),
      frame = svg.getAttribute("viewBox");
    expect(workers.at(-1)!.request.task.method).toBe("facade");
    await act(async () => workers.at(-1)!.reply());
    pointer(grab(svg), "pointerdown", 10, 20);
    const delta = (t: number) => ({
      x: f.normal.x * 40 + f.tangent.x * t,
      y: f.normal.y * 40 + f.tangent.y * t,
    });
    const held = delta(100);
    pointer(svg, "pointermove", 10 + held.x, 20 - held.y);
    expect(
      svg
        .querySelector("[data-witness-kind]")
        ?.getAttribute("data-witness-kind"),
    ).toBe(rotation === 0 ? "vertex" : "edge");
    expect(mounted!.container.textContent).toContain("not connected");
    const final = delta(125);
    pointer(svg, "pointerup", 10 + final.x, 20 - final.y);
    const row = websiteComposition(latest.edit!)[0];
    expect(row.position!.rotation).toBe(rotation);
    expect(row.object.attachment?.host ?? null).toBeNull();
    expect(row.studioAttachment).toBeNull();
    const travel = {
      x: row.position!.x - start.x,
      y: row.position!.y - start.y,
    };
    expect(travel.x * f.tangent.x + travel.y * f.tangent.y).toBeCloseTo(125, 7);
    expect(travel.x * f.normal.x + travel.y * f.normal.y).toBeCloseTo(50, 7);
    expect(svg.getAttribute("viewBox")).toBe(frame);
    expect(latest.session!.generation).toBe(1);
    act(() => button("Undo").click());
    expect(latest.edit!.spatial).toEqual(original.spatial);
    expect(latest.edit!.site).toEqual(original.site);
    expect(latest.edit!.objectOptions).toEqual(original.objectOptions);
    await flush();
  },
);

it("retains the held finite witness across a cold-to-warm preparation reply, with exact distinct final-up and Undo", async () => {
  const f = studioAlignmentFixture(37, 0),
    svg = await open("p2", "facade", { ...f.edit, designId: scope.designId });
  const original = structuredClone(latest.edit!),
    start = pose(),
    frame = svg.getAttribute("viewBox");
  pointer(grab(svg), "pointerdown", 10, 20);
  const delta = (t: number) => ({
    x: f.normal.x * 40 + f.tangent.x * t,
    y: f.normal.y * 40 + f.tangent.y * t,
  });
  const held = delta(100);
  pointer(svg, "pointermove", 10 + held.x, 20 - held.y);
  expect(mounted!.container.textContent).toContain("Corner aligned");
  const coldPoints = svg
    .querySelector("[data-direct-footprint] polygon:nth-child(2)")
    ?.getAttribute("points");
  expect(latest.session!.generation).toBe(0);
  const worker = workers.at(-1)!;
  expect(worker.request.task.method).toBe("facade");
  const reply = studioPreparationReply(worker.request);
  expect(reply.result.kind).toBe("ready");
  if (reply.result.kind !== "ready") throw Error(reply.result.reason);
  expect(
    reply.result.value.candidates.some((c) => c.target.side === "front"),
  ).toBe(true);
  // No extra native move: current three-pixel witness bias retains the
  // positional corner, even with a newly available structural candidate.
  await act(async () => worker.onmessage!({ data: reply } as MessageEvent));
  expect(mounted!.container.textContent).toContain("Corner aligned");
  expect(mounted!.container.textContent).not.toContain("Release to connect");
  expect(
    svg
      .querySelector("[data-direct-footprint] polygon:nth-child(2)")
      ?.getAttribute("points"),
  ).toBe(coldPoints);
  expect(latest.session!.generation).toBe(0);
  const final = delta(125);
  pointer(svg, "pointerup", 10 + final.x, 20 - final.y);
  expect(latest.session!.generation).toBe(1);
  const row = websiteComposition(latest.edit!)[0];
  expect(row.object.attachment?.host ?? null).toBeNull();
  expect(row.studioAttachment).toBeNull();
  expect(row.position!.rotation).toBe(0);
  const travel = { x: row.position!.x - start.x, y: row.position!.y - start.y };
  expect(travel.x * f.tangent.x + travel.y * f.tangent.y).toBeCloseTo(125, 7);
  expect(travel.x * f.normal.x + travel.y * f.normal.y).toBeCloseTo(50, 7);
  expect(svg.getAttribute("viewBox")).toBe(frame);
  act(() => button("Undo").click());
  expect(latest.edit!.spatial).toEqual(original.spatial);
  expect(latest.edit!.site).toEqual(original.site);
  expect(latest.edit!.objectOptions).toEqual(original.objectOptions);
  await flush();
});

it("commits the fully warm ordinary rotated wall offer at distinct final-up and restores the whole edit with one Undo", async () => {
  const f = studioWallAcquisitionFixture(37, "right");
  sessionStorage.setItem(`${studioHouseContextKey(scope)}:camera:plan`, JSON.stringify({ x: 0, y: 0, units: f.units }));
  const svg = await open("p2", "facade", { ...f.edit, designId: scope.designId }),
    original = structuredClone(latest.edit!);
  expect(workers.at(-1)!.request.task.method).toBe("facade");
  await act(async () => workers.at(-1)!.reply());
  const solve = vi.spyOn(preparation, "prepareStudioPlacement"),
    viewBox = svg.getAttribute("viewBox");
  pointer(grab(svg), "pointerdown", 10, 20);
  pointer(svg, "pointermove", 10 + f.delta.x * 0.8 / 6 + 1e-9, 20 - f.delta.y * 0.8 / 6);
  expect(mounted!.container.textContent).toContain("Release to connect");
  pointer(svg, "pointermove", 10 + f.delta.x * 0.8, 20 - f.delta.y * 0.8);
  expect(latest.session!.generation).toBe(0);
  pointer(svg, "pointerup", 10 + f.delta.x, 20 - f.delta.y);
  expect(solve).not.toHaveBeenCalled();
  solve.mockRestore();
  expect(latest.session!.generation).toBe(1);
  const row = websiteComposition(latest.edit!)[0];
  expect(row.error).toBeNull();
  expect(row.studioAttachment?.edge).toBe("right");
  expect(row.position!.rotation).toBe(-53);
  expect(row.geometryOptions!.supportDatumMm).toBe(2580);
  expect(row.value!.facadeClearanceMm).toBe("200");
  const expected = previewStudioAttachment(original, {...row.studioAttachment!,facadeClearanceMm:row.value!.facadeClearanceMm});
  expect(latest.edit!.spatial).toEqual(expected.spatial);
  expect(latest.edit!.objectOptions).toEqual(expected.objectOptions);
  expect(svg.getAttribute("viewBox")).toBe(viewBox);
  act(() => button("Undo").click());
  expect(latest.edit!.spatial).toEqual(original.spatial);
  expect(latest.edit!.site).toEqual(original.site);
  expect(latest.edit!.objectOptions).toEqual(original.objectOptions);
  expect(latest.edit!.deletions).toEqual(original.deletions);
  expect(button("Undo").disabled).toBe(true);
  expect(svg.getAttribute("viewBox")).toBe(viewBox);
  await flush();
});

it("retains the real Workspace product task and authored edit through a House orbit, then selects the house on a deliberate click", async () => {
  webgl.events = true;
  await open();
  act(() => button("3D").click());
  const original = structuredClone(latest.edit!),
    surface = mounted!.container.querySelector("[data-studio-renderer-source]")!;
  const walk = (node: any): any[] => Array.isArray(node) ? node.flatMap(walk) : !node || typeof node !== "object" ? [] : [node, ...walk(node.props?.children)];
  const house = walk(webgl.children).find((node) => node.type?.name === "StudioHouseNode");
  surface.addEventListener("click", () => house.props.onSelect());
  const clickModel = (x: number, y: number) => act(() => surface.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1, clientX: x, clientY: y })));
  pointer(surface, "pointerdown", 500, 450);
  pointer(surface, "pointermove", 620, 414);
  pointer(surface, "pointerup", 620, 414);
  clickModel(620, 414);
  expect(JSON.parse(sessionStorage.getItem(studioHouseContextKey(scope))!).selected).toBe("p2");
  expect(latest.edit).toEqual(original);
  expect(latest.session!.generation).toBe(0);
  expect(button("Undo").disabled).toBe(true);
  pointer(surface, "pointerdown", 500, 450);
  pointer(surface, "pointerup", 500, 450);
  clickModel(500, 450);
  expect(JSON.parse(sessionStorage.getItem(studioHouseContextKey(scope))!).selected).toBe("house");
  expect(latest.edit).toEqual(original);
  expect(button("Undo").disabled).toBe(true);
  await flush();
});

it("keeps visible catalogue choices through the real session, complete move Undo, save acknowledgement, reload and canonical quote selections", async () => {
  commercialFields = true;
  const config = { ...loadCostingConfigV1(), accessoryRates: structuredClone(ACCESSORY_REVIEW_RATES) },
    originalFetch = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn((url, options) => String(url) === "/api/staff/costing/v1/aluminium-catalogue"
    ? Promise.resolve({ ok: true, json: async () => ({ items: buildAdditionalAluminiumCatalogue(config) }) })
    : originalFetch(url, options)));
  const svg = await open("p2", "facade", { ...studioWallAcquisitionFixture(0, "front").edit, designId: scope.designId });
  act(() => button("Add aluminium").click()); await flush();
  const field = (label: string) => [...mounted!.container.querySelectorAll("label")].find((node) => node.firstChild?.textContent === label)!.querySelector<HTMLSelectElement>("select")!;
  const choose = (label: string, value: string) => act(() => { const control = field(label); control.value = value; control.dispatchEvent(new Event("change", { bubbles: true })); });
  choose("Additional aluminium finish", "White");
  choose("Profile", "150x50");
  choose("Stock length (m)", "6");
  const entered = structuredClone(latest.edit!), price = calculateStudioCommercialPricing(entered, config);
  expect(price.siteInputs.additional_aluminium).toMatchObject({ extrusion_colour: "White", rows: [{ profile: "150x50", stock_length_m: 6, quantity: 1 }] });
  pointer(grab(svg), "pointerdown", 10, 20);
  pointer(svg, "pointermove", 50, 70);
  pointer(svg, "pointerup", 60, 80);
  act(() => button("Undo").click());
  expect(latest.edit!.spatial).toEqual(entered.spatial);
  expect(latest.edit!.site).toEqual(entered.site);
  await act(async () => { await queue; });
  mocks.api.mockResolvedValueOnce({ receipt: { revision: entered.revision + 1, savedAt: "2026-10-21T02:00:00Z", alreadyExisted: false }, pricing: "unpriced" });
  await act(async () => { await latest.save(); });
  const saved = structuredClone(latest.edit!);
  expect(saved.revision).toBe(entered.revision + 1);
  expect(saved.site).toEqual(entered.site);
  mounted!.unmount(); mounted = undefined; await flush();
  await open("p2", "facade", saved, "2026-10-21T02:00:00Z");
  expect(latest.status).toBe("ready");
  expect(latest.edit!.site).toEqual(entered.site);
  expect(field("Profile").value).toBe("150x50");
  expect(field("Stock length (m)").value).toBe("6");
  const restored = calculateStudioCommercialPricing(latest.edit!, config);
  expect(restored.amount).toBe(price.amount);
  expect(restored.customerStandaloneSelections).toContainEqual({ label: "Standalone aluminium · 150x50", details: ["White aluminium", "1 full 6 m bar"] });
  expect(latest.session!.dirty).toBe(false);
  await flush();
});

it.each(["p2", "p1", "house"])("restores initially saved full authoring and clean heading/Save state after %s movement and Undo", async (selected) => {
  const svg = await open(selected);
  const saved = structuredClone(latest.edit!);
  expect(latest.session!.dirty).toBe(false);
  expect(button("Save design").disabled).toBe(true);
  expect(mounted!.container.textContent).toContain("Saved design");
  if (selected === "p1") await act(async () => workers.at(-1)!.reply());
  const target = svg.querySelector(selected === "house" ? '[aria-label="Select House"]' : `[data-selected-product-grab="${selected}"]`)!;
  pointer(target, "pointerdown");
  pointer(svg, "pointermove", 50, 20);
  pointer(svg, "pointerup", 60, 20);
  await flush();
  expect(latest.edit).not.toEqual(saved);
  expect(latest.canSave).toBe(true);
  expect(button("Undo").disabled).toBe(false);
  act(() => button("Undo").click());
  await flush();
  expect(latest.edit).toEqual(saved);
  expect(latest.session!.generation).toBe(2);
  expect(button("Undo").disabled).toBe(true);
  expect(latest.session!.dirty).toBe(false);
  expect(latest.canSave).toBe(false);
  expect(button("Save design").disabled).toBe(true);
  expect(mounted!.container.textContent).toContain("Saved design");
  expect(mounted!.container.textContent).not.toContain("Unsaved changes");
  mounted!.unmount(); mounted = undefined; await flush();
  await open(selected);
  expect(latest.edit).toEqual(saved);
  expect(latest.session!.generation).toBe(2);
  expect(latest.canSave).toBe(false);
  expect(button("Save design").disabled).toBe(true);
});

it("keeps dirty-before-move work dirty after full Undo and preserves geometry/price-equal raw changes", async () => {
  const svg = await open();
  const saved = structuredClone(latest.edit!);
  const config = { ...loadCostingConfigV1(), accessoryRates: structuredClone(ACCESSORY_REVIEW_RATES) };
  const originalPrice = calculateStudioCommercialPricing(saved, config);
  act(() => {
    const edit = structuredClone(latest.edit!);
    edit.site.travelExGst = "0.00";
    latest.change(edit);
  });
  const raw = structuredClone(latest.edit!);
  expect(raw.spatial).toEqual(saved.spatial);
  expect(calculateStudioCommercialPricing(raw, config).amount).toBe(originalPrice.amount);
  expect(latest.canSave).toBe(true);
  pointer(grab(svg), "pointerdown");
  pointer(svg, "pointermove", 50, 70);
  pointer(svg, "pointerup", 60, 80);
  act(() => button("Undo").click()); await flush();
  expect(latest.edit).toEqual(raw);
  expect(latest.canSave).toBe(true);
  expect(button("Undo").disabled).toBe(false);
  expect(mounted!.container.textContent).toContain("Unsaved changes");
  act(() => latest.change(saved)); await flush();
  expect(latest.edit).toEqual(saved);
  expect(latest.canSave).toBe(false);
  expect(mounted!.container.textContent).toContain("Saved design");
});

it("retains invalid house input without locking a valid peer and keeps genuine preparation failures visible", async () => {
  await open("house");
  const field = mounted!.container.querySelector<HTMLInputElement>('input[aria-label="Width (mm)"]')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "invalid width");
    field.dispatchEvent(new Event("input", { bubbles: true }));
    button("Pergola 2").click();
  });
  expect(mounted!.container.textContent).not.toContain("before moving objects");
  expect(mounted!.container.textContent).toContain("Valid free movement is available");
  act(() => workers.at(-1)!.onerror?.({} as ErrorEvent));
  expect(mounted!.container.textContent).toContain("This connection could not be prepared.");
  expect(mounted!.container.textContent).not.toContain("Valid free movement is still available");
  act(() => button("Review house changes").click());
  expect(mounted!.container.querySelector<HTMLInputElement>('input[aria-label="Width (mm)"]')!.value).toBe("invalid width");
  act(() => button("Discard unfinished input").click());
  act(() => button("Pergola 2").click());
  const svg = mounted!.container.querySelector<SVGSVGElement>('svg[aria-label="Studio design Plan"]')!;
  pointer(grab(svg), "pointerdown");
  expect(svg.getAttribute("data-gesture-phase")).toBe("pressed");
  pointer(svg, "pointercancel");
  expect(latest.session!.generation).toBe(0);
  await flush();
});

it.each(["+ Pergola", "Duplicate"])("keeps initially clean %s then Undo clean without inventing an unsent object tombstone", async action => {
  await open(); const before = structuredClone(latest.edit!);
  const frame=mounted!.container.querySelector('svg[aria-label="Studio design Plan"]')!.getAttribute("viewBox");
  act(() => button(action).click());
  expect(latest.edit!.spatial.pergolas).toHaveLength(3);
  act(() => button("Undo").click()); await flush();
  expect(latest.edit).toEqual(before);
  expect(latest.session!.dirty).toBe(false);
  expect(latest.canSave).toBe(false);
  expect(button("Undo").disabled).toBe(true);
  expect([...mounted!.container.querySelectorAll('nav[aria-label="Design objects"] button')].find(b=>b.textContent==='Pergola 2')!.getAttribute("aria-pressed")).toBe("true");
  expect(JSON.parse(sessionStorage.getItem(studioHouseContextKey(scope))!)).toEqual({selected:"p2",mode:"position",section:"Shape",view:"Plan"});
  expect(mounted!.container.querySelector('svg[aria-label="Studio design Plan"]')!.getAttribute("viewBox")).toBe(frame);
});

it.each(["pending", "acknowledged"])("roundtrips actual Workspace Add/save/Undo/save/reload with Undo while %s through the real merge protocol", async timing => {
  const initial = positionWebsitePergola(fixture(), "p2", {originXMm:"30000",originYMm:"10000"});
  await open("p2", "facade", initial);
  let server: { authored: StudioAuthoredV1; spatial: StudioAuthoringEdit["spatial"] } = { authored: {schemaVersion:"studio_authored.v1",designId:scope.designId,revision:initial.revision,spatialOutputKey:"drawing_object_first",
    site:{validation:"preserved_unvalidated",values:initial.site},objectOptions:initial.objectOptions.map(row=>({objectId:row.objectId,options:{validation:"preserved_unvalidated",values:row.values}})),
    legacyCommercialAssociations:[],provenance:{sourceEstimateId:null,sourceKind:"authored",sourcePayload:null}},spatial:initial.spatial };
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release=resolve;});
  let calls = 0, savedAt = "2026-10-22T06:00:00Z";
  const bodies: string[] = [];
  mocks.api.mockImplementation(async (_url, options) => {
    const command = JSON.parse(options.body); bodies.push(options.body); calls++;
    if (timing === "pending" && calls === 1) await gate;
    const merged = mergeStudioAuthoringEdit({storedAuthored:server.authored,storedSpatial:server.spatial,edit:command.edit});
    expect(merged.ok).toBe(true); if(!merged.ok)throw Error(merged.message);
    const revision = server.authored.revision + 1;
    savedAt = `2026-10-22T06:0${calls}:00Z`;
    server = {authored:{...merged.value.authored,revision},spatial:merged.value.spatial};
    return {receipt:{revision,savedAt,alreadyExisted:false},pricing:"unpriced"};
  });
  act(() => button("+ Pergola").click()); await flush();
  const added = latest.edit!.spatial.pergolas.find(p => !initial.spatial.pergolas.some(old => old.id === p.id))!.id;
  let saving!: Promise<void>;
  await act(async () => { saving = latest.save(); });
  if (timing === "acknowledged") await act(async () => { await saving; });
  act(() => button("Undo").click());
  expect(latest.edit!.spatial).toEqual(initial.spatial);
  expect(latest.edit!.objectOptions).toEqual(initial.objectOptions);
  expect(latest.edit!.deletions).toContainEqual({scope:"object-options",objectId:added});
  if (timing === "pending") await act(async () => {release();await saving;});
  expect(bodies[0]).not.toContain('"scope":"object-options"');
  expect(latest.session!.dirty).toBe(true);
  await act(async () => { await latest.save(); });
  expect(JSON.parse(bodies[1]).edit.deletions).toContainEqual({scope:"object-options",objectId:added});
  expect(latest.session!.dirty).toBe(false);
  expect(latest.edit!.deletions).toEqual([]);
  const projected = projectStudioAuthoringView(server);
  expect(projected.ok).toBe(true); if(!projected.ok)throw Error(projected.message);
  expect(projected.value.spatial).toEqual(initial.spatial);
  expect(projected.value.objectOptions).toEqual(initial.objectOptions);
  mounted!.unmount(); mounted=undefined; await flush();
  await open("p2","facade",createStudioAuthoringEdit(projected.value),savedAt);
  expect(latest.session!.dirty).toBe(false);
  expect(button("Save design").disabled).toBe(true);
  expect(latest.edit!.spatial).toEqual(initial.spatial);
  expect(latest.edit!.objectOptions).toEqual(initial.objectOptions);
});


it('restores scene shortcuts after ordinary inactive Plan press and release', async()=>{
 const svg=await open('house');
 for(const label of ['Pergola 1','Pergola 2','Pergola 1','Pergola 2']) {
  const target=svg.querySelector('[aria-label="Select '+label+'"]')!;
  pointer(target,'pointerdown');
  expect(svg.getAttribute('data-gesture-phase')).toBe('pressed');
  pointer(svg,'pointerup');
  expect(svg.getAttribute('data-gesture-phase')).toBe('idle');
 }
 expect(document.activeElement?.tagName).toBe('MAIN');
 const before = structuredClone(latest.edit!);
 expect(shortcut(document.activeElement!, 'c', {ctrlKey:true}).defaultPrevented).toBe(true);
 expect(shortcut(document.activeElement!, 'ArrowRight').defaultPrevented).toBe(true);
 shortcut(document.activeElement!, 'ArrowRight', {}, 'keyup');
 expect(pose().x).toBe(websiteComposition(before).find(p => p.object.id === 'p2')!.position!.x + 10);
 shortcut(document.activeElement!, 'z', {ctrlKey:true});
 expect(latest.edit).toEqual(before);
 shortcut(document.activeElement!, 'y', {ctrlKey:true});
 expect(pose().x).toBe(websiteComposition(before).find(p => p.object.id === 'p2')!.position!.x + 10);
 shortcut(document.activeElement!, 'z', {ctrlKey:true});
 const event=shortcut(document.activeElement!,'Delete');
 expect(event.defaultPrevented).toBe(true);
 expect(latest.edit!.spatial.pergolas.some(p=>p.id==='p2')).toBe(false);
 shortcut(document.activeElement!, 'v', {ctrlKey:true});
 expect(latest.edit!.spatial.pergolas).toHaveLength(before.spatial.pergolas.length);
 expect(latest.edit!.spatial.pergolas.at(-1)!.id).not.toBe('p2');
});

it.each(['pointercancel', 'lostpointercapture', 'Escape'])("restores shortcuts after inactive Plan selection is cancelled by %s", async (exit) => {
 const svg = await open('house'), initial = structuredClone(latest.edit!);
 pointer(svg.querySelector('[aria-label="Select Pergola 2"]')!, 'pointerdown');
 expect(svg.getAttribute('data-gesture-phase')).toBe('pressed');
 expect(shortcut(document.activeElement!, 'Delete').defaultPrevented).toBe(false);
 expect(latest.edit).toEqual(initial);
 if (exit === 'Escape') shortcut(document.activeElement!, 'Escape');
 else pointer(svg, exit);
 expect(svg.getAttribute('data-gesture-phase')).toBe('idle');
 expect(shortcut(document.activeElement!, 'Delete').defaultPrevented).toBe(true);
 expect(latest.edit!.spatial.pergolas.some(p => p.id === 'p2')).toBe(false);
});

it.each(['blur','Enter'])('commits custom inline clearance on %s with one Undo, keeps the house fixed, and copies the preference',async(completion)=>{
 let initial={...studioAttachmentFixture(37,'hipped'),designId:scope.designId},house=studioHouseScene(initial.site,initial.spatial)!.houses[0];
 initial=updateStudioHouse(initial,{...house,eaveHeightMm:'4000',wallHeightMm:'4000'});
 initial=previewStudioAttachment(initial,{objectId:'p2',houseId:'house',edge:'rear',kind:'wall',method:'facade',facadeClearanceMm:'200'});
 const svg=await open('p2','facade',initial);act(()=>button('Design choices').click());const before=structuredClone(latest.edit!);
 const field=mounted!.container.querySelector<HTMLInputElement>('input[aria-label="Roof clearance in millimetres"]')!;
 act(()=>{field.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,'700');field.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(websiteComposition(latest.edit!)[0].value?.facadeClearanceMm).toBe('200');
 act(()=>completion==='blur'?field.blur():field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 const changed=structuredClone(latest.edit!);expect(websiteComposition(changed)[0].value?.facadeClearanceMm).toBe('700');expect(changed.spatial.houseAssembly).toEqual(before.spatial.houseAssembly);
 act(()=>button('Undo').click());expect(latest.edit).toEqual(before);act(()=>button('Redo').click());expect(latest.edit).toEqual(changed);
 shortcut(svg,'c',{ctrlKey:true});shortcut(svg,'v',{ctrlKey:true});const rows=websiteComposition(latest.edit!);expect(rows).toHaveLength(2);expect(rows.every(row=>row.value?.facadeClearanceMm==='700')).toBe(true);
 await flush();
});

it('keeps the current connection and complete saved design when a method adjustment would invalidate its sibling',async()=>{
 let initial:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:scope.designId,revision:3,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
 const added=applyStudioHouseEdit(initial.spatial,{kind:'add',id:'house'});if(!added.ok)throw Error(added.message);initial.spatial=added.spatial;initial=addWebsitePergola(initial,'p2');
 const house=studioHouseScene(initial.site,initial.spatial)!.houses[0];initial=updateStudioHouse(initial,{...house,wallHeightMm:'5600',eaveHeightMm:'5600'});
 initial=previewStudioConnectionSwitch(initial,studioConnectionSwitchTarget(initial,'p2','facade')).edit;
 initial=addWebsitePergola(initial,'sibling');const sibling=structuredClone(websiteComposition(initial).find(row=>row.object.id==='sibling')!.value!);sibling.facadeClearanceMm='2840';initial=changeStudioProduct(initial,sibling);
 initial=previewStudioAttachment(initial,{objectId:'sibling',houseId:'house',edge:'rear',kind:'wall',method:'facade',facadeClearanceMm:'2840'});
 await open('p2','facade',initial);act(()=>button('Design choices').click());act(()=>latest.change({...latest.edit!,site:{...latest.edit!.site,access:'hard'}}));const before=structuredClone(latest.edit!);
 act(()=>button('Soffit brackets').click());expect(mounted!.container.querySelector('[role="alert"]')?.textContent).toContain('Current connection: Façade');expect(mounted!.container.textContent).toContain('could not be applied');expect(latest.edit).toEqual(before);
 const saved=captureMergedStudioSave(initial);await act(async()=>{await latest.save();});expect(websiteComposition(saved()).find(row=>row.object.id==='p2')!.studioAttachment?.method).toBe('facade');expect(latest.session?.dirty).toBe(false);expect(latest.edit!.spatial).toEqual(before.spatial);
});

it('applies host-only legacy clearance through verified actual identity with full Undo, copy and Save',async()=>{
 let initial={...studioAttachmentFixture(37,'hipped'),designId:scope.designId},house=studioHouseScene(initial.site,initial.spatial)!.houses[0];initial=updateStudioHouse(initial,{...house,eaveHeightMm:'4000',wallHeightMm:'4000'});initial=previewStudioAttachment(initial,{objectId:'p2',houseId:'house',edge:'rear',kind:'wall',method:'facade'});delete initial.site.websiteAttachments;
 const svg=await open('p2','facade',initial);act(()=>button('Design choices').click());const before=structuredClone(latest.edit!),original=websiteComposition(before)[0];expect(original.studioAttachment).toBeNull();
 const field=mounted!.container.querySelector<HTMLInputElement>('input[aria-label="Roof clearance in millimetres"]')!;act(()=>{field.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,'700');field.dispatchEvent(new Event('input',{bubbles:true}));});act(()=>field.blur());
 const changed=structuredClone(latest.edit!),row=websiteComposition(changed)[0];expect(row.error).toBeNull();expect(row.studioAttachment?.method).toBe('facade');expect(row.value?.facadeClearanceMm).toBe('700');expect(row.position).toEqual(original.position);expect(changed.spatial.houseAssembly).toEqual(before.spatial.houseAssembly);expect(row.geometryOptions?.supportDatumMm).toBeLessThan(original.geometryOptions!.supportDatumMm!);
 act(()=>button('Undo').click());expect(latest.edit).toEqual(before);act(()=>button('Redo').click());expect(latest.edit).toEqual(changed);
 const saved=captureMergedStudioSave(initial);await act(async()=>{await latest.save();});expect(latest.session?.dirty).toBe(false);expect(websiteComposition(saved())[0].value?.facadeClearanceMm).toBe('700');expect(websiteComposition(saved())[0].studioAttachment?.method).toBe('facade');
 shortcut(svg,'c',{ctrlKey:true});shortcut(svg,'v',{ctrlKey:true});expect(websiteComposition(latest.edit!).every(p=>p.value?.facadeClearanceMm==='700'&&p.studioAttachment?.method==='facade')).toBe(true);await flush();
});
