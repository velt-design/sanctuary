import { describe, expect, it } from "vitest";
import { makeObjectFirstWorkbenchProjectFixture } from "./objectFirstWorkbenchFixtures";
import { buildObjectWorkbenchStatusFacade } from "./objectWorkbenchStatusModel";

describe("buildObjectWorkbenchStatusFacade", () => {
  it("keeps selected house status null when no house form is selected", () => {
    const projectModel =
      makeObjectFirstWorkbenchProjectFixture("separate_forms");

    const status = buildObjectWorkbenchStatusFacade({
      activeDeckId: null,
      activeHouseFormId: null,
      activeModuleInput: undefined,
      projectModel,
    });

    expect(Object.keys(status.houseFormsById)).toEqual(["form-a", "form-b"]);
    expect(status.selectedHouseFormId).toBeNull();
    expect(status.selectedHouseFormStatus).toBeNull();
    expect(status.houseForm).toBeNull();
  });

  it("keeps selected house status null for an invalid house id", () => {
    const projectModel =
      makeObjectFirstWorkbenchProjectFixture("separate_forms");

    const status = buildObjectWorkbenchStatusFacade({
      activeDeckId: null,
      activeHouseFormId: "missing-house",
      activeModuleInput: undefined,
      projectModel,
    });

    expect(status.selectedHouseFormId).toBeNull();
    expect(status.selectedHouseFormStatus).toBeNull();
    expect(status.houseForm).toBeNull();
  });

  it("resolves selected status by house form id without borrowing another form", () => {
    const projectModel =
      makeObjectFirstWorkbenchProjectFixture("separate_forms");
    const houseOne = projectModel.houseAssembly?.houseForms[0];
    const houseTwo = projectModel.houseAssembly?.houseForms[1];
    if (!houseOne || !houseTwo) throw new Error("Expected two house forms.");
    houseOne.footprint.preset = "straight";
    houseOne.roofIntent = { ...houseOne.roofIntent, form: "mono" };
    houseOne.roofIntentAuthored = true;
    houseTwo.footprint.preset = "wrap_right";
    houseTwo.roofIntent = { ...houseTwo.roofIntent, form: "hipped" };

    const houseOneStatus = buildObjectWorkbenchStatusFacade({
      activeDeckId: null,
      activeHouseFormId: houseOne.id,
      activeModuleInput: undefined,
      projectModel,
    });
    const houseTwoStatus = buildObjectWorkbenchStatusFacade({
      activeDeckId: null,
      activeHouseFormId: houseTwo.id,
      activeModuleInput: undefined,
      projectModel,
    });

    expect(houseOneStatus.selectedHouseFormId).toBe(houseOne.id);
    expect(houseOneStatus.selectedHouseFormStatus).toEqual(
      houseOneStatus.houseFormsById[houseOne.id],
    );
    expect(houseOneStatus.selectedHouseFormStatus).toMatchObject({
      footprintPreset: "straight",
      roofForm: "mono",
    });
    expect(houseTwoStatus.selectedHouseFormId).toBe(houseTwo.id);
    expect(houseTwoStatus.selectedHouseFormStatus).toEqual(
      houseTwoStatus.houseFormsById[houseTwo.id],
    );
    expect(houseTwoStatus.selectedHouseFormStatus).toMatchObject({
      footprintPreset: "wrap_right",
      roofForm: "hipped",
    });
  });

  it("reports unauthored mono as repaired to the canonical house roof default", () => {
    const projectModel =
      makeObjectFirstWorkbenchProjectFixture("separate_forms");
    const houseOne = projectModel.houseAssembly?.houseForms[0];
    if (!houseOne) throw new Error("Expected house form.");
    houseOne.roofIntent = { ...houseOne.roofIntent, form: "mono" };
    delete houseOne.roofIntentAuthored;

    const status = buildObjectWorkbenchStatusFacade({
      activeDeckId: null,
      activeHouseFormId: houseOne.id,
      activeModuleInput: undefined,
      projectModel,
    });

    expect(status.selectedHouseFormStatus?.roofForm).toBe("hipped");
    expect(status.selectedHouseFormStatus?.roof).toMatchObject({
      form: "hipped",
      rawForm: "mono",
      resolvedForm: "hipped",
      roofIntentAuthored: false,
      resolutionSource: "object_first_unauthed_mono_repair",
      repairCode: "unauthed_mono_repaired_to_hipped",
    });
  });

  it("validates multi-house preset roofs against each form's resolved geometry", () => {
    const projectModel =
      makeObjectFirstWorkbenchProjectFixture("separate_forms");
    const houseOne = projectModel.houseAssembly?.houseForms[0];
    const houseTwo = projectModel.houseAssembly?.houseForms[1];
    if (!houseOne || !houseTwo) throw new Error("Expected two house forms.");
    houseOne.footprint = {
      ...houseOne.footprint,
      mode: "preset",
      preset: "straight",
      polygon: [],
    };
    houseOne.roofIntent = { ...houseOne.roofIntent, form: "hipped" };
    houseOne.roofIntentAuthored = true;
    houseTwo.footprint = {
      ...houseTwo.footprint,
      mode: "preset",
      preset: "straight",
      polygon: [],
    };
    houseTwo.roofIntent = { ...houseTwo.roofIntent, form: "hipped" };
    houseTwo.roofIntentAuthored = true;

    const status = buildObjectWorkbenchStatusFacade({
      activeDeckId: null,
      activeHouseFormId: houseOne.id,
      activeModuleInput: undefined,
      projectModel,
    });

    expect(status.houseFormsById[houseOne.id]?.roof).toMatchObject({
      form: "hipped",
      validationStatus: "valid",
      validationCode: null,
    });
    expect(status.houseFormsById[houseTwo.id]?.roof).toMatchObject({
      form: "hipped",
      validationStatus: "valid",
      validationCode: null,
    });
  });

  it("marks repaired narrow custom hipped roofs as approximate from package QA metadata", () => {
    const projectModel =
      makeObjectFirstWorkbenchProjectFixture("separate_forms");
    const houseOne = projectModel.houseAssembly?.houseForms[0];
    if (!houseOne) throw new Error("Expected house form.");
    houseOne.footprint = {
      ...houseOne.footprint,
      mode: "custom_polygon",
      preset: "recess_left",
      polygon: [
        { alongM: "0", depthM: "0" },
        { alongM: "6", depthM: "0" },
        { alongM: "6", depthM: "8" },
        { alongM: "3.9", depthM: "8" },
        { alongM: "3.9", depthM: "10" },
        { alongM: "3.6", depthM: "10" },
        { alongM: "3.6", depthM: "8" },
        { alongM: "0", depthM: "8" },
      ],
    };
    houseOne.roofIntent = {
      ...houseOne.roofIntent,
      form: "hipped",
      primaryPitchDeg: "5",
      ridgeAxis: "x",
      openGableEndIds: [],
    };
    houseOne.roofIntentAuthored = true;
    houseOne.eaveOverhangMm = "450";

    const status = buildObjectWorkbenchStatusFacade({
      activeDeckId: null,
      activeHouseFormId: houseOne.id,
      activeModuleInput: undefined,
      projectModel,
    });

    expect(status.selectedHouseFormStatus?.roof).toMatchObject({
      form: "hipped",
      validationStatus: "approximate",
      validationCode: null,
      approximationReasons: ["eave_offset_repaired"],
    });
  });
});
