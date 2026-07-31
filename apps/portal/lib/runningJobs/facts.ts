type RunningJobFactState = {
  materialsOrdered: boolean;
  roofingOrdered: boolean;
  jobComplete: boolean;
};

export function resolveRunningJobFactState(input: {
  materialsOrderedAt: string | null;
  roofingOrderedAt: string | null;
  scheduleCompleted: boolean;
}): RunningJobFactState {
  return {
    materialsOrdered: Boolean(input.materialsOrderedAt),
    roofingOrdered: Boolean(input.roofingOrderedAt),
    jobComplete: input.scheduleCompleted,
  };
}
