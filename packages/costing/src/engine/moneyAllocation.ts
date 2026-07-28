type MoneyAllocationWeightV1 = {
  id: string;
  weight: number;
};

/**
 * Allocates an integer cent total across non-negative weights.
 *
 * Largest remainders receive any residual cents, with the stable id used as
 * the tie-breaker. The returned values therefore always reconcile exactly to
 * `totalCents` while remaining deterministic across callers.
 */
export function allocateMoneyCentsByWeightV1(
  totalCents: number,
  weights: MoneyAllocationWeightV1[],
): Record<string, number> {
  const safeTotal = Number.isFinite(totalCents) ? Math.max(0, Math.round(totalCents)) : 0;
  const unique = new Set<string>();
  for (const entry of weights) {
    if (!entry.id || unique.has(entry.id)) {
      throw new Error(`Money allocation ids must be non-empty and unique: '${entry.id}'.`);
    }
    unique.add(entry.id);
  }
  if (!weights.length) return {};

  const normalized = weights.map((entry) => ({
    id: entry.id,
    weight: Number.isFinite(entry.weight) ? Math.max(0, entry.weight) : 0,
  }));
  const weightTotal = normalized.reduce((sum, entry) => sum + entry.weight, 0);
  if (weightTotal <= 0) {
    const ordered = normalized.toSorted((left, right) => left.id.localeCompare(right.id));
    return Object.fromEntries(ordered.map((entry, index) => [entry.id, index === 0 ? safeTotal : 0]));
  }

  const provisional = normalized.map((entry) => {
    const exact = safeTotal * entry.weight / weightTotal;
    const cents = Math.floor(exact);
    return {
      id: entry.id,
      cents,
      remainder: exact - cents,
    };
  });
  let remaining = safeTotal - provisional.reduce((sum, entry) => sum + entry.cents, 0);
  const remainderOrder = provisional.toSorted(
    (left, right) => right.remainder - left.remainder || left.id.localeCompare(right.id),
  );
  for (let index = 0; index < remainderOrder.length && remaining > 0; index += 1) {
    remainderOrder[index]!.cents += 1;
    remaining -= 1;
  }

  return Object.fromEntries(provisional.map((entry) => [entry.id, entry.cents]));
}
