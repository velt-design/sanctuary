const actionLabel=(label:string)=>(({Duplicate:"Duplicate pergola",Remove:"Remove pergola",Position:"Position & height",Options:"Design choices"} as Record<string,string>)[label]??label);
import { DEFAULT_ROOF_FINISH } from "@sp/geometry";
import { defaultBlind } from "@sp/configurator/website";
import { studioHouseContextKey, readStudioHouseContext } from "./studioHouseContext";
import { changeStudioProduct } from "@/lib/designStudio/studioHouseCommands";
import { act, useState, useRef } from "react";
import { expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from "@/lib/drawings/state/objectFirstWorkbenchModel";
import { applyStudioHouseEdit } from "@/lib/designStudio/houseEditing";
import { applyStudioPergolaEdit } from "@/lib/designStudio/pergolaEditing";
import {
  addWebsitePergola,
  positionWebsitePergola,
  websiteComposition,
} from "@/lib/designStudio/websiteComposition";
import {
  previewStudioAttachment,
  updateStudioHouse,
} from "@/lib/designStudio/studioHouseCommands";
import { studioHouseScene } from "@/lib/designStudio/studioHouseScene";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import WorkspaceView from "./StudioHouseWorkspace";
// Presentation tests retain their supplied command/refusal doubles. This small
// history double replaces the removed Workspace-local Undo; the actual durable
// owner, pending saves and remounts are covered in PlacementSession integration.
function StudioHouseWorkspace(props: Parameters<typeof WorkspaceView>[0]) {
  const [version, refresh] = useState(0);
  const state = useRef({ key: "", past: [] as Array<{edit:StudioAuthoringEdit;selection?:string}>, future: [] as Array<{edit:StudioAuthoringEdit;selection?:string}>, group: undefined as string | undefined });
  const controller = props.controller;
  const key = JSON.stringify([props.scope, controller.authoredIdentity.epoch]);
  if (state.current.key !== key) state.current = {key,past:[],future:[],group:undefined};
  const record = (result:any, history?:{group?:string;selectionBefore?:string}) => {
    if (result?.kind === "accepted") {
      if (!history?.group || history.group !== state.current.group) state.current.past.push({edit:result.previous,selection:history?.selectionBefore});
      state.current.future=[];state.current.group=history?.group;refresh(version+1);
    }
    return result;
  };
  const navigate = (from:"past"|"future", selection?:string) => {
    const entry=state.current[from].at(-1);if(!entry)return {kind:"refused" as const,reason:"Nothing to restore"};
    const result=controller.restoreEdit(entry.edit);if(result?.kind==="accepted") {
      state.current[from].pop();state.current[from==="past"?"future":"past"].push({edit:result.previous,selection});refresh(version+1);
    }
    return {...result,selection:entry.selection};
  };
  return <WorkspaceView {...props} controller={{...controller,
    change:(edit,history)=>record(controller.change(edit),history),
    transact:(expected,create,history)=>record(controller.transact(expected,create),history),
    endHistoryGroup:()=>{state.current.group=undefined;},
    captureEdit:()=>controller.canEdit?structuredClone(controller.edit):null,
    canUndo:controller.canEdit&&state.current.past.length>0,canRedo:controller.canEdit&&state.current.future.length>0,
    undo:selection=>navigate("past",selection),redo:selection=>navigate("future",selection),
  }} />;
}
const testIdentity = (edit: StudioAuthoringEdit) => ({
  scopeKey: `workspace-test:${edit.designId}`,
  epoch: "test",
  generation: 0,
});
const observed = vi.hoisted(() => ({
  scene: null as any,
  direct: null as any,
  price: null as any,
  realDirect: false,
  lighting: null as any,
  blinds: null as any,
}));
vi.mock("next/dynamic", () => ({
  default: () => (props: any) => {
    observed.scene = props;
    return <div />;
  },
}));
vi.mock("@sp/configurator/react/controls", () => ({
  LightingProvider: (props: any) => { observed.lighting = props; return props.children; },
  PreviewBlindProvider: (props: any) => { observed.blinds = props; return props.children; },
}));
vi.mock("./StudioHouseProductNavigation", () => ({ default: () => null }));
vi.mock("./StudioWebsiteControls", () => ({
  default: ({ section, choose,connectionControls }: any) => (
    <div data-section={section}>
      {(section === "Shape" || section === "Roof") && connectionControls}
      <button onClick={() => choose("Roof")}>Roof options</button>
      <input aria-label="Width in millimetres" />
      {section === "Sides" && (
        <section tabIndex={-1} aria-label="Retained unavailable blinds" />
      )}
    </div>
  ),
}));
vi.mock("./StudioWebsiteRecovery", () => ({ default: () => null }));
vi.mock("./StudioWebsiteJoinControls", () => ({ default: () => null }));
vi.mock("./useStudioWebsitePrice", () => ({
  useStudioWebsitePrice: () =>
    observed.price ?? {
      price: { status: "priced", amount: 100, versionNumber: 15 },
    },
}));
vi.mock("./useStudioDirectPlacement", async (load) => {
  const actual = await load<typeof import("./useStudioDirectPlacement")>();
  return {
    useStudioDirectPlacement: (args: Parameters<typeof actual.useStudioDirectPlacement>[0]) => {
      observed.direct = [args];
      return observed.realDirect ? actual.useStudioDirectPlacement(args) :
        { directDrag: {}, busy: false, message: null, proposal: null };
    },
  };
});
function retainedHistoricalHouse(spatial:StudioAuthoringEdit['spatial']) {
 const house=spatial.houseAssembly!.houseForms[0];delete house.wallHeightM;delete house.eaveHeightM;
 const rectangle=house.composition.primitives[0];if(rectangle.kind!=='axisAlignedRectangle')throw Error('Expected historical rectangle.');rectangle.widthMm=6000;rectangle.depthMm=4000;
 return spatial;
}
function draftFixture() {
  let edit: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "draft-boundary",
    revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  const added = applyStudioHouseEdit(edit.spatial, {
    kind: "add",
    id: "house",
  });
  if (!added.ok) throw Error(added.message);
  edit.spatial = added.spatial;
  return addWebsitePergola(edit, "p");
}
function selectionWorkspace(initial:StudioAuthoringEdit,selected="p") {
  sessionStorage.clear();observed.price=null;observed.realDirect=false;
  const scope={actorId:"actor",projectId:"project",estimateId:"selection-membership",designId:initial.designId};
  const context={selected,mode:"position",section:"Roof",view:"Plan"};
  const key=studioHouseContextKey(scope),cameras={plan:'{"x":123,"y":456,"units":7}',model:'{"position":[1,2,3],"target":[4,5,6],"zoom":2}'};
  sessionStorage.setItem(key,JSON.stringify(context));
  sessionStorage.setItem(`${key}:camera:plan`,cameras.plan);sessionStorage.setItem(`${key}:camera:3d`,cameras.model);
  let current=initial,replace!:(edit:StudioAuthoringEdit)=>void;
  function Harness() {
    const [state,setState]=useState({edit:initial,generation:0});current=state.edit;
    replace=edit=>setState(old=>({edit,generation:old.generation+1}));
    const identity={...testIdentity(state.edit),generation:state.generation};
    const accept=(edit:StudioAuthoringEdit)=>{const result={kind:"accepted" as const,previous:state.edit,edit,identity:{...identity,generation:state.generation+1}};replace(edit);return result;};
    return <StudioHouseWorkspace controller={{edit:state.edit,authoredIdentity:identity,canEdit:true,canSave:true,
      session:{dirty:state.generation>0,generation:state.generation,baselinePergolaIds:initial.spatial.pergolas.map(p=>p.id),baselineObjectOptions:initial.objectOptions},
      change:accept,transact:(expected:any,create:(edit:StudioAuthoringEdit)=>StudioAuthoringEdit)=>JSON.stringify(expected)===JSON.stringify(identity)?accept(create(state.edit)):{kind:'refused',reason:'Stale inspector identity'},restoreEdit:accept,save:vi.fn()} as any} scope={scope} versionLabel="V1" />;
  }
  const m=renderIntoDocument(<Harness />);
  return {m,key,cameras,context,current:()=>current,replace:(edit:StudioAuthoringEdit)=>act(()=>replace(edit)),click:(text:string)=>act(()=>{
    const button=[...m.container.querySelectorAll("button")].find(b=>b.textContent===actionLabel(text));expect(button,`Visible ${text}`).toBeTruthy();button!.click();
  })};
}
// Several complete method switches and React commits share one correctness case.
// Dedicated interaction performance assertions remain unchanged.
it('uses the current guarded edit for rapid reverse method clicks and an immediately blurred clearance field', () => {
  const initial = previewStudioAttachment(draftFixture(), { objectId: 'p', houseId: 'house', edge: 'rear', kind: 'eave', method: 'soffit' });
  const t = selectionWorkspace(initial);
  t.click('Options');
  const errors = vi.spyOn(console, 'error');
  const button = (method: string) => t.m.container.querySelector<HTMLButtonElement>(`[data-studio-connection="${method}"]`)!;
  try {
    act(() => { button('facade').click(); button('soffit').click(); });
    expect(websiteComposition(t.current())[0].studioAttachment?.method).toBe('soffit');
    expect(t.m.container.textContent).not.toContain('Stale inspector identity');
    t.click('Façade');
    const field = t.m.container.querySelector<HTMLInputElement>('input[aria-label="Roof clearance in millimetres"]')!;
    expect(field).toBeTruthy();
    act(() => {
      field.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '700');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const house = structuredClone(t.current().spatial.houseAssembly);
    act(() => {
      field.blur();
      expect(t.current().spatial.houseAssembly).toEqual(house);
      button('soffit').click();
      button('facade').click();
    });
    const row = websiteComposition(t.current())[0];
    expect(row.studioAttachment?.method).toBe('facade');
    expect(row.value!.facadeClearanceMm).toBe('700');
    expect(row.error).toBeNull();
    expect(row.attachment && 'measurements' in row.attachment && row.attachment.measurements!.roofClearanceMm).toBeGreaterThanOrEqual(700);
    expect(errors).not.toHaveBeenCalled();
  } finally { errors.mockRestore(); t.m.unmount(); }
}, 15_000);
it("passes current resolved accessory geometry through House fallback, edits and Undo", () => {
  const initial = draftFixture(), t = selectionWorkspace(initial, "house");
  try {
    const first = observed.scene.resolvedScene.products[0].geometry;
    expect(first).toBeTruthy();
    expect(observed.lighting.preparedGeometry).toBe(first);
    expect(observed.blinds.preparedGeometry).toBe(first);
    const value = websiteComposition(initial)[0].value!;
    const changed = changeStudioProduct(initial, { ...value, rawDimensions: { ...value.rawDimensions, widthMm: "7500" } });
    t.replace(changed);
    const next = observed.scene.resolvedScene.products[0].geometry;
    expect(next).not.toBe(first);
    expect(observed.lighting.input.widthMm).toBe(7500);
    expect(observed.lighting.preparedGeometry).toBe(next);
    expect(observed.blinds.preparedGeometry).toBe(next);
    t.replace(initial);
    expect(observed.lighting.input.widthMm).toBe(6000);
    expect(observed.lighting.preparedGeometry).toBe(observed.scene.resolvedScene.products[0].geometry);
  } finally { t.m.unmount(); }
});
it.each(["+ Pergola","Duplicate","Remove"])("keeps a real selected member and the current navigation/cameras after %s then Undo",action=>{
  const initial=draftFixture(),t=selectionWorkspace(initial);
  try {
    t.click(action);
    const afterAction={mode:JSON.parse(sessionStorage.getItem(t.key)!).mode,section:observed.scene.section,view:observed.scene.view};
    if(action!=="Remove")expect(t.current().spatial.pergolas.some(p=>p.id===observed.scene.selected&&p.id!=="p")).toBe(true);
    t.click("Undo");expect(t.current()).toEqual(initial);
    expect(observed.scene.selected).toBe("p");
    expect([...t.m.container.querySelectorAll('nav[aria-label="Design objects"] button')].find(b=>b.textContent==='Pergola 1')!.getAttribute("aria-pressed")).toBe("true");
    expect(JSON.parse(sessionStorage.getItem(t.key)!)).toEqual({selected:"p",...afterAction});
    expect(observed.scene.cameraStorageKey).toBe(`${t.key}:camera`);
    expect(sessionStorage.getItem(`${t.key}:camera:plan`)).toBe(t.cameras.plan);
    expect(sessionStorage.getItem(`${t.key}:camera:3d`)).toBe(t.cameras.model);
  } finally {t.m.unmount();}
});
it("repairs membership changes outside Undo, retaining a valid selection through nonselected removal and restoration",()=>{
  const initial=addWebsitePergola(draftFixture(),"second"),t=selectionWorkspace(initial);
  const without=(edit:StudioAuthoringEdit,id:string)=>{
    const result=applyStudioPergolaEdit(edit,{kind:"remove",pergolaId:id},{persistedObjectIds:["p","second"]});
    if(!result.ok)throw Error(result.message);return result.edit;
  };
  try {
    t.replace(without(initial,"second"));expect(observed.scene.selected).toBe("p");
    t.replace(initial);expect(observed.scene.selected).toBe("p");
    t.replace(without(initial,"p"));expect(observed.scene.selected).toBe("house");
    t.replace(initial);expect(observed.scene.selected).toBe("house");
    const removedHouse=applyStudioHouseEdit(initial.spatial,{kind:"remove",houseFormId:"house"});
    if(!removedHouse.ok)throw Error(removedHouse.message);
    const noHouse={...initial,spatial:removedHouse.spatial};
    t.replace(noHouse);expect(observed.scene.selected).toBe("p");
    t.replace(without(noHouse,"second"));expect(observed.scene.selected).toBe("p");
    t.replace(without(without(noHouse,"second"),"p"));expect(observed.scene.selected).toBe("");
    expect(JSON.parse(sessionStorage.getItem(t.key)!)).toEqual({...t.context,selected:""});
    t.replace(initial);expect(observed.scene.selected).toBe("house");
    expect(observed.scene.view).toBe("Plan");expect(observed.scene.section).toBe("Roof");
    expect(sessionStorage.getItem(`${t.key}:camera:plan`)).toBe(t.cameras.plan);
    expect(sessionStorage.getItem(`${t.key}:camera:3d`)).toBe(t.cameras.model);
  } finally {t.m.unmount();}
});
it.each(["p","removed-product"])("restores valid navigation and camera addresses while repairing only a stale stored selection (%s)",selected=>{
  const t=selectionWorkspace(draftFixture(),selected);
  try {
    const expected=selected==="p"?"p":"house";
    expect(observed.scene.selected).toBe(expected);
    expect(JSON.parse(sessionStorage.getItem(t.key)!)).toEqual({...t.context,selected:expected});
    expect(observed.scene.view).toBe("Plan");expect(observed.scene.section).toBe("Roof");
    expect(observed.scene.cameraStorageKey).toBe(`${t.key}:camera`);
    expect(sessionStorage.getItem(`${t.key}:camera:plan`)).toBe(t.cameras.plan);
    expect(sessionStorage.getItem(`${t.key}:camera:3d`)).toBe(t.cameras.model);
    expect(t.current()).toEqual(draftFixture());
  } finally {t.m.unmount();}
});
it("does not repair malformed navigation fields as if they were a valid stale selection",()=>{
  const context={selected:"removed",mode:"position",section:"Roof",view:"Plan"};
  for(const patch of [{selected:7},{mode:"unknown"},{section:"unknown"},{view:"unknown"}])
    expect(readStudioHouseContext(JSON.stringify({...context,...patch}),["house","p"])).toBeNull();
});
const typeField = (field: HTMLInputElement, value: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
it.each(["Enter", "Discard unfinished input"])(
  "explains a hidden house draft and permits the next actual pergola gesture after %s",
  (action) => {
    sessionStorage.clear(); observed.price = null; observed.realDirect = true;
    vi.stubGlobal("Worker", class { postMessage() {} terminate() {} });
    const initial = positionWebsitePergola(draftFixture(), "p", {originXMm:"15000",originYMm:"1000"});
    const scope = {actorId:"actor",projectId:"project",estimateId:"drag-lock",designId:initial.designId};
    let current = initial;
    function Harness() {
      const [state, setState] = useState({edit:initial,generation:0});
      current = state.edit;
      const identity = {...testIdentity(state.edit),generation:state.generation};
      const accept = (edit: StudioAuthoringEdit) => {
        const result = {kind:"accepted" as const,previous:state.edit,edit,identity:{...identity,generation:state.generation+1}};
        setState({edit,generation:result.identity.generation}); return result;
      };
      return <StudioHouseWorkspace controller={{edit:state.edit,authoredIdentity:identity,
        canEdit:true,canSave:true,session:{dirty:state.generation>0,generation:state.generation,baselinePergolaIds:["p"],baselineObjectOptions:initial.objectOptions},
        change:accept,transact:(_expected:any,create:(edit:StudioAuthoringEdit)=>StudioAuthoringEdit)=>accept(create(state.edit)),
        restoreEdit:accept,save:vi.fn()} as any} scope={scope} versionLabel="V1" />;
    }
    const m=renderIntoDocument(<Harness />);
    const click=(text:string)=>act(()=>{
      const button=[...m.container.querySelectorAll("button")].find(b=>b.textContent===actionLabel(text));
      expect(button,`Visible action ${text}`).toBeTruthy();button!.click();
    });
    try {
      typeField(m.container.querySelector('input[aria-label="Width (mm)"]')!,"7654");
      const retained=sessionStorage.getItem(`actor:project:drag-lock:${initial.designId}:1:studio-house-pending`);
      click("Pergola 1");
      expect(m.container.querySelector('input[aria-label="Width (mm)"]')).toBeNull();
      expect(current).toEqual(initial);
      const pointer={pointerId:1,screen:{x:0,y:0},world:{x:15000,y:1000},units:1};
      let pressed=true;act(()=>{pressed=observed.scene.directDrag.press("p",pointer);});
      expect(pressed).toBe(true);
      act(()=>observed.scene.directDrag.cancel());
      expect(m.container.querySelector('[aria-label="Design pricing status"]')!.textContent).not.toContain("before moving objects");
      expect(sessionStorage.getItem(`actor:project:drag-lock:${initial.designId}:1:studio-house-pending`)).toBe(retained);
      click("Review house changes");
      expect(m.container.querySelector<HTMLInputElement>('input[aria-label="Width (mm)"]')!.value).toBe("7654");
      if(action==="Enter")act(()=>m.container.querySelector('input[aria-label="Width (mm)"]')!.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})));else click(action);
      expect(m.container.querySelector('[aria-label="Design pricing status"]')!.textContent).not.toContain("before moving objects");
      expect(sessionStorage.getItem(`actor:project:drag-lock:${initial.designId}:1:studio-house-pending`)).toBeNull();
      if(action==="Discard unfinished input")expect(current).toEqual(initial);
      else expect(studioHouseScene(current.site,current.spatial)!.houses[0].widthMm).toBe("7654");
      const beforeMove=structuredClone(current);
      click("Pergola 1");
      act(()=>{pressed=observed.scene.directDrag.press("p",pointer);});
      expect(pressed).toBe(true);
      act(()=>observed.scene.directDrag.move({...pointer,screen:{x:30,y:0},world:{x:15030,y:1000}}));
      expect(observed.scene.gesturePhase).toBe("dragging");
      act(()=>observed.scene.directDrag.release({...pointer,screen:{x:40,y:0},world:{x:15040,y:1000}}));
      expect(websiteComposition(current)[0].position!.x).toBe(15040);
      expect(observed.scene.gesturePhase).toBe("idle");
      click("Undo");expect(current).toEqual(beforeMove);
    } finally {m.unmount();observed.realDirect=false;vi.unstubAllGlobals();}
  },
);
it.each(["invalid", "stale", "other-house", "recovered-join", "missing-target"] as const)(
  "keeps the retained house lock recoverable from %s navigation without applying or replacing raw work",
  (state) => {
    sessionStorage.clear(); observed.price = null;
    let edit=draftFixture();
    if(state==="other-house") {
      const added=applyStudioHouseEdit(edit.spatial,{kind:"add",id:"other-house",label:"Other house"});
      if(!added.ok)throw Error(added.message);edit={...edit,spatial:added.spatial};
    }
    const scope={actorId:"actor",projectId:"project",estimateId:`retained-${state}`,designId:edit.designId};
    const key=`actor:project:${scope.estimateId}:${edit.designId}:1:studio-house-pending`;
    if(state==="recovered-join") {
      const draft={...studioHouseScene(edit.site,edit.spatial)!.houses[0],widthMm:"76."};
      sessionStorage.setItem(key,JSON.stringify(draft));
      sessionStorage.setItem(studioHouseContextKey(scope),JSON.stringify({selected:"p",mode:"position",section:"Roof",view:"Plan"}));
    }
    const refused={kind:"refused",reason:"Retained changes were not applied"} as const;
    let generation=0;
    const controller=()=>({edit,authoredIdentity:{...testIdentity(edit),generation},canEdit:true,canSave:false,
      session:{dirty:false,baselinePergolaIds:["p"]},change:vi.fn(()=>refused),transact:vi.fn(()=>refused),save:vi.fn()});
    let currentController=controller();
    const render=()=> <StudioHouseWorkspace controller={currentController as any} scope={scope} versionLabel="V1" />;
    const m=renderIntoDocument(render());
    const click=(text:string)=>act(()=>{
      const button=[...m.container.querySelectorAll("button")].find(b=>b.textContent===actionLabel(text));
      expect(button,`Visible action ${text}`).toBeTruthy();button!.click();
    });
    try {
      if(state!=="recovered-join")typeField(m.container.querySelector('input[aria-label="Width (mm)"]')!,state==="invalid"?"bad":"7654");
      click("Pergola 1");
      if(state==="recovered-join")click("Pergola joins");
      if(state==="other-house")click("Other house");
      if(state==="stale"||state==="missing-target") {
        if(state==="stale") {
          const house=studioHouseScene(edit.site,edit.spatial)!.houses[0];
          edit=updateStudioHouse(edit,{...house,widthMm:"8100"});
        } else {
          const removed=applyStudioHouseEdit(edit.spatial,{kind:"remove",houseFormId:"house"});
          if(!removed.ok)throw Error(removed.message);edit={...edit,spatial:removed.spatial};
        }
        generation++;currentController=controller();m.rerender(render());
      }
      const retained=sessionStorage.getItem(key);
      expect(retained).not.toBeNull();
      expect(observed.scene.movementLocked).toBe(state==="recovered-join");
      expect(m.container.querySelector('[aria-label="Design pricing status"]')!.textContent).not.toContain("before moving objects");
      if(state==="missing-target") {
        expect(m.container.textContent).toContain("original house is no longer available");
        expect(m.container.textContent).not.toContain("Review house changes");
        click("Discard house changes");
        expect(observed.scene.movementLocked).toBe(false);
      } else {
        const review=[...m.container.querySelectorAll("button")].find(b=>b.textContent==="Review house changes")!;
        expect(review.disabled).toBe(false);
        expect(review.closest('[class*="housePriceStatus"]')).toBeTruthy();
        click("Review house changes");
        expect(observed.scene.selected).toBe("house");
        expect(m.container.querySelector<HTMLInputElement>('input[aria-label="Width (mm)"]')!.value)
          .toBe(state==="invalid"?"bad":state==="recovered-join"?"76.":"7654");
        expect(sessionStorage.getItem(key)).toBe(retained);
        if(state==="invalid") {
          expect(m.container.querySelector('[aria-invalid="true"]')).toBeTruthy();
        }
        expect(m.container.textContent).not.toContain("Apply house changes");
        if(state==="stale")expect(m.container.textContent).toContain("The house changed after this input began");
        if(state==="recovered-join")expect(m.container.textContent).toContain("original basis of this recovered input is unverified");
      }
      expect(currentController.change).not.toHaveBeenCalled();expect(currentController.transact).not.toHaveBeenCalled();
    } finally {m.unmount();}
  },
);
it("retains raw house intent when the actual application outcome is refused", () => {
  sessionStorage.clear();
  const edit = draftFixture(),
    refused = { kind: "refused", reason: "Editing authority changed" } as const;
  const controller = {
    edit,
    authoredIdentity: testIdentity(edit),
    change: vi.fn(() => refused),
    transact: vi.fn(() => refused),
    canEdit: true,
    canSave: false,
    session: { dirty: false, baselinePergolaIds: ["p"] },
    save: vi.fn(),
  };
  const m = renderIntoDocument(
    <StudioHouseWorkspace
      controller={controller as any}
      scope={{
        actorId: "actor",
        projectId: "project",
        estimateId: "estimate",
        designId: edit.designId,
      }}
      versionLabel="V1"
    />,
  );
  typeField(
    m.container.querySelector('input[aria-label="Width (mm)"]')!,
    "7654",
  );
  act(()=>m.container.querySelector('input[aria-label="Width (mm)"]')!.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})));
  expect(
    m.container.querySelector<HTMLInputElement>(
      'input[aria-label="Width (mm)"]',
    )!.value,
  ).toBe("7654");
  expect(m.container.textContent).toContain("Editing authority changed");
  expect(m.container.textContent).toContain("Discard unfinished input");
  expect(
    [...m.container.querySelectorAll("button")].find(
      (b) => b.textContent === "Undo",
    )!.disabled,
  ).toBe(true);
  m.unmount();
});
it("keeps a draft across form unmount but never writes it into a foreign scope", () => {
  sessionStorage.clear();
  const edit = draftFixture(),
    controller = {
      edit,
      authoredIdentity: testIdentity(edit),
      change: vi.fn(),
      transact: vi.fn(),
      canEdit: true,
      canSave: false,
      session: { dirty: false, baselinePergolaIds: ["p"] },
      save: vi.fn(),
    },
    scope = {
      actorId: "actor",
      projectId: "project",
      estimateId: "estimate",
      designId: edit.designId,
    };
  const m = renderIntoDocument(
    <StudioHouseWorkspace
      controller={controller as any}
      scope={scope}
      versionLabel="V1"
    />,
  );
  typeField(
    m.container.querySelector('input[aria-label="Width (mm)"]')!,
    "76.",
  );
  act(() =>
    [...m.container.querySelectorAll("button")]
      .find((b) => b.textContent === "Pergola 1")!
      .click(),
  );
  act(() => observed.scene.onSelect("house"));
  expect(
    m.container.querySelector<HTMLInputElement>(
      'input[aria-label="Width (mm)"]',
    )!.value,
  ).toBe("76.");
  const foreign = { ...scope, estimateId: "foreign" };
  m.rerender(
    <StudioHouseWorkspace
      controller={
        {
          ...controller,
          authoredIdentity: {
            ...controller.authoredIdentity,
            epoch: "foreign",
          },
        } as any
      }
      scope={foreign}
      versionLabel="V1"
    />,
  );
  expect(
    m.container.querySelector<HTMLInputElement>(
      'input[aria-label="Width (mm)"]',
    )!.value,
  ).not.toBe("76.");
  expect(
    sessionStorage.getItem(
      `actor:project:foreign:${edit.designId}:1:studio-house-pending`,
    ),
  ).toBeNull();
  expect(
    JSON.parse(sessionStorage.getItem(studioHouseContextKey(foreign))!),
  ).toMatchObject({
    selected: "house",
    section: "Shape",
    mode: "options",
    view: "3D",
  });
  m.unmount();
});
it.each(["+ Pergola", "Duplicate", "Remove", "+ House"])(
  "withholds navigation and success feedback after refused %s",
  (label) => {
    sessionStorage.clear();
    let edit = draftFixture();
    if (label === "+ House")
      edit = { ...edit, spatial: { ...edit.spatial, houseAssembly: null } };
    const scope = {
      actorId: "actor",
      projectId: "project",
      estimateId: "estimate",
      designId: edit.designId,
    };
    sessionStorage.setItem(
      studioHouseContextKey(scope),
      JSON.stringify({
        selected: "p",
        mode: "options",
        section: "Roof",
        view: "3D",
      }),
    );
    const controller = {
      edit,
      authoredIdentity: testIdentity(edit),
      change: vi.fn(() => ({ kind: "refused", reason: "Operation refused" })),
      transact: vi.fn(),
      canEdit: true,
      canSave: false,
      session: {
        dirty: false,
        baselinePergolaIds: [],
        baselineObjectOptions: [],
      },
      save: vi.fn(),
    };
    const m = renderIntoDocument(
      <StudioHouseWorkspace
        controller={controller as any}
        scope={scope}
        versionLabel="V1"
      />,
    );
    act(() =>
      [...m.container.querySelectorAll("button")]
        .find((b) => b.textContent === actionLabel(label))!
        .click(),
    );
    expect(observed.scene.selected).toBe("p");
    expect(observed.scene.view).toBe("3D");
    expect(m.container.querySelector('[data-section="Roof"]')).toBeTruthy();
    expect(m.container.textContent).not.toContain("Copy created");
    expect(m.container.textContent).toContain("Operation refused");
    m.unmount();
  },
);
it("keeps the full price warning and its keyboard action inside the same existing status region", () => {
  sessionStorage.clear();
  const edit = draftFixture(),
    controller = {
      edit,
      authoredIdentity: testIdentity(edit),
      change: vi.fn(),
      transact: vi.fn(),
      canEdit: true,
      canSave: false,
      session: { dirty: false, baselinePergolaIds: ["p"] },
      save: vi.fn(),
    },
    scope = {
      actorId: "actor",
      projectId: "project",
      estimateId: "estimate",
      designId: edit.designId,
    };
  const m = renderIntoDocument(
      <StudioHouseWorkspace
        controller={controller as any}
        scope={scope}
        versionLabel="V1"
      />,
    ),
    status = m.container.querySelector('[aria-label="Design pricing status"]')!,
    parent = status.parentElement;
  const message =
    "Pricing could not be refreshed. Your exact saved design and selected accessories are retained. Try the request again.";
  observed.price = { error: message, retry: vi.fn() };
  m.rerender(
    <StudioHouseWorkspace
      controller={controller as any}
      scope={scope}
      versionLabel="V1"
    />,
  );
  const warning = m.container.querySelector<HTMLElement>(
    '[aria-label="Design pricing status"]',
  )!;
  expect(warning).toBe(status);
  expect(warning.parentElement).toBe(parent);
  expect(warning.textContent).toBe(message);
  expect(warning.tabIndex).toBe(0);
  const retry = [...m.container.querySelectorAll("button")].find(
    (b) => b.textContent === "Retry price",
  )!;
  expect(retry.parentElement).toBe(parent);
  act(() => retry.click());
  expect(observed.price.retry).toHaveBeenCalledOnce();
  observed.price = null;
  m.unmount();
});
it("opens Change on its existing side, preserves its anchor and unlocks only the valid proposed geometry", () => {
  let edit: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "workspace-proof",
    revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  const added = applyStudioHouseEdit(edit.spatial, {
    kind: "add",
    id: "house",
  });
  if (!added.ok) throw Error(added.message);
  edit.spatial = added.spatial;
  const house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
  edit = updateStudioHouse(edit, {
    ...house,
    widthMm: "8000",
    wallHeightMm: "3200",
    eaveHeightMm: "3200",
    roof: { ...house.roof, fasciaHeightMm: "350" },
  });
  edit = previewStudioAttachment(addWebsitePergola(edit, "p"), {
    objectId: "p",
    houseId: "house",
    edge: "rear",
    kind: "eave",
    method: "soffit",
    alongEdgeMm: 500,
  });
  const change = vi.fn(),
    controller = {
      edit,
      authoredIdentity: testIdentity(edit),
      change,
      transact: vi.fn(() => ({kind: "refused", reason: "Method completion retained for this test"})),
      canEdit: true,
      canSave: false,
      session: { dirty: false, baselinePergolaIds: ["p"] },
      save: vi.fn(),
    };
  sessionStorage.clear();
  const m = renderIntoDocument(
    <StudioHouseWorkspace
      controller={controller as any}
      scope={{
        actorId: "actor",
        projectId: "project",
        estimateId: "estimate",
        designId: edit.designId,
      }}
      versionLabel="V1"
    />,
  );
  const click = (text: string) =>
    act(() => {
      const button = [...m.container.querySelectorAll("button")].find(
        (b) => b.textContent === actionLabel(text),
      );
      expect(button).toBeTruthy();
      button!.click();
    });
  click("Pergola 1");
  click("Position");
  click("Change");
  expect(m.container.textContent).toContain("rear roof edge");
  expect(observed.direct[0].pending).toBeNull();
  click("Fascia");
  expect(controller.transact).toHaveBeenCalledOnce();
  expect(m.container.textContent).toContain("Method completion retained for this test");
  expect(observed.direct[0].locked).toBe(false);expect(observed.scene.movementLocked).toBe(false);
  expect(observed.direct[0].pending).toBeNull();expect(observed.scene.preview).toBeNull();
  expect(websiteComposition(edit)[0].studioAttachment?.method).toBe("soffit");
  click("Design choices");expect(change).not.toHaveBeenCalled();
  m.unmount();
});

it("guides the measured failed roof connection into the relevant house input and back to the prior Roof section", async () => {
  let edit: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "repair-workspace",
    revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  const added = applyStudioHouseEdit(edit.spatial, {
    kind: "add",
    id: "house",
  });
  if (!added.ok) throw Error(added.message);
  edit.spatial = retainedHistoricalHouse(added.spatial);
  edit = previewStudioAttachment(addWebsitePergola(edit, "p"), {
    objectId: "p",
    houseId: "house",
    edge: "rear",
    kind: "eave",
    method: "soffit",
  });
  const value = structuredClone(websiteComposition(edit)[0].value!);
  value.selection.roof.finish = {
    ...DEFAULT_ROOF_FINISH,
    material: "combination",
    ceiling: "thermopine-150",
  };
  edit = changeStudioProduct(edit, value);
  const scope = {
    actorId: "actor",
    projectId: "project",
    estimateId: "repair-estimate",
    designId: edit.designId,
  };
  sessionStorage.clear();
  sessionStorage.setItem(
    studioHouseContextKey(scope),
    JSON.stringify({
      selected: "p",
      mode: "options",
      section: "Roof",
      view: "3D",
    }),
  );
  const change = vi.fn(),
    controller = {
      edit,
      authoredIdentity: testIdentity(edit),
      change,
      canEdit: true,
      canSave: false,
      session: { dirty: true, baselinePergolaIds: ["p"] },
      save: vi.fn(),
    };
  const m = renderIntoDocument(
    <StudioHouseWorkspace
      controller={controller as any}
      scope={scope}
      versionLabel="V1"
    />,
  );
  const click = async (text: string) => {
    await act(async () => {
      const b = [...m.container.querySelectorAll("button")].find(
        (b) => b.textContent === actionLabel(text),
      );
      expect(b).toBeTruthy();
      b!.click();
    });
  };
  await click("Change house connection");
  expect(m.container.textContent).toContain("Available house edge");
  expect(m.container.textContent).toContain("Required connection span");
  expect(observed.scene.repairTarget).toBeTruthy();
  await click("Show affected edge in Plan");
  expect(observed.scene.view).toBe("Plan");
  await click("Check house dimensions");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 35));
  });
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Width (mm)");
  expect(observed.scene.repairTarget).toBeTruthy();
  await click("Return to Pergola 1 · Shape");
  expect(m.container.querySelector('[data-section="Shape"]')).toBeTruthy();
  expect(observed.scene.view).toBe("Plan");
  expect(change).not.toHaveBeenCalled();
  expect(controller.save).not.toHaveBeenCalled();
  m.unmount();
});

it("repairs a retained low Wall proposal through the independent eave height and returns to its exact proposal", async () => {
  let edit: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "wall-repair-workspace",
    revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  const added = applyStudioHouseEdit(edit.spatial, {
    kind: "add",
    id: "house",
  });
  if (!added.ok) throw Error(added.message);
  edit.spatial = retainedHistoricalHouse(added.spatial);
  edit = addWebsitePergola(edit, "p");
  const original = studioHouseScene(edit.site, edit.spatial)!.houses[0];
  expect(original.eaveHeightMm).toBe("");
  const scope = {
    actorId: "actor",
    projectId: "project",
    estimateId: "wall-repair-estimate",
    designId: edit.designId,
  };
  sessionStorage.clear();
  sessionStorage.setItem(
    studioHouseContextKey(scope),
    JSON.stringify({
      selected: "p",
      mode: "position",
      section: "Roof",
      view: "Plan",
    }),
  );
  const controller = {
    edit,
    authoredIdentity: testIdentity(edit),
    change: vi.fn((next: StudioAuthoringEdit) => {
      const previous = controller.edit;
      controller.edit = next;
      controller.authoredIdentity = {
        ...controller.authoredIdentity,
        generation: controller.authoredIdentity.generation + 1,
      };
      rendered.rerender(
        <StudioHouseWorkspace
          controller={controller as any}
          scope={scope}
          versionLabel="V1"
        />,
      );
      return {
        kind: "accepted" as const,
        previous,
        edit: next,
        identity: controller.authoredIdentity,
      };
    }),
    transact: (
      _expected: unknown,
      create: (current: StudioAuthoringEdit) => StudioAuthoringEdit,
    ) => controller.change(create(controller.edit)),
    canEdit: true,
    canSave: false,
    session: { dirty: true, baselinePergolaIds: ["p"] },
    save: vi.fn(),
  };
  const rendered = renderIntoDocument(
    <StudioHouseWorkspace
      controller={controller as any}
      scope={scope}
      versionLabel="V1"
    />,
  );
  const click = async (text: string) => {
    await act(async () => {
      const b = [...rendered.container.querySelectorAll("button")].find(
        (b) => b.textContent === actionLabel(text),
      );
      expect(b).toBeTruthy();
      b!.click();
    });
  };
  await click("Attach to house");
  await act(async () => {const select=rendered.container.querySelector<HTMLSelectElement>('select[aria-label="House edge"]')!;select.value='house:rear';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(rendered.container.textContent).toContain("2000–5000");
  expect(observed.scene.preview).toBeNull();
  await click("Check house height");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 35));
  });
  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "Eave height (mm)",
  );
  expect(rendered.container.textContent).toContain(
    "Wall and eave heights are independent",
  );
  const field = rendered.container.querySelector<HTMLInputElement>(
    'input[aria-label="Eave height (mm)"]',
  )!;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(field, "3000");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(()=>field.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})));
  const actual = studioHouseScene(
    controller.edit.site,
    controller.edit.spatial,
  )!.houses[0];
  expect(actual.wallHeightMm).toBe(original.wallHeightMm);
  expect(actual.eaveHeightMm).toBe("3000");
  await click("Return to Pergola 1 · Shape");
  expect(observed.direct[0].pending).toBeNull();
  expect(websiteComposition(controller.edit)[0]).toMatchObject({
    error: null,
    studioAttachment: { edge: "rear", method: "facade" },
  });
  expect(controller.save).not.toHaveBeenCalled();
  rendered.unmount();
});

it("routes an attached unavailable blind to Sides without deleting it or blaming the valid house span", async () => {
  let edit: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "blind-repair",
    revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  const added = applyStudioHouseEdit(edit.spatial, {
    kind: "add",
    id: "house",
  });
  if (!added.ok) throw Error(added.message);
  edit.spatial = added.spatial;
  const house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
  edit = updateStudioHouse(edit, { ...house, widthMm: "8000" });
  edit = previewStudioAttachment(addWebsitePergola(edit, "p"), {
    objectId: "p",
    houseId: "house",
    edge: "rear",
    kind: "eave",
    method: "soffit",
  });
  const value = structuredClone(websiteComposition(edit)[0].value!);
  value.selection.roof.blinds = [defaultBlind("front-1of2")];
  edit = changeStudioProduct(edit, value);
  expect(websiteComposition(edit)[0].error).toBeNull();
  value.rawDimensions.widthMm = "3900";
  edit = changeStudioProduct(edit, value);
  expect(websiteComposition(edit)[0].error).toContain(
    "Blind front-1of2 unavailable",
  );
  const snapshot = structuredClone(edit),
    scope = {
      actorId: "actor",
      projectId: "project",
      estimateId: "blind-estimate",
      designId: edit.designId,
    };
  sessionStorage.clear();
  sessionStorage.setItem(
    studioHouseContextKey(scope),
    JSON.stringify({
      selected: "p",
      mode: "options",
      section: "Shape",
      view: "Plan",
    }),
  );
  const controller = {
    edit,
    authoredIdentity: testIdentity(edit),
    change: vi.fn(),
    canEdit: true,
    canSave: false,
    session: { dirty: true, baselinePergolaIds: ["p"] },
    save: vi.fn(),
  };
  const m = renderIntoDocument(
    <StudioHouseWorkspace
      controller={controller as any}
      scope={scope}
      versionLabel="V7"
    />,
  );
  expect(m.container.textContent).not.toContain("Connection needs repair");
  expect(m.container.textContent).not.toContain("Check connection");
  await act(async () => {
    [...m.container.querySelectorAll("button")]
      .find((b) => b.textContent === "Check sides")!
      .click();
    await new Promise((r) => setTimeout(r, 35));
  });
  expect(m.container.querySelector('[data-section="Sides"]')).toBeTruthy();
  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "Retained unavailable blinds",
  );
  expect(controller.change).not.toHaveBeenCalled();
  expect(edit).toEqual(snapshot);
  expect(observed.scene.view).toBe("Plan");
  m.unmount();
});

it("retires unrelated repair context on explicit object selection, retaining the actual destination label", async () => {
  let edit: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "repair-selection",
    revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  const added = applyStudioHouseEdit(edit.spatial, {
    kind: "add",
    id: "house",
  });
  if (!added.ok) throw Error(added.message);
  edit.spatial = retainedHistoricalHouse(added.spatial);
  edit = previewStudioAttachment(addWebsitePergola(edit, "p"), {
    objectId: "p",
    houseId: "house",
    edge: "rear",
    kind: "eave",
    method: "soffit",
  });
  const value = structuredClone(websiteComposition(edit)[0].value!);
  value.selection.roof.finish = {
    ...DEFAULT_ROOF_FINISH,
    material: "combination",
    ceiling: "thermopine-150",
  };
  edit = addWebsitePergola(changeStudioProduct(edit, value), "second");
  const scope = {
    actorId: "actor",
    projectId: "project",
    estimateId: "context-estimate",
    designId: edit.designId,
  };
  sessionStorage.clear();
  sessionStorage.setItem(
    studioHouseContextKey(scope),
    JSON.stringify({
      selected: "p",
      mode: "position",
      section: "Shape",
      view: "Plan",
    }),
  );
  const controller = {
      edit,
      authoredIdentity: testIdentity(edit),
      change: vi.fn(),
      canEdit: true,
      canSave: false,
      session: { dirty: true, baselinePergolaIds: ["p"] },
      save: vi.fn(),
    },
    m = renderIntoDocument(
      <StudioHouseWorkspace
        controller={controller as any}
        scope={scope}
        versionLabel="V7"
      />,
    );
  const click = (text: string) =>
    act(() => {
      [...m.container.querySelectorAll("button")]
        .find((b) => b.textContent === actionLabel(text))!
        .click();
    });
  click("Change");
  click("Check house dimensions");
  expect(m.container.textContent).toContain("Return to Pergola 1 · Shape");
  expect(observed.scene.repairTarget).toBeTruthy();
  click("Pergola 2");
  expect(m.container.textContent).not.toContain("Return to Pergola 1");
  expect(observed.scene.repairTarget).toBeFalsy();
  expect(observed.scene.view).toBe("Plan");
  expect(controller.change).not.toHaveBeenCalled();
  m.unmount();
});
