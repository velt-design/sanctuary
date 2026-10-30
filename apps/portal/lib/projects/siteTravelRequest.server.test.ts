import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  read: vi.fn(),
  route: vi.fn(),
  validate: vi.fn(),
}));
vi.mock("@/lib/api/staffApi", () => ({
  requireStaffContext: mocks.auth,
  jsonOk: (body: unknown) => Response.json(body),
  jsonError: (error: string, status: number) =>
    Response.json({ error }, { status }),
}));
vi.mock("./siteAddress.server", () => ({ readProjectSiteAddress: mocks.read }));
vi.mock("./siteAddressProvider.server", () => ({
  googleSiteAddressProvider: () => ({ validateSelection: mocks.validate }),
}));
vi.mock("./siteTravelProvider.server", () => ({
  googleSiteTravelProvider: () => mocks.route,
}));
import { projectSiteTravelRequest } from "./siteTravelRequest.server";
import {
  signStudioSelectedAddress,
  signStudioTravelReceipt,
} from "@/lib/designStudio/studioTravelReceipt.server";
const projectId = "proj_10000000-0000-4000-8000-000000000001",
  destinationCanonical = "12 Example Road, Auckland 1010, New Zealand",
  placeId = "fixture_place";
function selected() {
  return signStudioSelectedAddress({
    projectId,
    destinationCanonical,
    placeId,
  });
}
function allowance() {
  return {
    mode: "automatic",
    receipt: signStudioTravelReceipt({
      projectId,
      destinationCanonical,
      placeId,
      drivingCostPerRoundTripCents: 7500,
      overnightEligible: false,
    }),
    plannedRoundTrips: "1",
    plannedNights: "0",
  };
}
const call = (body: unknown) =>
  projectSiteTravelRequest(
    new Request("http://localhost/site-travel", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    projectId,
  );
beforeEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
  process.env.ENABLE_PORTAL_DESIGN_STUDIO = "1";
  process.env.STUDIO_TRAVEL_SIGNING_KEY = "ab".repeat(32);
  mocks.auth.mockResolvedValue({
    ok: true,
    session: { role: "staff" },
    supabase: {},
  });
  mocks.read.mockResolvedValue({
    site_address: destinationCanonical,
    updated_at: "2026-10-28T01:00:00.123456Z",
  });
  mocks.route.mockResolvedValue({ outboundSeconds: 3600, returnSeconds: 1800 });
  mocks.validate.mockResolvedValue(destinationCanonical);
});
it.each([
  [6300, false],
  [6300.01, true],
])(
  "prompts nights only strictly above 105 minutes (%s)",
  async (outboundSeconds, overnightEligible) => {
    mocks.route.mockResolvedValue({ outboundSeconds, returnSeconds: 1800 });
    const response = await call({ selectedAddressProof: selected() }),
      result = await response.json();
    expect(response.status).toBe(200);
    expect(result.receipt.overnightEligible).toBe(overnightEligible);
    expect(result.receipt.drivingCostPerRoundTripCents).toBe(
      Math.round(((Number(outboundSeconds) + 1800) * 7500) / 3600),
    );
    expect(mocks.validate).not.toHaveBeenCalled();
    expect(mocks.auth.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.route.mock.invocationCallOrder[0],
    );
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(result.receipt).not.toHaveProperty("outboundSeconds");
  },
);
it("revalidates the saved signed PlaceID on explicit return calculation without requiring reselection", async () => {
  expect((await call({ allowance: allowance() })).status).toBe(200);
  expect(mocks.validate).toHaveBeenCalledOnce();
  expect(mocks.validate.mock.calls[0][0]).toMatchObject({
    placeId,
    address: destinationCanonical,
  });
  expect(mocks.validate.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.route.mock.invocationCallOrder[0],
  );
});
it("recovers after first-route failure/reload from pending PlaceID, treating stored fields as untrusted until fresh Details/AV", async () => {
  const body = {
    allowance: { mode: "pending", placeId, destinationCanonical },
  };
  expect((await call(body)).status).toBe(200);
  expect(mocks.validate).toHaveBeenCalledOnce();
  mocks.route.mockClear();
  mocks.validate.mockRejectedValueOnce(Error("Physical address not confirmed"));
  expect((await call(body)).status).toBe(422);
  expect(mocks.route).not.toHaveBeenCalled();
});
it.each(["Auckland", "PO Box 123, Auckland"])(
  "refuses unverified canonical free text before Routes: %s",
  async (site_address) => {
    mocks.read.mockResolvedValue({ site_address });
    expect((await call({})).status).toBe(422);
    expect(mocks.route).not.toHaveBeenCalled();
    expect(mocks.validate).not.toHaveBeenCalled();
  },
);
it("rejects wrong project, tampered proof and changed destination before Routes", async () => {
  expect(
    (
      await call({
        selectedAddressProof: { ...selected(), placeId: "tampered" },
      })
    ).status,
  ).toBe(422);
  mocks.read.mockResolvedValue({ site_address: "Other site" });
  expect((await call({ selectedAddressProof: selected() })).status).toBe(422);
  expect(mocks.route).not.toHaveBeenCalled();
});
it("rejects a late canonical change and inaccessible project without returning financial authority", async () => {
  mocks.read
    .mockResolvedValueOnce({ site_address: destinationCanonical })
    .mockResolvedValueOnce({ site_address: "Changed" });
  expect((await call({ selectedAddressProof: selected() })).status).toBe(409);
  mocks.route.mockClear();
  mocks.read.mockRejectedValueOnce(Error("Not found"));
  expect((await call({ selectedAddressProof: selected() })).status).toBe(422);
  expect(mocks.route).not.toHaveBeenCalled();
});
it("performs no provider calls on staff denial", async () => {
  mocks.auth.mockResolvedValue({
    ok: false,
    response: Response.json({ error: "Denied" }, { status: 403 }),
  });
  expect((await call({ selectedAddressProof: selected() })).status).toBe(403);
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.route).not.toHaveBeenCalled();
});
it("revalidates an aged independent address proof after saved manual override without reselection", async () => {
  const proof = selected();
  vi.useFakeTimers();
  vi.setSystemTime(proof.issuedAt + 31 * 60 * 1000);
  const response = await call({
      selectedAddressProof: proof,
      allowance: { mode: "manual" },
    }),
    result = await response.json();
  expect(response.status).toBe(200);
  expect(mocks.validate).toHaveBeenCalledOnce();
  expect(mocks.route).toHaveBeenCalledOnce();
  expect(result.selectedAddressProof.destinationCanonical).toBe(
    destinationCanonical,
  );
  expect(result.selectedAddressProof.issuedAt).toBeGreaterThan(proof.issuedAt);
  expect(mocks.validate.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.route.mock.invocationCallOrder[0],
  );
  vi.useRealTimers();
});
