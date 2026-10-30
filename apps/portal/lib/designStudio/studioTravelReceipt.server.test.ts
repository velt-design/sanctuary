import { beforeEach, expect, it, vi } from "vitest";
import {
  parseStudioTravelAllowance,
  studioTravelTotalCents,
} from "./studioTravelAllowance";
import {
  signStudioTravelReceipt,
  verifyStudioTravelReceipt,
  verifyStudioTravelAmount,
  signStudioSelectedAddress,
  verifyStudioSelectedAddress,
  verifyStudioTravelForProject,
} from "./studioTravelReceipt.server";
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/projects/siteAddress.server", () => ({
  readProjectSiteAddress: mocks.read,
}));
const input = {
  projectId: "proj_fixture",
  destinationCanonical: "12 Example Road, Auckland 1010, New Zealand",
  placeId: "fixture_place",
  drivingCostPerRoundTripCents: 15000,
  overnightEligible: true,
};
beforeEach(() => {
  vi.useRealTimers();
  process.env.STUDIO_TRAVEL_SIGNING_KEY = "ab".repeat(32);
});
it("binds all financial authority, policy, site and physical reference fields", () => {
  const receipt = signStudioTravelReceipt(input);
  expect(() => verifyStudioTravelReceipt(receipt)).not.toThrow();
  for (const patch of [
    { projectId: "other" },
    { destinationCanonical: "Auckland" },
    { placeId: "other" },
    { base: "other" },
    { policyVersion: "other" },
    { drivingCostPerRoundTripCents: 0 },
    { overnightEligible: false },
  ])
    expect(() => verifyStudioTravelReceipt({ ...receipt, ...patch })).toThrow();
  const basis = {
    mode: "automatic" as const,
    receipt,
    plannedRoundTrips: "2",
    plannedNights: "3",
  };
  expect(studioTravelTotalCents(basis)).toBe(120000);
  expect(
    verifyStudioTravelAmount(
      { travelAllowance: basis, travelExGst: "1200.00" },
      input.projectId,
      input.destinationCanonical,
    ),
  ).toBe(input.destinationCanonical);
  expect(() =>
    verifyStudioTravelAmount(
      { travelAllowance: basis, travelExGst: "1199.99" },
      input.projectId,
      input.destinationCanonical,
    ),
  ).toThrow(/amount/);
  expect(() =>
    verifyStudioTravelAmount(
      { travelAllowance: basis, travelExGst: "1200" },
      input.projectId,
      "different site",
    ),
  ).toThrow(/address changed/);
  expect(() => studioTravelTotalCents({ ...basis, plannedNights: "" })).toThrow(
    /Enter planned nights/,
  );
});
it("retains manual pricing, refuses pending and strictly replaces automatic authority", () => {
  expect(
    verifyStudioTravelAmount({ travelExGst: "435.50" }, "legacy", "legacy"),
  ).toBeNull();
  expect(
    verifyStudioTravelAmount(
      { travelAllowance: { mode: "manual" }, travelExGst: "435.50" },
      "legacy",
      "legacy",
    ),
  ).toBeNull();
  expect(() =>
    verifyStudioTravelAmount(
      { travelAllowance: { mode: "pending" }, travelExGst: "435.50" },
      "legacy",
      "legacy",
    ),
  ).toThrow(/Calculate travel/);
  expect(() =>
    parseStudioTravelAllowance({
      mode: "manual",
      receipt: signStudioTravelReceipt(input),
    }),
  ).toThrow();
});
it("domain-separates transient selected-address proof, binds destination/project and expires it", () => {
  const proof = signStudioSelectedAddress(input);
  expect(() =>
    verifyStudioSelectedAddress(
      proof,
      input.projectId,
      input.destinationCanonical,
    ),
  ).not.toThrow();
  expect(() =>
    verifyStudioSelectedAddress(proof, "other", input.destinationCanonical),
  ).toThrow();
  expect(() =>
    verifyStudioSelectedAddress(
      { ...proof, placeId: "tampered" },
      input.projectId,
      input.destinationCanonical,
    ),
  ).toThrow();
  vi.useFakeTimers();
  vi.setSystemTime(proof.issuedAt + 30 * 60 * 1000 + 1);
  expect(() =>
    verifyStudioSelectedAddress(
      proof,
      input.projectId,
      input.destinationCanonical,
    ),
  ).toThrow();
});
it("fails closed without a dedicated 256-bit signing key", () => {
  process.env.STUDIO_TRAVEL_SIGNING_KEY = "";
  expect(() => signStudioTravelReceipt(input)).toThrow(/unavailable/);
});
it("checks fresh canonical Project authority for automatic pricing and makes no Project/provider request for legacy/manual amounts", async () => {
  mocks.read.mockReset();
  const client = {} as Parameters<typeof verifyStudioTravelForProject>[0],
    projectId = "proj_10000000-0000-4000-8000-000000000001";
  await expect(
    verifyStudioTravelForProject(client, projectId, { travelExGst: "435.50" }),
  ).resolves.toBeNull();
  expect(mocks.read).not.toHaveBeenCalled();
  const receipt = signStudioTravelReceipt({ ...input, projectId }),
    site = {
      travelExGst: "150.00",
      travelAllowance: {
        mode: "automatic",
        receipt,
        plannedRoundTrips: "1",
        plannedNights: "0",
      },
    };
  mocks.read.mockResolvedValue({ site_address: input.destinationCanonical });
  await expect(
    verifyStudioTravelForProject(client, projectId, site),
  ).resolves.toBe(input.destinationCanonical);
  mocks.read.mockResolvedValue({ site_address: "Later site" });
  await expect(
    verifyStudioTravelForProject(client, projectId, site),
  ).rejects.toThrow(/address changed/);
});
it("keeps useful manual design pricing but requires independent physical-address authority for every fresh quote, including zero", async () => {
  mocks.read.mockReset();
  const client = {} as Parameters<typeof verifyStudioTravelForProject>[0],
    projectId = "proj_10000000-0000-4000-8000-000000000001";
  for (const travelExGst of ["0", "42.00"]) {
    const site = { travelAllowance: { mode: "manual" }, travelExGst };
    await expect(
      verifyStudioTravelForProject(client, projectId, site),
    ).resolves.toBeNull();
    await expect(
      verifyStudioTravelForProject(client, projectId, site, undefined, true),
    ).rejects.toThrow(/physical New Zealand site address/);
  }
  expect(mocks.read).not.toHaveBeenCalled();
});
it("retains saved address proof without quote-age expiry and shares one canonical read with automatic financial verification", async () => {
  mocks.read.mockReset();
  const client = {} as Parameters<typeof verifyStudioTravelForProject>[0],
    projectId = "proj_10000000-0000-4000-8000-000000000001";
  const proof = signStudioSelectedAddress({ ...input, projectId });
  vi.useFakeTimers();
  vi.setSystemTime(proof.issuedAt + 7 * 24 * 60 * 60 * 1000);
  mocks.read.mockResolvedValue({ site_address: input.destinationCanonical });
  const manual = {
    travelAllowance: { mode: "manual" },
    travelExGst: "0",
    siteAddressProof: proof,
  };
  await expect(
    verifyStudioTravelForProject(client, projectId, manual, undefined, true),
  ).resolves.toBe(input.destinationCanonical);
  expect(mocks.read).toHaveBeenCalledOnce();
  mocks.read.mockClear();
  const receipt = signStudioTravelReceipt({ ...input, projectId });
  await expect(
    verifyStudioTravelForProject(
      client,
      projectId,
      {
        ...manual,
        travelExGst: "150.00",
        travelAllowance: {
          mode: "automatic",
          receipt,
          plannedRoundTrips: "1",
          plannedNights: "0",
        },
      },
      undefined,
      true,
    ),
  ).resolves.toBe(input.destinationCanonical);
  expect(mocks.read).toHaveBeenCalledOnce();
  mocks.read.mockResolvedValue({ site_address: "Changed physical site" });
  await expect(
    verifyStudioTravelForProject(client, projectId, manual),
  ).rejects.toThrow(/no longer current/);
  mocks.read.mockResolvedValue({ site_address: input.destinationCanonical });
  await expect(
    verifyStudioTravelForProject(
      client,
      projectId,
      { ...manual, siteAddressProof: { ...proof, proof: "0".repeat(64) } },
      undefined,
      true,
    ),
  ).rejects.toThrow(/could not be verified/);
});
