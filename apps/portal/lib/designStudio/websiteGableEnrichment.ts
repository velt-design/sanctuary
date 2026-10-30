import { isStudioObject } from "./contracts";

/** Explicit staff intent for the currently admitted freestanding acrylic gable.
 * Height is equal eave support underside, not ridge height or post stock length.
 * Syntax acceptance does not establish stock availability or engineering adequacy.
 */
export type StudioWebsiteGableEnrichment = {
  family: "gable";
  heightM: string;
  pitchDeg: string;
  postCount: "4";
  postConnectionType: "pile_1_5m" | "deck_bracket" | "slab_anchors";
  ground: "easy" | "hard";
  ledgerProfile: "";
  frontBeamProfile: string;
  rafterProfile: string;
  postProfile: string;
  ridgeBeamProfile: string;
  endFramesMode: "none" | "both_ends";
  tieBeamProfile: string;
  strutProfile: string;
  houseEaveGutterMode: "our";
  outerEaveGutterMode: "our";
};

const keys = [
  "family",
  "heightM",
  "pitchDeg",
  "postCount",
  "postConnectionType",
  "ground",
  "ledgerProfile",
  "frontBeamProfile",
  "rafterProfile",
  "postProfile",
  "ridgeBeamProfile",
  "endFramesMode",
  "tieBeamProfile",
  "strutProfile",
  "houseEaveGutterMode",
  "outerEaveGutterMode",
];
function decimal(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 32 &&
    /^\d+(?:\.\d+)?$/.test(value) &&
    Number.isFinite(Number(value))
  );
}
function profile(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > 100 ||
    !/^[1-9]\d*x[1-9]\d*$/.test(value)
  )
    return false;
  return value.split("x").every((part) => Number.isSafeInteger(Number(part)));
}

/** Strict new-family boundary; never repairs, defaults, normalizes or mutates.
 * Numeric height uses the canonical owner's exact mm→m round trip, including
 * values such as1.001 whose binary multiplication by1000 is not an integer.
 */
export function parseStudioWebsiteGableEnrichment(
  value: unknown,
): StudioWebsiteGableEnrichment | null {
  if (
    !isStudioObject(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    return null;
  if (
    value.family !== "gable" ||
    !decimal(value.heightM) ||
    !decimal(value.pitchDeg)
  )
    return null;
  // Validate the decimal itself before Number can erase a sub-mm tail.
  const [whole, fraction = ""] = value.heightM.split(".");
  if (/[^0]/.test(fraction.slice(3))) return null;
  const exactMm =
    BigInt(whole) * BigInt(1000) + BigInt(fraction.slice(0, 3).padEnd(3, "0"));
  if (exactMm <= BigInt(0) || exactMm > BigInt(Number.MAX_SAFE_INTEGER))
    return null;
  const heightM = Number(value.heightM),
    heightMm = Number(exactMm);
  if (Math.round(heightM * 1000) !== heightMm) return null;
  if (
    !Number.isSafeInteger(heightMm) ||
    heightMm <= 0 ||
    heightM !== heightMm / 1000 ||
    Number(value.pitchDeg) <= 0 ||
    Number(value.pitchDeg) >= 90
  )
    return null;
  if (
    value.postCount !== "4" ||
    !["pile_1_5m", "deck_bracket", "slab_anchors"].includes(
      String(value.postConnectionType),
    ) ||
    typeof value.postConnectionType !== "string" ||
    !["easy", "hard"].includes(String(value.ground)) ||
    typeof value.ground !== "string" ||
    value.ledgerProfile !== "" ||
    value.houseEaveGutterMode !== "our" ||
    value.outerEaveGutterMode !== "our"
  )
    return null;
  for (const key of [
    "frontBeamProfile",
    "rafterProfile",
    "postProfile",
    "ridgeBeamProfile",
  ]) {
    if (!profile(value[key])) return null;
  }
  if (Number((value.rafterProfile as string).split("x")[1]) !== 50) return null;
  if (value.endFramesMode === "none") {
    if (value.tieBeamProfile !== "" || value.strutProfile !== "") return null;
  } else if (value.endFramesMode === "both_ends") {
    if (!profile(value.tieBeamProfile) || !profile(value.strutProfile))
      return null;
  } else return null;
  return structuredClone(value) as StudioWebsiteGableEnrichment;
}
