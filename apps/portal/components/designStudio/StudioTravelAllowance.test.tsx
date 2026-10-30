import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import StudioTravelAllowance from "./StudioTravelAllowance";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import type { StudioSelectedAddressProof } from "@/lib/designStudio/studioTravelAllowance";
import {studioPendingTravelAllowance} from '@/lib/designStudio/studioTravelPlan';
import {ACCESSORY_REVIEW_RATES,getDefaultInstalledSellingRates,loadCostingConfigV1} from '@sp/costing';
import {prepareStudioCreation} from '@/lib/designStudio/createPreparation';
import {projectStudioAuthoringView,createStudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import {addWebsitePergola} from '@/lib/designStudio/websiteComposition';
import {calculateStudioCommercialPricing} from '@/lib/designStudio/studioCommercialPricing.server';
import {studioInstallationEstimate} from '@/lib/designStudio/studioInstallationEstimate';
import type {StudioWebsiteDesign} from '@/lib/designStudio/websiteDesign';
import {
  signStudioTravelReceipt,
  verifyStudioTravelAmount,
} from "@/lib/designStudio/studioTravelReceipt.server";
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/repo/apiClient", () => ({ apiJson: mocks.api }));
const projectId = "proj_fixture",
  receipt = {
    schemaVersion: "studio_travel_receipt.v1",
    policyVersion: "studio-travel-local.v1",
    base: "71G Montgomerie Rd, Mangere, Auckland",
    projectId,
    destinationCanonical: "12 Example Road, Auckland 1010",
    placeId: "fixture_place",
    drivingCostPerRoundTripCents: 15000,
    overnightEligible: false,
    proof: "a".repeat(64),
  };
const proof = {
  schemaVersion: "studio_selected_address.v1",
  projectId,
  destinationCanonical: receipt.destinationCanonical,
  placeId: "fixture_place",
  issuedAt: 1,
  proof: "b".repeat(64),
} as StudioSelectedAddressProof;
const mounts: ReturnType<typeof renderIntoDocument>[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  process.env.STUDIO_TRAVEL_SIGNING_KEY = "ab".repeat(32);
  Object.assign(receipt, signStudioTravelReceipt(receipt));
  mocks.api.mockResolvedValue({
    receipt,
    selectedAddressProof: proof,
    outboundSeconds: 3600,
    returnSeconds: 3600,
  });
});
it.each([
  ["Planned return trips", "1.5"],
  ["Planned return trips", ""],
  ["Planned return trips", "0"],
  ["Planned nights away", ""],
  ["Planned nights away", "1.5"],
  ["Planned nights away", "-1"],
  ["Planned nights away", "abc"],
])(
  "invalid raw %s draft %j immediately fences real financial authority and valid blur recovers",
  async (label, value) => {
    const m = await mount(proof, "pending");
    await act(async () => m.rerender());
    const verify = () =>
      verifyStudioTravelAmount(
        m.get().site,
        projectId,
        receipt.destinationCanonical,
      );
    expect(verify()).toBe(receipt.destinationCanonical);
    const input = m.container.querySelector(`input[aria-label="${label}"]`)!;
    async function type(value: string) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    await type(value);
    // No blur or rerender: this is the actual edit supplied to the existing price/preparation owner.
    expect(verify).toThrow();
    expect(m.get().site.travelExGst).toBe("150.00");
    expect(m.get().site.travelAllowance).toMatchObject(
      label === "Planned return trips"
        ? { plannedRoundTrips: value }
        : { plannedNights: value },
    );
    await act(async () => m.rerender());
    expect(m.container.querySelector(`input[aria-label="${label}"]`)).toBe(
      input,
    );
    expect((input as HTMLInputElement).value).toBe(value);
    expect(m.container.textContent).not.toContain("Retry travel");
    await click(m, "Recalculate travel");
    expect(mocks.api).toHaveBeenCalledOnce();
    expect(verify).toThrow();
    await type("2");
    await act(async () =>
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
    );
    expect(verify()).toBe(receipt.destinationCanonical);
    expect(m.get().site.travelExGst).toBe(
      label === "Planned return trips" ? "300.00" : "750.00",
    );
    expect(mocks.api).toHaveBeenCalledOnce();
  },
);
afterEach(() => {
  mounts.splice(0).forEach((m) => m.unmount());
});
async function mount(
  selected: StudioSelectedAddressProof | null = null,
  mode = "manual",
  savedSite?: StudioAuthoringEdit["site"],
  siteDays: number | null = 1,
) {
  let edit = {
      site: {
        travelExGst: "435.50",
        travelAllowance: { mode },
        siteAddressProof: selected,
        ...savedSite,
      },
    } as unknown as StudioAuthoringEdit,
    allowed = true;
  const change = vi.fn((next: StudioAuthoringEdit) => {
    edit = next;
  });
  const m = renderIntoDocument(
    <StudioTravelAllowance
      projectId={projectId}
      edit={edit}
      disabled={false}
      siteDays={siteDays}
      selected={selected}
      getCurrent={() => (allowed ? edit : null)}
      onChange={change}
      onDerivedChange={change}
    />,
  );
  mounts.push(m);
  await act(async () => {});
  return {
    ...m,
    change,
    get: () => edit,
    deny: () => {
      allowed = false;
    },
    rerender: (nextDays=siteDays) => {
      siteDays=nextDays;
      return m.rerender(
        <StudioTravelAllowance
          projectId={projectId}
          edit={edit}
          disabled={false}
          siteDays={siteDays}
          selected={selected}
          getCurrent={() => (allowed ? edit : null)}
          onChange={change}
          onDerivedChange={change}
        />,
      );
    },
  };
}
async function click(m: Awaited<ReturnType<typeof mount>>, text: string) {
  await act(async () =>
    [...m.container.querySelectorAll("button")]
      .find((b) => b.textContent === text)!
      .click(),
  );
}
async function typePlan(m:Awaited<ReturnType<typeof mount>>,label:string,value:string){
 const input=m.container.querySelector(`input[aria-label="${label}"]`)!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>input.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));
 await act(async()=>m.rerender());
}
it('uses canonical 6×4 installation days in the actual field, follows changed estimates, and preserves an explicit override until Use site days',async()=>{
 const made=prepareStudioCreation({mode:'blank',projectId:'proj_10000000-0000-4000-8000-000000000001',designId:'field-days',commercialScopeId:null});if(!made.ok)throw Error(made.message);
 const outputs=made.prepared.row.outputs,view=projectStudioAuthoringView({authored:outputs.studio_authored,spatial:outputs.drawing_object_first});if(!view.ok)throw Error(view.message);
 const edit=addWebsitePergola(createStudioAuthoringEdit(view.value),'p');(edit.objectOptions[0].values.websiteDesign as unknown as StudioWebsiteDesign).rawDimensions={widthMm:'6000',projectionMm:'4000'};
 const config={...loadCostingConfigV1(),accessoryRates:ACCESSORY_REVIEW_RATES,installedSellingRates:getDefaultInstalledSellingRates()};
 const days=studioInstallationEstimate(calculateStudioCommercialPricing(edit,config).siteOutput)!.siteDays;expect(days).toBe(3);
 const m=await mount(proof,'pending',undefined,days);await act(async()=>m.rerender());
 expect(m.get().site.travelAllowance).toMatchObject({plannedRoundTrips:'3',tripCountSource:'site_days'});expect(m.get().site.travelExGst).toBe('450.00');
 await act(async()=>m.rerender(4));expect(m.get().site.travelAllowance).toMatchObject({plannedRoundTrips:'4'});expect(m.get().site.travelExGst).toBe('600.00');
 await act(async()=>m.rerender());await typePlan(m,'Planned return trips','2');
 await act(async()=>m.rerender(5));expect(m.get().site.travelAllowance).toMatchObject({plannedRoundTrips:'2',tripCountSource:'manual'});expect(m.get().site.travelExGst).toBe('300.00');
 await click(m,'Use site days (5)');expect(m.get().site.travelAllowance).toMatchObject({plannedRoundTrips:'5',tripCountSource:'site_days'});expect(m.get().site.travelExGst).toBe('750.00');
 expect(mocks.api).toHaveBeenCalledOnce();
});
it('requires one explicit legacy choice without silently changing an old default or frozen input',async()=>{
 const legacy={mode:'automatic',receipt,plannedRoundTrips:'1',plannedNights:'0'},original=structuredClone(legacy);
 const m=await mount(null,'automatic',{travelAllowance:legacy,travelExGst:'150.00'},3);
 expect(m.change).not.toHaveBeenCalled();expect(legacy).toEqual(original);expect(m.container.textContent).toContain('Confirm return trips');
 expect((m.container.querySelector('input') as HTMLInputElement).value).toBe('');
 await click(m,'Keep existing trips');expect(m.get().site.travelAllowance).toMatchObject({tripCountSource:'manual',plannedRoundTrips:'1'});
 await act(async()=>m.rerender());await click(m,'Use site days (3)');expect(m.get().site.travelExGst).toBe('450.00');
});
it('never shows a verified one-trip daily allowance while the fresh site-day estimate is missing',async()=>{
 const m=await mount(proof,'pending',undefined,null);await act(async()=>m.rerender());
 expect(m.get().site.travelAllowance).toMatchObject({tripCountSource:'site_days',plannedRoundTrips:''});
 expect((m.container.querySelector('input[aria-label="Travel cost excluding GST"]') as HTMLInputElement).value).toBe('');
 expect(m.get().site.travelExGst).toBe('435.50');
 await act(async()=>m.rerender(3));expect(m.get().site.travelAllowance).toMatchObject({plannedRoundTrips:'3'});expect(m.get().site.travelExGst).toBe('450.00');
 expect(mocks.api).toHaveBeenCalledOnce();
});
it('keeps malformed persisted travel editable when fresh positive day metadata arrives, preserving financial refusal until manual recovery',async()=>{
 const m=await mount(null,'manual',{travelAllowance:{mode:'automatic',broken:true},travelExGst:'435.50'},3);
 expect(()=>verifyStudioTravelAmount(m.get().site,projectId,receipt.destinationCanonical)).toThrow();
 expect(m.change).not.toHaveBeenCalled();
 const input=m.container.querySelector('input[aria-label="Travel cost excluding GST"]') as HTMLInputElement;
 expect(input.readOnly).toBe(false);expect(input.disabled).toBe(false);
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'80');input.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(m.get().site).toMatchObject({travelAllowance:{mode:'manual'},travelExGst:'80'});
 expect(verifyStudioTravelAmount(m.get().site,projectId,receipt.destinationCanonical)).toBeNull();
 expect(mocks.api).not.toHaveBeenCalled();
});
it('keeps actual overnight journeys separate and restores derived daily journeys when nights return to zero',async()=>{
 const m=await mount(proof,'pending',undefined,3);await act(async()=>m.rerender());
 await typePlan(m,'Planned nights away','2');expect(m.get().site.travelAllowance).toMatchObject({tripCountSource:'overnight',plannedRoundTrips:'1',plannedNights:'2'});expect(m.get().site.travelExGst).toBe('750.00');
 await typePlan(m,'Planned nights away','0');expect(m.get().site.travelAllowance).toMatchObject({tripCountSource:'site_days',plannedRoundTrips:'3'});expect(m.get().site.travelExGst).toBe('450.00');
 await typePlan(m,'Planned return trips','2');await typePlan(m,'Planned nights away','2');await typePlan(m,'Planned nights away','0');expect(m.get().site.travelAllowance).toMatchObject({tripCountSource:'manual',plannedRoundTrips:'2'});
 // The address picker retains plan intent, while its old route authority is discarded.
 const pending=studioPendingTravelAllowance(m.get().site.travelAllowance);expect(pending).not.toHaveProperty('receipt');
 m.change({...m.get(),site:{...m.get().site,travelAllowance:pending}});await act(async()=>m.rerender());await click(m,'Calculate travel');
 expect(m.get().site.travelAllowance).toMatchObject({tripCountSource:'manual',plannedRoundTrips:'2'});
});
it("retains manual amount on mount and makes no Google request", async () => {
  const m = await mount();
  expect(mocks.api).not.toHaveBeenCalled();
  expect((m.container.querySelector("input") as HTMLInputElement).value).toBe(
    "435.50",
  );
  expect(m.change).not.toHaveBeenCalled();
});
it("reloads own base/unit-cost formula without retained route metrics and recalculates after manual override using saved address proof", async () => {
  const m = await mount(null, "manual", {
    travelExGst: "1200.00",
    siteAddressProof: proof,
    travelAllowance: {
      mode: "automatic",
      receipt,
      plannedRoundTrips: "2",
      plannedNights: "3",
    },
  });
  expect(mocks.api).not.toHaveBeenCalled();
  expect(m.container.textContent).toContain(
    "From 71G Montgomerie Rd, Mangere, Auckland",
  );
  expect(m.container.textContent).toContain(
    "$150.00 × 2 return trips + $300 × 3 nights",
  );
  expect(m.container.textContent).not.toContain("Driving:");
  await click(m, "Enter manually");
  await act(async () => m.rerender());
  expect(m.get().site.siteAddressProof).toEqual(proof);
  await click(m, "Calculate travel");
  expect(JSON.parse(mocks.api.mock.calls[0][1].body)).toMatchObject({
    selectedAddressProof: proof,
  });
});
it("calculates on selected address, changes only the existing allowance and own basis", async () => {
  const m = await mount(proof, "pending");
  expect(mocks.api).toHaveBeenCalledOnce();
  expect(m.get().site.travelExGst).toBe("150.00");
  expect(m.get().site.travelAllowance).toMatchObject({
    mode: "automatic",
    plannedRoundTrips: "1",
    plannedNights: "0",
  });
  await act(async () => m.rerender());
  expect(m.container.textContent).toContain("Calculated allowance");
  await click(m, "Enter manually");
  expect(m.get().site.travelAllowance).toEqual({ mode: "manual" });
  expect(m.get().site.siteAddressProof).toEqual(proof);
  expect(m.get().site.travelExGst).toBe("150.00");
});
it("requires an explicit night choice on a long outward route without treating blank as zero", async () => {
  mocks.api.mockResolvedValue({
    receipt: { ...receipt, overnightEligible: true },
    outboundSeconds: 6301,
    returnSeconds: 3600,
  });
  const m = await mount(proof, "pending");
  expect(m.get().site.travelAllowance).toMatchObject({ plannedNights: "" });
  expect(m.get().site.travelExGst).toBe("435.50");
  await act(async () => m.rerender());
  expect(m.container.textContent).toContain("Decision needed");
  expect(m.container.textContent).not.toContain("Calculated allowance");
  expect(
    (
      m.container.querySelector(
        'input[aria-label="Travel cost excluding GST"]',
      ) as HTMLInputElement
    ).value,
  ).toBe("");
  expect(
    (
      m.container.querySelector(
        'input[aria-label="Planned nights away"]',
      ) as HTMLInputElement
    ).getAttribute("aria-invalid"),
  ).toBe("true");
});
it("does not apply a deferred result after current edit authority ends", async () => {
  let resolve!: (value: unknown) => void;
  mocks.api.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const m = await mount(proof, "pending");
  m.deny();
  await act(async () =>
    resolve({ receipt, outboundSeconds: 3600, returnSeconds: 3600 }),
  );
  expect(m.change).not.toHaveBeenCalled();
});
it("updates whole-trip/night plans on blur from signed own financial unit cost without another Routes request", async () => {
  const m = await mount(proof, "pending");
  await act(async () => m.rerender());
  async function edit(label: string, value: string) {
    const input = m.container.querySelector(`input[aria-label="${label}"]`)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
    );
    await act(async () => m.rerender());
  }
  await edit("Planned return trips", "2");
  await edit("Planned nights away", "3");
  expect(m.get().site.travelExGst).toBe("1200.00");
  expect(mocks.api).toHaveBeenCalledOnce();
  await edit("Planned return trips", "1.5");
  expect(m.get().site.travelExGst).toBe("1200.00");
  expect(m.container.textContent).toContain("whole planned");
});
it("manual recovery cancels a pending route and refuses its late success", async () => {
  let resolve!: (value: unknown) => void;
  mocks.api.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const m = await mount(proof, "pending");
  await click(m, "Enter manually");
  expect(m.get().site.travelAllowance).toEqual({ mode: "manual" });
  await act(async () =>
    resolve({ receipt, outboundSeconds: 3600, returnSeconds: 3600 }),
  );
  expect(m.get().site.travelAllowance).toEqual({ mode: "manual" });
  expect(m.get().site.travelExGst).toBe("435.50");
});
it("keeps failure beside the field with retry and manual recovery", async () => {
  mocks.api.mockRejectedValueOnce(Error("Driving route unavailable"));
  const m = await mount(proof, "pending");
  expect(m.container.textContent).toContain("Driving route unavailable");
  expect(m.get().site.travelExGst).toBe("435.50");
  await click(m, "Retry travel");
  expect(mocks.api).toHaveBeenCalledTimes(2);
  expect(m.get().site.travelExGst).toBe("150.00");
});
