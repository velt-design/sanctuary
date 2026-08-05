type NonContinuousStockSelectionPriority = 'total_purchase_cost' | 'cost_per_m';

export type NonContinuousStockCandidate = {
  totalCost: number;
  wasteM: number;
  barsUsed: number;
  costPerM: number;
};

const EPSILON = 1e-6;

export function shouldPreferNonContinuousStock(
  candidate: NonContinuousStockCandidate,
  current: NonContinuousStockCandidate,
  priority: NonContinuousStockSelectionPriority,
): boolean {
  if (priority === 'total_purchase_cost') {
    if (Math.abs(candidate.totalCost - current.totalCost) > EPSILON) {
      return candidate.totalCost < current.totalCost;
    }
    if (Math.abs(candidate.wasteM - current.wasteM) > EPSILON) {
      return candidate.wasteM < current.wasteM;
    }
    if (candidate.barsUsed !== current.barsUsed) {
      return candidate.barsUsed < current.barsUsed;
    }
    return candidate.costPerM < current.costPerM - EPSILON;
  }

  if (Math.abs(candidate.costPerM - current.costPerM) > EPSILON) {
    return candidate.costPerM < current.costPerM;
  }
  if (Math.abs(candidate.wasteM - current.wasteM) > EPSILON) {
    return candidate.wasteM < current.wasteM;
  }
  return candidate.barsUsed < current.barsUsed;
}

export function describeNonContinuousStockSelection(priority: NonContinuousStockSelectionPriority): string {
  return priority === 'total_purchase_cost'
    ? 'non-continuous: prefer lowest total purchase cost, then waste, then bars-used, then cost-per-m'
    : 'non-continuous: prefer lowest cost-per-m, then waste, then bars-used';
}
