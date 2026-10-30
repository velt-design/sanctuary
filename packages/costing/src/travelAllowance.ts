/** Owner-approved local Studio travel policy; this does not publish a pricebook. */
export const STUDIO_TRAVEL_POLICY = Object.freeze({
  version: "studio-travel-local.v1",
  base: "71G Montgomerie Rd, Mangere, Auckland",
  crewHourExGstCents: 7500,
  crewNightExGstCents: 30000,
  vehicleKmExGstCents: 0,
  overnightPromptSeconds: 6300,
});
export function travelDrivingCostPerRoundTripCents(
  outboundSeconds: number,
  returnSeconds: number,
): number {
  if (
    ![outboundSeconds, returnSeconds].every(
      (value) => Number.isFinite(value) && value >= 0,
    )
  )
    throw Error("A complete return route is required.");
  const cents = Math.round(
    ((outboundSeconds + returnSeconds) *
      STUDIO_TRAVEL_POLICY.crewHourExGstCents) /
      3600,
  );
  if (!Number.isSafeInteger(cents))
    throw Error("The travel cost is too large.");
  return cents;
}
export function calculateTravelAllowanceCents(
  drivingCostPerRoundTripCents: number,
  roundTrips: number,
  nights: number,
): number {
  if (
    !Number.isSafeInteger(drivingCostPerRoundTripCents) ||
    drivingCostPerRoundTripCents < 0 ||
    !Number.isSafeInteger(roundTrips) ||
    roundTrips < 1 ||
    !Number.isSafeInteger(nights) ||
    nights < 0
  )
    throw Error("Enter whole planned return trips and nights away.");
  const cents =
    drivingCostPerRoundTripCents * roundTrips +
    STUDIO_TRAVEL_POLICY.crewNightExGstCents * nights;
  if (!Number.isSafeInteger(cents))
    throw Error("The travel allowance is too large.");
  return cents;
}
