export type CalculatorDesignNavigation = {
  value: string;
  stateLabel: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export type CalculatorProjectWorkspace = {
  kind: 'project';
  host: string;
  projectId: string;
  editEstimateId?: string;
  fromEstimateId?: string;
  createNewEstimate?: boolean;
  newEstimateInternalName?: string | null;
  newEstimateCommercialScopeId?: string | null;
  newEstimateCommercialScopeKind?: 'base' | 'add_on';
  designNavigation: CalculatorDesignNavigation;
  onEstimateSaved: (estimateId: string) => void;
  onOpenProject: () => void;
  onSaveStateChange?: (saving: boolean) => void;
};

type CalculatorWorkspaceRoute = {
  host?: string;
  projectId: string;
  editEstimateId: string;
  fromEstimateId: string;
  shouldOpenActiveDraft: boolean;
  createNewEstimate: boolean;
  newEstimateInternalName: string | null;
  newEstimateCommercialScopeId: string | null;
  newEstimateCommercialScopeKind: 'base' | 'add_on';
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
      newEstimateCommercialScopeId: workspace.newEstimateCommercialScopeId?.trim() || null,
      newEstimateCommercialScopeKind: workspace.newEstimateCommercialScopeKind === 'add_on' ? 'add_on' : 'base',
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
    newEstimateCommercialScopeId: searchParams.get('commercialScopeId')?.trim() || null,
    newEstimateCommercialScopeKind: searchParams.get('estimateKind') === 'add_on' ? 'add_on' : 'base',
  };
}
