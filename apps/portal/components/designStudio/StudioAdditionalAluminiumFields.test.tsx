import { act, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import { studioWallAcquisitionFixture } from "../../../../test/studioWallAcquisitionFixture";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import { buildAdditionalAluminiumCatalogue } from "@/lib/costing/additionalAluminiumCatalogue";
import { loadCostingConfigV1, ACCESSORY_REVIEW_RATES } from "@sp/costing";
import { calculateStudioCommercialPricing } from "@/lib/designStudio/studioCommercialPricing.server";
import StudioCommercialFields from "./StudioCommercialFields";

const config = {
  ...loadCostingConfigV1(),
  accessoryRates: structuredClone(ACCESSORY_REVIEW_RATES),
};
let mounted: ReturnType<typeof renderIntoDocument> | undefined,
  latest: StudioAuthoringEdit;
const changed = vi.fn(),
  request = vi.fn();
beforeEach(() => {
  changed.mockReset();
  request.mockReset();
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  vi.unstubAllGlobals();
});
function open(initial = studioWallAcquisitionFixture(0, "front").edit) {
  function Harness() {
    const [edit, setEdit] = useState(initial);
    latest = edit;
    return (
      <StudioCommercialFields
        edit={edit}
        disabled={false}
        onChange={(next) => {
          changed(next);
          setEdit(next);
        }}
      />
    );
  }
  mounted = renderIntoDocument(<Harness />);
}
const field = (label: string) =>
  [...mounted!.container.querySelectorAll("label")]
    .find((node) => node.firstChild?.textContent === label)
    ?.querySelector<HTMLInputElement | HTMLSelectElement>("input,select")!;
const button = (label: string) =>
  [...mounted!.container.querySelectorAll("button")].find(
    (b) => b.textContent === label,
  )!;
function choose(label: string, value: string) {
  act(() => {
    const node = field(label);
    node.value = value;
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
const flush = () => act(async () => {});

it("discovers a profile and dependent length through the real Studio callbacks and current canonical White/Black pricing", async () => {
  request.mockResolvedValue({
    ok: true,
    json: async () => ({ items: buildAdditionalAluminiumCatalogue(config) }),
  });
  open();
  expect(changed).not.toHaveBeenCalled();
  act(() => button("Add aluminium").click());
  await flush();
  expect(field("Profile").tagName).toBe("SELECT");
  expect(
    [...field("Profile").querySelectorAll("option")].some(
      (o) => o.value === "150x50",
    ),
  ).toBe(true);
  choose("Additional aluminium finish", "White");
  choose("Profile", "150x50");
  expect(field("Stock length (m)").value).toBe("4");
  choose("Stock length (m)", "6");
  const priced = calculateStudioCommercialPricing(latest, config);
  expect(priced.amount).toBeGreaterThan(0);
  expect(priced.siteInputs.additional_aluminium).toMatchObject({
    extrusion_colour: "White",
    rows: [{ profile: "150x50", stock_length_m: 6, quantity: 1 }],
  });
  expect(priced.customerStandaloneSelections).toContainEqual({
    label: "Standalone aluminium · 150x50",
    details: ["White aluminium", "1 full 6 m bar"],
  });
  choose("Additional aluminium finish", "Black");
  expect(
    calculateStudioCommercialPricing(latest, config).amount,
  ).toBeGreaterThan(0);
  expect(request).toHaveBeenCalledWith(
    "/api/staff/costing/v1/aluminium-catalogue",
    expect.objectContaining({ cache: "no-store" }),
  );
  expect(request).toHaveBeenCalledOnce();
});

it("keeps exact historical rows and all other scope through loading, failure, Retry and deliberate replacement/removal", async () => {
  const initial = studioWallAcquisitionFixture(0, "front").edit;
  initial.site = {
    access: "hard",
    blinds: { items: [], legacy: "keep" },
    standaloneInfills: { items: [], extrusionColour: "White" },
    additionalAluminium: {
      extrusionColour: "Mill",
      powdercoatStandardColour: "Titania",
      powdercoatIsCustom: true,
      powdercoatCustomColour: "Custom kept",
      rows: [
        {
          id: "old",
          profile: "Historical section",
          stockLengthM: "6.50",
          quantity: " 2 ",
          note: "original",
        },
      ],
    },
  };
  request
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    })
    .mockResolvedValue({
      ok: true,
      json: async () => ({ items: buildAdditionalAluminiumCatalogue(config) }),
    });
  open(initial);
  expect(field("Profile").value).toBe("Historical section");
  expect(field("Stock length (m)").value).toBe("6.50");
  expect(field("Bars").value).toBe(" 2 ");
  expect(mounted!.container.textContent).toContain(
    "Loading aluminium profiles",
  );
  expect(changed).not.toHaveBeenCalled();
  await flush();
  expect(mounted!.container.textContent).toContain("Unauthorized");
  expect(latest).toEqual(initial);
  expect(field("Profile").disabled).toBe(true);
  act(() => button("Retry aluminium profiles").click());
  await flush();
  expect(mounted!.container.textContent).toContain(
    "not in the current catalogue",
  );
  expect(field("Profile").value).toBe("Historical section");
  expect(field("Stock length (m)").value).toBe("6.50");
  expect(changed).not.toHaveBeenCalled();
  choose("Profile", "150x50");
  const group = latest.site.additionalAluminium as any;
  expect(group.rows[0]).toEqual({
    id: "old",
    profile: "150x50",
    stockLengthM: "4",
    quantity: " 2 ",
    note: "original",
  });
  expect(group).toMatchObject({
    extrusionColour: "Mill",
    powdercoatStandardColour: "Titania",
    powdercoatIsCustom: true,
    powdercoatCustomColour: "Custom kept",
  });
  expect(latest.site.blinds).toEqual(initial.site.blinds);
  expect(latest.site.standaloneInfills).toEqual(initial.site.standaloneInfills);
  act(() => button("Remove item").click());
  expect((latest.site.additionalAluminium as any).rows).toEqual([]);
  expect(latest.deletions).toEqual([
    { scope: "site", collection: "additionalAluminium.rows", ids: ["old"] },
  ]);
  expect((latest.site.additionalAluminium as any).powdercoatCustomColour).toBe(
    "Custom kept",
  );
});

it.each([{ items: [] }, { items: [{ profile: "bad", stockLengthsM: ["6"] }] }])(
  "keeps rows untouched for an empty or malformed catalogue $items",
  async ({ items }) => {
    const initial = studioWallAcquisitionFixture(0, "front").edit;
    initial.site = {
      additionalAluminium: {
        extrusionColour: "White",
        rows: [
          {
            id: "saved",
            profile: "150x50",
            stockLengthM: "6.00",
            quantity: "1",
          },
        ],
      },
    };
    request.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    open(initial);
    await flush();
    expect(mounted!.container.querySelector('[role="alert"]')).toBeTruthy();
    expect(button("Retry aluminium profiles")).toBeTruthy();
    expect(field("Profile").value).toBe("150x50");
    expect(field("Stock length (m)").value).toBe("6.00");
    expect(latest).toEqual(initial);
    expect(changed).not.toHaveBeenCalled();
  },
);

it("aborts a retired view request and ignores its late reply after a fresh view loads", async () => {
  let finish!: (value: unknown) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const initial = studioWallAcquisitionFixture(0, "front").edit;
  initial.site = {
    additionalAluminium: {
      rows: [
        { id: "kept", profile: "150x50", stockLengthM: "6", quantity: "1" },
      ],
    },
  };
  open(initial);
  const signal = request.mock.calls[0][1].signal as AbortSignal;
  mounted!.unmount();
  mounted = undefined;
  expect(signal.aborted).toBe(true);
  request.mockResolvedValue({
    ok: true,
    json: async () => ({ items: buildAdditionalAluminiumCatalogue(config) }),
  });
  open(initial);
  await flush();
  await act(async () =>
    finish({
      ok: true,
      json: async () => ({
        items: [{ profile: "obsolete", stockLengthsM: [9] }],
      }),
    }),
  );
  expect(
    [...field("Profile").querySelectorAll("option")].map((o) => o.value),
  ).toContain("150x50");
  expect(
    [...field("Profile").querySelectorAll("option")].map((o) => o.value),
  ).not.toContain("obsolete");
  expect(changed).not.toHaveBeenCalled();
});

it("retains numeric raw spelling without passive edits and leaves finish-specific refusal with canonical pricing", async () => {
  const initial = studioWallAcquisitionFixture(0, "front").edit;
  initial.site = {
    additionalAluminium: {
      extrusionColour: "White",
      rows: [
        { id: "saved", profile: "150x50", stockLengthM: "6.00", quantity: "1" },
      ],
    },
  };
  request.mockResolvedValue({
    ok: true,
    json: async () => ({ items: buildAdditionalAluminiumCatalogue(config) }),
  });
  open(initial);
  await flush();
  expect(field("Stock length (m)").value).toBe("6.00");
  expect(changed).not.toHaveBeenCalled();
  expect(
    calculateStudioCommercialPricing(latest, config).amount,
  ).toBeGreaterThan(0);
  const unavailable = {
    ...config,
    materials: {
      ...config.materials,
      items: config.materials.items.filter((item) => {
        const a = item.attributes as any;
        return !(
          item.category === "aluminium_extrusion" &&
          a?.profile === "150x50" &&
          a?.colour === "White" &&
          a?.length_m === 6
        );
      }),
    },
  };
  expect(
    buildAdditionalAluminiumCatalogue(unavailable).some(
      (item) => item.profile === "150x50",
    ),
  ).toBe(true);
  expect(() => calculateStudioCommercialPricing(latest, unavailable)).toThrow();
  expect(mounted!.container.textContent).toContain(
    "Finish and powdercoat availability are checked in the current price",
  );
});
