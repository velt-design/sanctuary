export type CalculatorDesignNavigation = {
  value: string;
  stateLabel: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
};

export type CalculatorProjectWorkspace = {
  kind: 'project';
  host: string;
  projectId: string;
  editEstimateId?: string;
  fromEstimateId?: string;
  createNewEstimate?: boolean;
  newEstimateInternalName?: string | null;
  designNavigation: CalculatorDesignNavigation;
  onEstimateSaved: (estimateId: string) => void;
  onOpenProject: () => void;
};

type CalculatorWorkspaceRoute = {
  host?: string;
  projectId: string;
  editEstimateId: string;
  fromEstimateId: string;
  shouldOpenActiveDraft: boolean;
  createNewEstimate: boolean;
  newEstimateInternalName: string | null;
};

export function resolveCalculatorWorkspaceRoute(
  searchParams: Pick<URLSearchParams, 'get'>,
  workspace?: CalculatorProjectWorkspace,
): CalculatorWorkspaceRoute {
  if (workspace) {
    return {
      host: workspace.host,
      projectId: workspace.projectId,
      editEstimateId: workspace.editEstimateId?.trim() ?? '',
      fromEstimateId: workspace.fromEstimateId?.trim() ?? '',
      shouldOpenActiveDraft: false,
      createNewEstimate: Boolean(workspace.createNewEstimate || workspace.fromEstimateId),
      newEstimateInternalName: workspace.newEstimateInternalName?.trim() || null,
    };
  }

  return {
    host: undefined,
    projectId: searchParams.get('projectId') ?? '',
    editEstimateId: searchParams.get('editEstimateId') ?? '',
    fromEstimateId: searchParams.get('fromEstimateId') ?? '',
    shouldOpenActiveDraft: searchParams.get('openActiveDraft') === '1',
    createNewEstimate: Boolean(searchParams.get('fromEstimateId')),
    newEstimateInternalName: searchParams.get('estimateName')?.trim() || null,
  };
}
