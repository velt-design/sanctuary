import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from "@/lib/drawings/state/objectFirstWorkbenchModel";
import { applyStudioHouseEdit } from "@/lib/designStudio/houseEditing";
import { studioHouseScene } from "@/lib/designStudio/studioHouseScene";
import { updateStudioHouse } from "@/lib/designStudio/studioHouseCommands";
import { createStudioSceneResolver } from "@/lib/designStudio/interaction/resolvedScene";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import type { StudioAuthoredIdentity } from "@/lib/designStudio/interaction/contracts";
import { useStudioHouseDraft } from "./useStudioHouseDraft";
import StudioHouseInspector from "./StudioHouseInspector";
import * as houseGeometry from '@/lib/designStudio/studioHouseGeometry';
const scope = {
  actorId: "actor",
  projectId: "project",
  estimateId: "estimate",
  designId: "house-owner",
};
const key = (revision = 1) =>
  `actor:project:estimate:house-owner:${revision}:studio-house-pending`;
let latest: ReturnType<typeof useStudioHouseDraft>,
  mounted: ReturnType<typeof renderIntoDocument>;
let current: StudioAuthoringEdit,
  identity: StudioAuthoredIdentity,
  refuse = false;
const resolver = createStudioSceneResolver();
function initial() {
  const edit: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: scope.designId,
    revision: 1,
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
  return edit;
}
function Harness({
  epoch = identity.epoch,
  selected = "house",
  visible = true,
}: {
  epoch?: string;
  selected?: string;
  visible?: boolean;
}) {
  latest = useStudioHouseDraft({
    edit: current,
    resolved: resolver.resolve(current),
    selected,
    scope,
    identity: { ...identity, epoch },
    apply: (create, accepted) => {
      if (refuse) return;
      current = create(current);
      identity = { ...identity, generation: identity.generation + 1 };
      accepted(current);
    },
  });
  return visible ? (
    <StudioHouseInspector owner={latest} applicationError={null} />
  ) : null;
}
const render = () => {
  mounted = renderIntoDocument(<Harness />);
};
const type = (raw: string) =>
  act(() => {
    const field = mounted.container.querySelector<HTMLInputElement>(
      'input[aria-label="Width (mm)"]',
    )!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(field, raw);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });

it("completes each house property without Apply and keeps unrelated invalid raw intent off the model", () => {
  render();
  type("-");
  const before = structuredClone(current);
  act(() => [...mounted.container.querySelectorAll("button")].find(b => b.textContent === "Flat")!.click());
  expect(studioHouseScene(current.site, current.spatial)!.houses[0].roof.form).toBe("flat");
  expect(studioHouseScene(current.site, current.spatial)!.houses[0].widthMm).toBe(studioHouseScene(before.site, before.spatial)!.houses[0].widthMm);
  expect(latest.currentHouse!.widthMm).toBe("-");
  expect(current.spatial).not.toEqual(before.spatial);
  type("7800");
  const width = mounted.container.querySelector<HTMLInputElement>('input[aria-label="Width (mm)"]')!;
  act(() => width.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", bubbles: true})));
  const generation = identity.generation;
  mounted.rerender(<Harness />);
  act(() => { width.focus(); width.blur(); });
  expect(studioHouseScene(current.site, current.spatial)!.houses[0].widthMm).toBe("7800");
  expect(identity.generation).toBe(generation);
  expect(latest.draft).toBeNull();
  expect(mounted.container.textContent).not.toContain("Apply house");
});
it('completes house materials without a shape solve, retains invalid raw dimensions and completes a colour only once',()=>{
  render();
  const walls=mounted.container.querySelector<HTMLSelectElement>('select[aria-label="House wall material"]');
  expect(walls).not.toBeNull();
  const solve=vi.spyOn(houseGeometry,'solveStudioHouse');
  act(()=>{walls!.value='weatherboard';walls!.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(current.spatial.houseAssembly!.houseForms[0].appearance?.wallMaterial).toBe('weatherboard');
  expect(solve).not.toHaveBeenCalled();
  const acceptedShape=structuredClone(current.spatial.houseAssembly!.houseForms[0].composition.primitives[0]);
  type('-');solve.mockClear();
  const colour=mounted.container.querySelector<HTMLInputElement>('input[aria-label="House roof colour HEX"]')!;
  const enter=(raw:string)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(colour,raw);colour.dispatchEvent(new Event('input',{bubbles:true}));colour.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});
  enter('#12');
  expect(current.spatial.houseAssembly!.houseForms[0].appearance).not.toHaveProperty('roofColour');
  expect(colour.getAttribute('aria-invalid')).toBe('true');
  enter('#506070');
  expect(current.spatial.houseAssembly!.houseForms[0].appearance?.roofColour).toBe('#506070');
  expect(latest.currentHouse!.widthMm).toBe('-');
  expect(current.spatial.houseAssembly!.houseForms[0].composition.primitives[0]).toEqual(acceptedShape);
  const generation=identity.generation;
  act(()=>{colour.focus();colour.blur();});
  expect(identity.generation).toBe(generation);
  expect(solve).not.toHaveBeenCalled();
  type('7100');
  act(()=>latest.complete('widthMm'));
  expect(solve).toHaveBeenCalled();
  expect(current.spatial.houseAssembly!.houseForms[0].composition.primitives[0]).toMatchObject({widthMm:7100});
});
it('does not author an absent appearance on focus/blur and fences an old material callback after target replacement',()=>{
  render();
  const colour=mounted.container.querySelector<HTMLInputElement>('input[aria-label="House roof colour HEX"]')!;
  act(()=>{colour.focus();colour.blur();});
  expect(current.spatial.houseAssembly!.houseForms[0]).not.toHaveProperty('appearance');
  expect(identity.generation).toBe(0);
  const complete=latest.complete;
  current=updateStudioHouse(current,{...studioHouseScene(current.site,current.spatial)!.houses[0],depthMm:'6500'});
  act(()=>complete('source.appearance.roofColour','#123456'));
  expect(latest.error).toContain('changed again');
  expect(current.spatial.houseAssembly!.houseForms[0]).not.toHaveProperty('appearance');
  expect(latest.draft!.source.appearance?.roofColour).toBe('#123456');
  mounted.rerender(<Harness epoch="replacement"/>);
  act(()=>complete('source.appearance.roofColour','#654321'));
  expect(current.spatial.houseAssembly!.houseForms[0]).not.toHaveProperty('appearance');
});
beforeEach(() => {
  sessionStorage.clear();
  current = initial();
  identity = { scopeKey: JSON.stringify(scope), epoch: "one", generation: 0 };
  refuse = false;
});
afterEach(() => {
  mounted?.unmount();
  vi.restoreAllMocks();
});
it("keeps raw fields, DOM identity, focus/caret and recovery through hidden form and revision-only rollover", () => {
  render();
  const field = mounted.container.querySelector<HTMLInputElement>(
    'input[aria-label="Width (mm)"]',
  )!;
  field.focus();
  type("76.");
  field.setSelectionRange(2, 2);
  expect(document.activeElement).toBe(field);
  expect(
    mounted.container.querySelector('input[aria-label="Width (mm)"]'),
  ).toBe(field);
  expect(field.selectionStart).toBe(2);
  const before = JSON.parse(sessionStorage.getItem(key())!);
  expect(before.draft.widthMm).toBe("76.");
  expect(before.basis.id).toBe("house");
  mounted.rerender(<Harness visible={false} />);
  mounted.rerender(<Harness />);
  expect(latest.currentHouse?.widthMm).toBe("76.");
  current = { ...current, revision: 2 };
  mounted.rerender(<Harness />);
  expect(latest.draft?.widthMm).toBe("76.");
  expect(JSON.parse(sessionStorage.getItem(key(2))!).draft.widthMm).toBe("76.");
  expect(sessionStorage.getItem(key())).toBeNull();
});
it("restores exact raw intent and completes only a deliberately reviewed field against the current target", () => {
  render();
  type("7654");
  const stored = sessionStorage.getItem(key())!;
  mounted.unmount();
  const house = studioHouseScene(current.site, current.spatial)!.houses[0];
  current = updateStudioHouse(current, { ...house, depthMm: "9000" });
  render();
  expect(latest.draft?.widthMm).toBe("7654");
  expect(latest.notice).toContain("house changed");
  expect(latest.preview.edit).toBeNull();
  const staleCommit = () => latest.complete("widthMm");
  const capturedComplete = latest.complete;
  current = updateStudioHouse(current, {
    ...studioHouseScene(current.site, current.spatial)!.houses[0],
    depthMm: "9500",
  });
  act(() => capturedComplete("widthMm"));
  expect(latest.error).toContain("changed again");
  expect(JSON.parse(sessionStorage.getItem(key())!).draft).toEqual(
    JSON.parse(stored).draft,
  );
  mounted.rerender(<Harness />);
  act(staleCommit);
  expect(
    studioHouseScene(current.site, current.spatial)!.houses[0].widthMm,
  ).toBe("7654");
  expect(latest.draft).toBeNull();
});
it("does not silently recertify an A-to-B-to-A target replacement or replace draft fields", () => {
  render();
  type("7654");
  const original = structuredClone(current),
    house = studioHouseScene(current.site, current.spatial)!.houses[0];
  current = updateStudioHouse(current, { ...house, depthMm: "9000" });
  mounted.rerender(<Harness />);
  current = original;
  mounted.rerender(<Harness />);
  expect(latest.notice).toContain("house changed");
  expect(latest.draft?.widthMm).toBe("7654");
});
it("retains a legacy payload byte-for-byte, labels its unknown basis and never rebinds a missing target", () => {
  const house = studioHouseScene(current.site, current.spatial)!.houses[0],
    raw = JSON.stringify({ ...house, widthMm: "8765" }, null, 2);
  sessionStorage.setItem(key(), raw);
  render();
  expect(sessionStorage.getItem(key())).toBe(raw);
  expect(latest.notice).toContain("unverified");
  current = {
    ...current,
    spatial: { ...current.spatial, houseAssembly: null },
  };
  mounted.rerender(<Harness />);
  expect(latest.missingTarget).toBe(true);
  act(() => latest.complete("widthMm"));
  expect(latest.draft?.widthMm).toBe("8765");
  expect(current.spatial.houseAssembly).toBeNull();
  expect(sessionStorage.getItem(key())).toBe(raw);
});
it("does not lose old recovery on failed rollover and fences a foreign epoch's effects", () => {
  render();
  type("7654");
  const old = sessionStorage.getItem(key());
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw Error("quota");
    });
  current = { ...current, revision: 2 };
  mounted.rerender(<Harness />);
  expect(latest.draft?.widthMm).toBe("7654");
  expect(sessionStorage.getItem(key())).toBe(old);
  write.mockRestore();
  mounted.rerender(<Harness epoch="foreign" />);
  expect(latest.draft).toBeNull();
  expect(sessionStorage.getItem(key())).toBe(old);
});
it("preserves draft on refusal and clears only local draft on discard", () => {
  render();
  type("7654");
  const original = structuredClone(current);
  refuse = true;
  act(() => latest.complete("widthMm"));
  expect(latest.draft?.widthMm).toBe("7654");
  expect(current).toEqual(original);
  act(() => latest.discard());
  expect(current).toEqual(original);
  expect(latest.draft).toBeNull();
  expect(sessionStorage.getItem(key())).toBeNull();
});
it("detaches a live foreign epoch at the same key while leaving its exact recovery available for a later reload", () => {
  render();
  const originalWidth=studioHouseScene(current.site,current.spatial)!.houses[0].widthMm;
  type("7654");
  const raw = sessionStorage.getItem(key());
  const oldCommit = () => complete("widthMm");
  const complete = latest.complete;
  mounted.rerender(<Harness epoch="foreign" />);
  expect(latest.draft).toBeNull();
  expect(sessionStorage.getItem(key())).toBe(raw);
  act(() => oldCommit());
  expect(latest.draft).toBeNull();
  expect(
    studioHouseScene(current.site, current.spatial)!.houses[0].widthMm,
  ).toBe(originalWidth);
  mounted.unmount();
  identity = { ...identity, epoch: "foreign" };
  render();
  expect(latest.draft?.widthMm).toBe("7654");
});
it("does not show another house's retained draft errors or Apply action in the current house form", () => {
  const added = applyStudioHouseEdit(current.spatial, {
    kind: "add",
    id: "second",
    label: "Second house",
  });
  if (!added.ok) throw Error(added.message);
  current = { ...current, spatial: added.spatial };
  const secondWidth=studioHouseScene(current.site,current.spatial)!.houses.find(h=>h.id==="second")!.widthMm;
  render();
  type("invalid-width");
  mounted.rerender(<Harness selected="second" />);
  const field = mounted.container.querySelector<HTMLInputElement>(
    'input[aria-label="Width (mm)"]',
  )!;
  expect(field.value).toBe(secondWidth);
  expect(field.getAttribute("aria-invalid")).not.toBe("true");
  expect(mounted.container.textContent).not.toContain("Apply house changes");
  expect(latest.draft?.id).toBe("house");
});

it("commits only rotation around invalid raw shape/source fields and keeps the accepted target as their basis", () => {
  render();
  const before = structuredClone(current), house = latest.currentHouse!;
  act(() => latest.replace({ ...house, widthMm: "invalid width", roof: { ...house.roof, form: "mono" }, source: { ...house.source, gutterDepthMm: "93." } }));
  act(() => latest.completeRotation("37"));
  const accepted = studioHouseScene(current.site, current.spatial)!.houses[0];
  expect(accepted.position.rotationDeg).toBe("37");
  expect(accepted.widthMm).toBe(house.widthMm);
  expect(accepted.roof.form).toBe(house.roof.form);
  expect(accepted.source.gutterDepthMm).toBe(house.source.gutterDepthMm);
  expect(latest.draft).toMatchObject({ widthMm: "invalid width", roof: { form: "mono" }, position: { rotationDeg: "37" }, source: { gutterDepthMm: "93." } });
  expect(JSON.parse(sessionStorage.getItem(key())!).basis).toEqual(current.spatial.houseAssembly!.houseForms[0]);
  expect(latest.notice).toBeNull();
  expect(latest.fieldErrors.widthMm).toContain("valid house width");
  act(() => latest.discard());
  expect(current).not.toEqual(before);
  expect(current.spatial.houseAssembly!.houseForms[0]).toEqual(JSON.parse(JSON.stringify(accepted.source)));
  expect(latest.draft).toBeNull();
});

it("keeps invalid or refused rotation raw without changing the model, and permits a later retry", () => {
  render();
  const before = structuredClone(current);
  for (const raw of ["", "-", "not an angle", "1e50"]) {
    act(() => latest.completeRotation(raw));
    expect(current).toEqual(before);
    expect(latest.draft!.position.rotationDeg).toBe(raw);
    expect(latest.fieldErrors.rotationDeg).toContain("valid house rotation");
  }
  refuse = true;
  act(() => latest.completeRotation("37"));
  expect(current).toEqual(before);
  expect(latest.draft!.position.rotationDeg).toBe("37");
  refuse = false;
  act(() => latest.completeRotation());
  expect(studioHouseScene(current.site, current.spatial)!.houses[0].position.rotationDeg).toBe("37");
  expect(latest.draft).toBeNull();
  expect(identity.generation).toBe(1);
});

it("completes a deliberately reviewed recovered field but never binds another or missing house", () => {
  const house = studioHouseScene(current.site, current.spatial)!.houses[0];
  const raw = JSON.stringify({ ...house, position: { ...house.position, rotationDeg: "37" } }, null, 2);
  sessionStorage.setItem(key(), raw);
  render();
  const before = structuredClone(current);
  act(() => latest.completeRotation());
  expect(studioHouseScene(current.site, current.spatial)!.houses[0].position.rotationDeg).toBe("37");
  expect(current).not.toEqual(before);
  expect(latest.draft).toBeNull();
  act(() => latest.discard());
  act(() => latest.replace({ ...house, position: { ...house.position, rotationDeg: "37" } }));
  current = updateStudioHouse(current, { ...house, widthMm: "7500" });
  mounted.rerender(<Harness />);
  const changed = structuredClone(current);
  act(() => latest.completeRotation());
  expect(studioHouseScene(current.site, current.spatial)!.houses[0].widthMm).toBe("7500");
  expect(studioHouseScene(current.site, current.spatial)!.houses[0].position.rotationDeg).toBe("37");
  expect(current).not.toEqual(changed);
  act(() => latest.replace({...latest.currentHouse!, widthMm: "invalid"}));
  const added = applyStudioHouseEdit(current.spatial, { kind: "add", id: "second", label: "Second" });
  if (!added.ok) throw Error(added.message);
  current = { ...current, spatial: added.spatial };
  mounted.rerender(<Harness selected="second" />);
  const retained = structuredClone(latest.draft);
  act(() => latest.completeRotation("90"));
  expect(latest.draft).toEqual(retained);
  expect(studioHouseScene(current.site, current.spatial)!.houses[1].position.rotationDeg).not.toBe("90");
  current = { ...current, spatial: { ...current.spatial, houseAssembly: null } };
  mounted.rerender(<Harness />);
  act(() => latest.completeRotation("90"));
  expect(latest.draft).toEqual(retained);
  expect(latest.missingTarget).toBe(true);
});

it("fences a stale completion before constructing rotation and never clears retained fields", () => {
  render();
  act(() => latest.replace({ ...latest.currentHouse!, widthMm: "7654" }));
  const complete = latest.completeRotation, retained = structuredClone(latest.draft);
  const house = studioHouseScene(current.site, current.spatial)!.houses[0];
  current = updateStudioHouse(current, { ...house, depthMm: "9500" });
  act(() => complete("37"));
  expect(latest.error).toContain("changed again");
  expect(studioHouseScene(current.site, current.spatial)!.houses[0].position.rotationDeg).toBe(house.position.rotationDeg);
  mounted.rerender(<Harness epoch="foreign" />);
  act(() => complete("90"));
  expect(latest.draft).toBeNull();
  expect(JSON.parse(sessionStorage.getItem(key())!).draft.widthMm).toBe(retained!.widthMm);
});

it("fences the dependent roof completion against target and epoch replacement without applying another raw field", () => {
  const initialHouse = studioHouseScene(current.site,current.spatial)!.houses[0];
  current=updateStudioHouse(current,{...initialHouse,roof:{...initialHouse.roof,form:"flat",pitchDeg:"0"}});
  render();
  act(()=>latest.replace({...latest.currentHouse!,widthMm:"-",roof:{...latest.currentHouse!.roof,form:"hipped",pitchDeg:"15"}}));
  const complete=latest.complete;
  current=updateStudioHouse(current,{...studioHouseScene(current.site,current.spatial)!.houses[0],depthMm:"9100"});
  const replaced=structuredClone(current);
  act(()=>complete("roof.pitchDeg","15"));
  expect(current).toEqual(replaced);expect(latest.error).toContain("changed again");
  expect(latest.draft).toMatchObject({widthMm:"-",roof:{form:"hipped",pitchDeg:"15"}});
  mounted.rerender(<Harness epoch="foreign"/>);
  act(()=>complete("roof.pitchDeg","15"));expect(current).toEqual(replaced);expect(latest.draft).toBeNull();
});
