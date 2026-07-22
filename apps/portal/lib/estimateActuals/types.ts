export type EstimateActualCostValues = {
  materialsExGst: number | null;
  installExGst: number | null;
  overheadExGst: number | null;
  travelExGst: number | null;
  extrasExGst: number | null;
  crewHours: number | null;
};

export type EstimateActualCostRecord = EstimateActualCostValues & {
  estimateId: string;
  notes: string;
  isComplete: boolean;
  updatedAt: string;
  updatedByEmail: string;
};

export type EstimateCostCalibrationComparison = {
  estimated: EstimateActualCostValues & { totalExGst: number | null };
  actual: EstimateActualCostRecord | null;
  variance: EstimateActualCostValues & { totalExGst: number | null };
};

export type EstimateActualCostInput = EstimateActualCostValues & {
  notes: string;
  isComplete: boolean;
};
