import { isStudioObject } from "./contracts";

export const STUDIO_PRICE_COMMAND_SCHEMA = "studio_price_command.v2" as const;
export const STUDIO_PRICE_REFERENCE_SCHEMA =
  "studio_price_reference.v2" as const;
/** Bump for any geometry, selection, material, labour or selling algorithm change
 * affecting this persisted slice, even when the published rates do not change. */
export const STUDIO_PRICE_ALGORITHM_VERSION = "studio_plain_mono.v2" as const;
/** v2 extends proven sheet-cut eligibility. Existing v1 frozen results remain
 * readable; reads verify their evidence and never recompute under v2. */
export const STUDIO_PLURAL_PRICE_ALGORITHM_VERSION =
  "studio_independent_mono_charges.v1" as const;
export const STUDIO_PLURAL_PRICED_CANDIDATE_SCHEMA =
  "studio_priced_candidate.v3" as const;
export const STUDIO_FACADE_PRICED_CANDIDATE_SCHEMA =
  "studio_priced_candidate.v4" as const;
export const STUDIO_FACADE_PRICE_ALGORITHM_VERSION =
  "studio_facade_mono.v1" as const;
export const STUDIO_ACCESSORY_PRICED_CANDIDATE_SCHEMA = "studio_priced_candidate.v5" as const;
export const STUDIO_ACCESSORY_PRICE_ALGORITHM_VERSION = "studio_accessory_lines.v1" as const;
export const STUDIO_GABLE_PRICED_CANDIDATE_SCHEMA = "studio_priced_candidate.v6" as const;
export const STUDIO_GABLE_PRICE_ALGORITHM_VERSION = "studio_gable_acrylic.v1" as const;
export type StudioPriceAlgorithmVersion =
  | "studio_plain_mono.v1"
  | "studio_plain_mono.v2"
  | typeof STUDIO_PLURAL_PRICE_ALGORITHM_VERSION
  | typeof STUDIO_FACADE_PRICE_ALGORITHM_VERSION
  | typeof STUDIO_ACCESSORY_PRICE_ALGORITHM_VERSION
  | typeof STUDIO_GABLE_PRICE_ALGORITHM_VERSION;
/** Singleton quote-content consumers must retain their narrower supported set. */
export const isStudioPriceAlgorithmVersion = (
  value: unknown,
): value is StudioPriceAlgorithmVersion =>
  value === "studio_plain_mono.v1" || value === "studio_plain_mono.v2";
export const isStoredStudioPriceAlgorithmVersion = (
  value: unknown,
): value is StudioPriceAlgorithmVersion =>
  isStudioPriceAlgorithmVersion(value) ||
  value === STUDIO_PLURAL_PRICE_ALGORITHM_VERSION ||
  value === STUDIO_FACADE_PRICE_ALGORITHM_VERSION ||
  value === STUDIO_ACCESSORY_PRICE_ALGORITHM_VERSION ||
  value === STUDIO_GABLE_PRICE_ALGORITHM_VERSION;
export const isStudioPricedCandidateTuple = (
  schema: unknown,
  algorithm: unknown,
): boolean =>
  (schema === "studio_priced_candidate.v2" &&
    isStudioPriceAlgorithmVersion(algorithm)) ||
  (schema === STUDIO_PLURAL_PRICED_CANDIDATE_SCHEMA &&
    algorithm === STUDIO_PLURAL_PRICE_ALGORITHM_VERSION) ||
  (schema === STUDIO_FACADE_PRICED_CANDIDATE_SCHEMA &&
    algorithm === STUDIO_FACADE_PRICE_ALGORITHM_VERSION) ||
  (schema === STUDIO_ACCESSORY_PRICED_CANDIDATE_SCHEMA && algorithm === STUDIO_ACCESSORY_PRICE_ALGORITHM_VERSION) ||
  (schema === STUDIO_GABLE_PRICED_CANDIDATE_SCHEMA && algorithm === STUDIO_GABLE_PRICE_ALGORITHM_VERSION);
export const STUDIO_PRICED_CANDIDATE_SCHEMA =
  "studio_priced_candidate.v2" as const;

export type StudioPriceResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code:
        | "STUDIO_PRICE_INVALID"
        | "STUDIO_PRICE_UNSUPPORTED"
        | "STUDIO_PRICE_STALE";
      message: string;
      reasonCode?: 'missing_blind_schedule' | 'physical_overlap';
    };
export type StudioPriceCommand = {
  schemaVersion: typeof STUDIO_PRICE_COMMAND_SCHEMA;
  requestId: string;
  expectedUpdatedAt: string;
  expectedRevision: number;
  expectedSourceToken: string;
};
export type StudioPriceReference = {
  schemaVersion: typeof STUDIO_PRICE_REFERENCE_SCHEMA;
  priceId: string;
  designId: string;
  revision: number;
  sourceToken: string;
};
export const studioPriceUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export const studioPriceDigest = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
export function studioPriceTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= days[month - 1] &&
    Number(value.slice(11, 13)) < 24 &&
    Number(value.slice(14, 16)) < 60 &&
    Number(value.slice(17, 19)) < 60
  );
}
export function studioPriceExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
export function parseStudioPriceCommand(
  value: unknown,
): StudioPriceResult<StudioPriceCommand> {
  if (
    !isStudioObject(value) ||
    !studioPriceExactKeys(value, [
      "schemaVersion",
      "requestId",
      "expectedUpdatedAt",
      "expectedRevision",
      "expectedSourceToken",
    ]) ||
    value.schemaVersion !== STUDIO_PRICE_COMMAND_SCHEMA ||
    !studioPriceUuid(value.requestId) ||
    !studioPriceTimestamp(value.expectedUpdatedAt) ||
    !Number.isSafeInteger(value.expectedRevision) ||
    Number(value.expectedRevision) < 1 ||
    !studioPriceDigest(value.expectedSourceToken)
  ) {
    return {
      ok: false,
      code: "STUDIO_PRICE_INVALID",
      message: "Invalid Studio price command.",
    };
  }
  return { ok: true, value: structuredClone(value) as StudioPriceCommand };
}
export function parseStudioPriceReference(
  value: unknown,
): StudioPriceResult<StudioPriceReference> {
  if (
    !isStudioObject(value) ||
    !studioPriceExactKeys(value, [
      "schemaVersion",
      "priceId",
      "designId",
      "revision",
      "sourceToken",
    ]) ||
    value.schemaVersion !== STUDIO_PRICE_REFERENCE_SCHEMA ||
    !studioPriceUuid(value.priceId) ||
    typeof value.designId !== "string" ||
    !value.designId.trim() ||
    value.designId.trim() !== value.designId ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 1 ||
    !studioPriceDigest(value.sourceToken)
  ) {
    return {
      ok: false,
      code: "STUDIO_PRICE_INVALID",
      message: "Unsupported Studio price reference.",
    };
  }
  return { ok: true, value: structuredClone(value) as StudioPriceReference };
}
