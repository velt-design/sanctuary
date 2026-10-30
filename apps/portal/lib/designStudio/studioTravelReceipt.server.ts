import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STUDIO_TRAVEL_POLICY } from "@sp/costing";
import {
  parseStudioTravelAllowance,
  parseStudioSelectedAddressProof,
  studioTravelTotalCents,
  type StudioTravelReceipt,
  type StudioSelectedAddressProof,
} from "./studioTravelAllowance";
import { readProjectSiteAddress } from "@/lib/projects/siteAddress.server";
import { uuidFromAppId } from "@/lib/supabase/mappers";
function key() {
  const raw = process.env.STUDIO_TRAVEL_SIGNING_KEY?.trim() ?? "";
  const value = Buffer.from(
    raw,
    /^[a-f0-9]{64}$/i.test(raw) ? "hex" : "base64url",
  );
  if (value.length !== 32)
    throw Error("Travel validation is unavailable. Retry later.");
  return value;
}
export function assertStudioTravelSigningAvailable() {
  key();
}
function message(receipt: Omit<StudioTravelReceipt, "proof">) {
  return JSON.stringify([
    "financial",
    receipt.schemaVersion,
    receipt.policyVersion,
    receipt.base,
    receipt.projectId,
    receipt.destinationCanonical,
    receipt.placeId,
    receipt.drivingCostPerRoundTripCents,
    receipt.overnightEligible,
  ]);
}
export function signStudioTravelReceipt(input: {
  projectId: string;
  destinationCanonical: string;
  placeId: string;
  drivingCostPerRoundTripCents: number;
  overnightEligible: boolean;
}): StudioTravelReceipt {
  const receipt = {
    schemaVersion: "studio_travel_receipt.v1" as const,
    policyVersion: STUDIO_TRAVEL_POLICY.version,
    base: STUDIO_TRAVEL_POLICY.base,
    ...input,
  };
  return {
    ...receipt,
    proof: createHmac("sha256", key()).update(message(receipt)).digest("hex"),
  };
}
function selectedMessage(value: Omit<StudioSelectedAddressProof, "proof">) {
  return JSON.stringify([
    "selected-address",
    value.schemaVersion,
    value.projectId,
    value.destinationCanonical,
    value.placeId,
    value.issuedAt,
  ]);
}
export function signStudioSelectedAddress(input: {
  projectId: string;
  destinationCanonical: string;
  placeId: string;
}): StudioSelectedAddressProof {
  const value = {
    schemaVersion: "studio_selected_address.v1" as const,
    projectId: input.projectId,
    destinationCanonical: input.destinationCanonical,
    placeId: input.placeId,
    issuedAt: Date.now(),
  };
  return {
    ...value,
    proof: createHmac("sha256", key())
      .update(selectedMessage(value))
      .digest("hex"),
  };
}
export function verifyStudioSelectedAddress(
  value: StudioSelectedAddressProof,
  projectId: string,
  destination: string,
  requireFresh = true,
) {
  const parsed = parseStudioSelectedAddressProof(value);
  if (!parsed)
    throw Error(
      "Choose a physical New Zealand site address before creating a quote.",
    );
  if (
    !value ||
    value.schemaVersion !== "studio_selected_address.v1" ||
    value.projectId !== projectId ||
    value.destinationCanonical !== destination ||
    typeof value.placeId !== "string" ||
    !/^[A-Za-z0-9_-]{1,255}$/.test(value.placeId) ||
    !Number.isSafeInteger(value.issuedAt) ||
    value.issuedAt > Date.now() ||
    (requireFresh && Date.now() - value.issuedAt > 30 * 60 * 1000) ||
    typeof value.proof !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.proof)
  )
    throw Error(
      "The selected site address is no longer current. Choose its physical address again.",
    );
  const expected = createHmac("sha256", key())
    .update(selectedMessage(value))
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(value.proof, "hex")))
    throw Error("The selected address could not be verified. Choose it again.");
}
export function verifyStudioTravelReceipt(receipt: StudioTravelReceipt) {
  const expected = createHmac("sha256", key())
    .update(message(receipt))
    .digest();
  if (
    !/^[a-f0-9]{64}$/.test(receipt.proof) ||
    !timingSafeEqual(expected, Buffer.from(receipt.proof, "hex"))
  )
    throw Error("Travel verification failed. Calculate travel again.");
}
/** Saved manual amounts keep their existing authority. Automatic amounts must match the signed financial basis. */
export function verifyStudioTravelAmount(
  site: Record<string, unknown>,
  projectId: string,
  destination: string,
) {
  if (site.travelAllowance === undefined) return null;
  const basis = parseStudioTravelAllowance(site.travelAllowance);
  if (basis.mode === "manual") return null;
  if (basis.mode === "pending")
    throw Error(
      "Calculate travel for the selected site address, or enter a manual allowance.",
    );
  verifyStudioTravelReceipt(basis.receipt);
  if (
    basis.receipt.projectId !== projectId ||
    basis.receipt.destinationCanonical !== destination
  )
    throw Error(
      "The site address changed. Calculate travel again before creating a quote.",
    );
  const cents = studioTravelTotalCents(basis);
  if (
    typeof site.travelExGst !== "string" ||
    !/^\d+(?:\.\d{1,2})?$/.test(site.travelExGst) ||
    Math.round(Number(site.travelExGst) * 100) !== cents
  )
    throw Error(
      "The travel amount does not match the planned trips and nights. Calculate travel again.",
    );
  return basis.receipt.destinationCanonical;
}
export async function verifyStudioTravelForProject(
  client: SupabaseClient,
  projectId: string,
  site: Record<string, unknown>,
  signal = new AbortController().signal,
  requireAddress = false,
) {
  const proof = parseStudioSelectedAddressProof(site.siteAddressProof);
  if (requireAddress && !proof)
    throw Error(
      "Choose a physical New Zealand site address before creating a quote.",
    );
  const automatic =
    site.travelAllowance !== undefined &&
    parseStudioTravelAllowance(site.travelAllowance).mode !== "manual";
  if (!proof && !automatic) return null;
  const current = await readProjectSiteAddress(
    client,
    uuidFromAppId(projectId, "proj"),
    signal,
  );
  const destination = current.site_address ?? "";
  if (proof) verifyStudioSelectedAddress(proof, projectId, destination, false);
  verifyStudioTravelAmount(site, projectId, destination);
  return proof?.destinationCanonical ?? destination;
}
