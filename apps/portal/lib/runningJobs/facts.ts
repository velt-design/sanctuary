type RunningJobFactState = {
  materialsOrdered: boolean;
  roofingOrdered: boolean;
  jobComplete: boolean;
};

function isV2ProjectWorkModel(modelVersion: number | null | undefined): boolean {
  return modelVersion === 2;
}

export function legacyRunningJobTaskProjectIds(
  projects: ReadonlyArray<{ id: string; modelVersion: number | null | undefined }>,
): string[] {
  return projects
    .filter((project) => project.id && !isV2ProjectWorkModel(project.modelVersion))
    .map((project) => project.id);
}

export function resolveRunningJobFactState(input: {
  modelVersion: number | null | undefined;
  legacyTaskKeys: ReadonlySet<string>;
  materialsOrderedAt: string | null;
  roofingOrderedAt: string | null;
  scheduleCompleted: boolean;
}): RunningJobFactState {
  if (isV2ProjectWorkModel(input.modelVersion)) {
    return {
      materialsOrdered: Boolean(input.materialsOrderedAt),
      roofingOrdered: Boolean(input.roofingOrderedAt),
      jobComplete: input.scheduleCompleted,
    };
  }

  return {
    materialsOrdered: input.legacyTaskKeys.has('order_materials'),
    roofingOrdered: input.legacyTaskKeys.has('roofing_ordered'),
    jobComplete: input.legacyTaskKeys.has('job_complete'),
  };
}
