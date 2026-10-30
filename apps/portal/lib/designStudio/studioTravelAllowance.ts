import {
  calculateTravelAllowanceCents,
  STUDIO_TRAVEL_POLICY,
} from "@sp/costing";
export type StudioTravelReceipt = {
  schemaVersion: "studio_travel_receipt.v1";
  policyVersion: string;
  base: string;
  projectId: string;
  destinationCanonical: string;
  placeId: string;
  drivingCostPerRoundTripCents: number;
  overnightEligible: boolean;
  proof: string;
};
export type StudioSelectedAddressProof = {
  schemaVersion: "studio_selected_address.v1";
  projectId: string;
  destinationCanonical: string;
  placeId: string;
  issuedAt: number;
  proof: string;
};
export type StudioTravelTripCountSource = 'site_days' | 'overnight' | 'manual';
export type StudioTravelPlan = {
  plannedRoundTrips: string;
  plannedNights: string;
  /** Missing on legacy plans: their original trip intent needs confirmation. */
  tripCountSource?: StudioTravelTripCountSource;
};
export type RetainedTravelPlan = StudioTravelPlan & { destinationCanonical: string };
export type StudioTravelAllowance =
  | { mode: "manual" }
  | { mode: "pending"; placeId?: string; destinationCanonical?: string; previousPlan?: RetainedTravelPlan }
  | (StudioTravelPlan & {
      mode: "automatic";
      receipt: StudioTravelReceipt;
    });
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const validPlan = (value: Record<string, unknown>) =>
  typeof value.plannedRoundTrips === 'string' && value.plannedRoundTrips.length <= 64
  && typeof value.plannedNights === 'string' && value.plannedNights.length <= 64
  && (!Object.hasOwn(value, 'tripCountSource') || (typeof value.tripCountSource==='string' && ['site_days', 'overnight', 'manual'].includes(value.tripCountSource)));
export function parseStudioSelectedAddressProof(
  value: unknown,
): StudioSelectedAddressProof | null {
  if (value === null || value === undefined) return null;
  if (
    !object(value) ||
    !exact(value, [
      "schemaVersion",
      "projectId",
      "destinationCanonical",
      "placeId",
      "issuedAt",
      "proof",
    ]) ||
    value.schemaVersion !== "studio_selected_address.v1" ||
    typeof value.projectId !== "string" ||
    !value.projectId ||
    typeof value.destinationCanonical !== "string" ||
    !value.destinationCanonical.trim() ||
    value.destinationCanonical.length > 280 ||
    typeof value.placeId !== "string" ||
    !/^[A-Za-z0-9_-]{1,255}$/.test(value.placeId) ||
    !Number.isSafeInteger(value.issuedAt) ||
    Number(value.issuedAt) < 0 ||
    typeof value.proof !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.proof)
  )
    throw Error(
      "Choose a physical New Zealand site address before creating a quote.",
    );
  return structuredClone(value) as unknown as StudioSelectedAddressProof;
}
export function parseStudioTravelAllowance(
  value: unknown,
): StudioTravelAllowance {
  if (!object(value)) throw Error("Travel details are incomplete.");
  if (value.mode === "manual" && exact(value, ["mode"]))
    return { mode: "manual" };
  if (value.mode === 'pending') {
    const destination = Object.hasOwn(value, 'placeId') || Object.hasOwn(value, 'destinationCanonical');
    const previous = Object.hasOwn(value, 'previousPlan');
    if (!exact(value, ['mode', ...(destination ? ['placeId', 'destinationCanonical'] : []), ...(previous ? ['previousPlan'] : [])])
      || (destination && (typeof value.placeId !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(value.placeId)
        || typeof value.destinationCanonical !== 'string' || !value.destinationCanonical.trim() || value.destinationCanonical.length > 280))
      || (previous && (!object(value.previousPlan) || !validPlan(value.previousPlan)
        || !exact(value.previousPlan, ['plannedRoundTrips', 'plannedNights', 'destinationCanonical',
          ...(Object.hasOwn(value.previousPlan, 'tripCountSource') ? ['tripCountSource'] : [])])
        || typeof value.previousPlan.destinationCanonical !== 'string' || !value.previousPlan.destinationCanonical.trim()
        || value.previousPlan.destinationCanonical.length > 280))) throw Error('Travel details are incomplete or unsupported.');
    return structuredClone(value) as StudioTravelAllowance;
  }
  const receipt = value.receipt;
  if (
    value.mode !== "automatic" ||
    !exact(value, ["mode", "receipt", "plannedRoundTrips", "plannedNights",
      ...(Object.hasOwn(value, 'tripCountSource') ? ['tripCountSource'] : [])]) ||
    !validPlan(value) ||
    !object(receipt) ||
    !exact(receipt, [
      "schemaVersion",
      "policyVersion",
      "base",
      "projectId",
      "destinationCanonical",
      "placeId",
      "drivingCostPerRoundTripCents",
      "overnightEligible",
      "proof",
    ]) ||
    receipt.schemaVersion !== "studio_travel_receipt.v1" ||
    typeof receipt.policyVersion !== "string" ||
    typeof receipt.base !== "string" ||
    typeof receipt.projectId !== "string" ||
    typeof receipt.destinationCanonical !== "string" ||
    !receipt.destinationCanonical.trim() ||
    receipt.destinationCanonical.length > 280 ||
    typeof receipt.placeId !== "string" ||
    !/^[A-Za-z0-9_-]{1,255}$/.test(receipt.placeId) ||
    !Number.isSafeInteger(receipt.drivingCostPerRoundTripCents) ||
    Number(receipt.drivingCostPerRoundTripCents) < 0 ||
    typeof receipt.overnightEligible !== "boolean" ||
    typeof receipt.proof !== "string" ||
    !/^[a-f0-9]{64}$/.test(receipt.proof) ||
    typeof value.plannedRoundTrips !== "string" ||
    value.plannedRoundTrips.length > 64 ||
    typeof value.plannedNights !== "string" ||
    value.plannedNights.length > 64
  )
    throw Error("Travel details are incomplete or unsupported.");
  return structuredClone(value) as unknown as StudioTravelAllowance;
}
export function studioTravelTotalCents(
  basis: Extract<StudioTravelAllowance, { mode: "automatic" }>,
) {
  if (
    basis.receipt.policyVersion !== STUDIO_TRAVEL_POLICY.version ||
    basis.receipt.base !== STUDIO_TRAVEL_POLICY.base
  )
    throw Error("The travel policy changed. Calculate travel again.");
  return studioTravelPlanTotalCents(basis);
}
/** Local plan validation does not require a current route or policy version. */
export function studioTravelPlanTotalCents(
  basis: Extract<StudioTravelAllowance, { mode: "automatic" }>,
) {
  const issue =
    studioTravelPlanFieldError("plannedRoundTrips", basis.plannedRoundTrips) ??
    studioTravelPlanFieldError("plannedNights", basis.plannedNights);
  if (issue) throw Error(issue);
  return calculateTravelAllowanceCents(
    basis.receipt.drivingCostPerRoundTripCents,
    Number(basis.plannedRoundTrips),
    Number(basis.plannedNights),
  );
}
export function studioTravelPlanFieldError(
  field: "plannedRoundTrips" | "plannedNights",
  value: string,
): string | null {
  if (field === "plannedNights" && value === "")
    return "Enter planned nights away, including 0 for a day trip.";
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < (field === "plannedRoundTrips" ? 1 : 0)
  )
    return field === "plannedRoundTrips"
      ? "Enter whole planned return trips, at least 1."
      : "Enter whole planned nights away, 0 or more.";
  return null;
}

