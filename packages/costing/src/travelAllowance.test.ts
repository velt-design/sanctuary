import { expect, it } from "vitest";
import {
  STUDIO_TRAVEL_POLICY,
  travelDrivingCostPerRoundTripCents,
  calculateTravelAllowanceCents,
} from "./travelAllowance";
it("charges whole-crew hours from both actual legs once, with no distance or crew multiplier", () => {
  expect(travelDrivingCostPerRoundTripCents(3600, 1800)).toBe(11250);
  expect(calculateTravelAllowanceCents(11250, 2, 3)).toBe(112500);
  expect(STUDIO_TRAVEL_POLICY.vehicleKmExGstCents).toBe(0);
});
it("allows explicit zero nights and rejects incomplete, fractional, negative and unsafe counts", () => {
  expect(calculateTravelAllowanceCents(7500, 1, 0)).toBe(7500);
  for (const args of [
    [7500, 0, 0],
    [7500, 1.5, 0],
    [7500, 1, -1],
    [Number.MAX_SAFE_INTEGER, 2, 0],
  ])
    expect(() =>
      calculateTravelAllowanceCents(...(args as [number, number, number])),
    ).toThrow();
  expect(() => travelDrivingCostPerRoundTripCents(NaN, 10)).toThrow();
});
