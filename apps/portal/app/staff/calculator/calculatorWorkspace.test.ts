import { describe, expect, it } from 'vitest';
import { resolveCalculatorWorkspaceRoute } from './calculatorWorkspace';

describe('resolveCalculatorWorkspaceRoute', () => {
  it('keeps the standalone Calculator query contract', () => {
    expect(resolveCalculatorWorkspaceRoute(new URLSearchParams(
      'projectId=proj_1&editEstimateId=est_1&openActiveDraft=1&estimateName=Front%20option',
    ))).toEqual({
      host: undefined,
      projectId: 'proj_1',
      editEstimateId: 'est_1',
      fromEstimateId: '',
      shouldOpenActiveDraft: true,
      createNewEstimate: false,
      newEstimateInternalName: 'Front option',
    });
  });

  it('takes fixed project and estimate context from an embedded workspace', () => {
    expect(resolveCalculatorWorkspaceRoute(new URLSearchParams('projectId=wrong'), {
      kind: 'project',
      host: 'tenant.example',
      projectId: 'proj_fixed',
      fromEstimateId: 'est_source',
      newEstimateInternalName: 'Copy of Front option',
      designNavigation: {
        value: 'revision:est_source',
        stateLabel: 'Revision from V1',
        options: [{ value: 'revision:est_source', label: 'Revision from V1' }],
        onChange: () => undefined,
      },
      onEstimateSaved: () => undefined,
      onOpenProject: () => undefined,
    })).toEqual({
      host: 'tenant.example',
      projectId: 'proj_fixed',
      editEstimateId: '',
      fromEstimateId: 'est_source',
      shouldOpenActiveDraft: false,
      createNewEstimate: true,
      newEstimateInternalName: 'Copy of Front option',
    });
  });
});
