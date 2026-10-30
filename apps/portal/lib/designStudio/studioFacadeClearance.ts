/** One per-pergola setting. Absence is the retained historical connection rule. */
const STUDIO_FACADE_CLEARANCE_MIN_MM = 200;
export type StudioRetainedFacade = { houseId: string; edge: string };
/** A new connection is explicit intent. Sliding the same historical binding is
 * not a migration; its absent setting remains absent. */
export function prospectiveStudioFacadeClearance(
  value: { facadeClearanceMm?: string },
  method: string,
  target?: { houseId: string; edge: string },
  retained?: StudioRetainedFacade,
) {
  if (method !== "facade") return undefined;
  if (value.facadeClearanceMm !== undefined) return value.facadeClearanceMm;
  if (
    target &&
    retained &&
    target.houseId === retained.houseId &&
    target.edge === retained.edge
  )
    return undefined;
  return String(STUDIO_FACADE_CLEARANCE_MIN_MM);
}
export function readStudioFacadeClearance(raw: string | undefined) {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (
    !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim()) ||
    !Number.isFinite(value) ||
    value < STUDIO_FACADE_CLEARANCE_MIN_MM
  )
    throw Error(
      "Enter a roof clearance of 200 mm or more. Your input is kept.",
    );
  return value;
}
