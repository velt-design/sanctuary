import { describe, expect, it } from 'vitest';
import {
  buildCalculatorEstimateCreateRedirect,
  buildCalculatorEstimateUpdateRedirect,
  calculatorSaveActionLabel,
  designRequestTierFromTotal,
  formatDesignRequestTierLabel,
  getCalculatorProjectSnapshotError,
  getCalculatorSaveBlockerError,
  getCalculatorSaveInitialError,
  resolveCalculatorEstimateTarget,
  resolveCalculatorSaveMode,
} from './calculatorSaveWorkflow';

describe('calculator save workflow helpers', () => {
  it('resolves default save modes and action labels without changing explicit requests', () => {
    expect(resolveCalculatorSaveMode({ requestedSaveMode: undefined, isEditingDesign: false })).toBe('reprice_latest');
    expect(resolveCalculatorSaveMode({ requestedSaveMode: undefined, isEditingDesign: true })).toBe('preserve_current');
    expect(resolveCalculatorSaveMode({ requestedSaveMode: 'reprice_latest', isEditingDesign: true })).toBe('reprice_latest');
    expect(calculatorSaveActionLabel('reprice_latest')).toBe('repricing');
    expect(calculatorSaveActionLabel('preserve_current')).toBe('saving');
  });

  it('maps design request tiers from priced totals', () => {
    expect(designRequestTierFromTotal(null)).toBe('UNPRICED');
    expect(designRequestTierFromTotal(11_999)).toBe('TIER_4');
    expect(designRequestTierFromTotal(23_999)).toBe('TIER_3');
    expect(designRequestTierFromTotal(47_999)).toBe('TIER_2');
    expect(designRequestTierFromTotal(48_000)).toBe('TIER_1');
    expect(formatDesignRequestTierLabel('UNPRICED')).toBe('Unpriced');
    expect(formatDesignRequestTierLabel('TIER_2')).toBe('Tier 2');
  });

  it('keeps initial save readiness messages in their existing priority order', () => {
    expect(
      getCalculatorSaveInitialError({
        projectId: '',
        hasProject: false,
        saveMode: 'reprice_latest',
        hasCalculatedResult: false,
      }),
    ).toBe('Select a project first.');

    expect(
      getCalculatorSaveInitialError({
        projectId: 'project-1',
        hasProject: false,
        saveMode: 'reprice_latest',
        hasCalculatedResult: false,
      }),
    ).toBe('Project not found.');

    expect(
      getCalculatorSaveInitialError({
        projectId: 'project-1',
        hasProject: true,
        saveMode: 'reprice_latest',
        hasCalculatedResult: false,
      }),
    ).toBe('No calculated result yet.');

    expect(
      getCalculatorSaveInitialError({
        projectId: 'project-1',
        hasProject: true,
        saveMode: 'preserve_current',
        hasCalculatedResult: false,
      }),
    ).toBeNull();
  });

  it('builds blocker messages for preserve and reprice save paths', () => {
    expect(
      getCalculatorSaveBlockerError({
        saveMode: 'preserve_current',
        hasStatusBlockers: true,
        criticalWarningCount: 2,
      }),
    ).toBe('Resolve blockers in Quote Status before saving.');

    expect(
      getCalculatorSaveBlockerError({
        saveMode: 'reprice_latest',
        hasStatusBlockers: true,
        criticalWarningCount: 2,
      }),
    ).toBe('Resolve blockers in Quote Status before repricing.');

    expect(
      getCalculatorSaveBlockerError({
        saveMode: 'reprice_latest',
        hasStatusBlockers: false,
        criticalWarningCount: 1,
      }),
    ).toBe('Resolve critical warnings before repricing.');

    expect(
      getCalculatorSaveBlockerError({
        saveMode: 'preserve_current',
        hasStatusBlockers: false,
        criticalWarningCount: 1,
      }),
    ).toBeNull();
  });

  it('resolves new, active-draft, edit-session, and aliased estimate targets', () => {
    expect(
      resolveCalculatorEstimateTarget({
        activeEditEstimateId: '',
        activeDraftEstimateMetaId: null,
        estimateMetas: [],
        resolveEstimateId: () => null,
      }),
    ).toEqual({
      activeDraftEstimateId: '',
      estimateIdToUpdate: '',
      canonicalEditEstimateId: null,
    });

    expect(
      resolveCalculatorEstimateTarget({
        activeEditEstimateId: '',
        activeDraftEstimateMetaId: null,
        estimateMetas: [
          { id: 'estimate-old', isActiveDraft: false },
          { id: 'estimate-draft', isActiveDraft: true },
        ],
        resolveEstimateId: () => null,
      }),
    ).toEqual({
      activeDraftEstimateId: 'estimate-draft',
      estimateIdToUpdate: 'estimate-draft',
      canonicalEditEstimateId: 'estimate-draft',
    });

    expect(
      resolveCalculatorEstimateTarget({
        activeEditEstimateId: 'local-estimate:edit',
        activeDraftEstimateMetaId: 'estimate-draft',
        estimateMetas: [],
        resolveEstimateId: (estimateId) => (estimateId === 'local-estimate:edit' ? 'estimate-server' : null),
      }),
    ).toEqual({
      activeDraftEstimateId: 'estimate-draft',
      estimateIdToUpdate: 'local-estimate:edit',
      canonicalEditEstimateId: 'estimate-server',
    });
  });

  it('keeps project snapshot validation and redirect URLs stable', () => {
    expect(getCalculatorProjectSnapshotError({ hasContact: false, projectNameSnapshot: '' })).toBe(
      'Project is missing a contact (open the project and select/create one).',
    );
    expect(getCalculatorProjectSnapshotError({ hasContact: true, projectNameSnapshot: '   ' })).toBe('Project name is missing.');
    expect(getCalculatorProjectSnapshotError({ hasContact: true, projectNameSnapshot: 'Deck Build' })).toBeNull();

    expect(buildCalculatorEstimateUpdateRedirect('project 1', 'estimate/1')).toBe(
      '/staff/projects/project%201?tab=estimates&estimateId=estimate%2F1',
    );
    expect(buildCalculatorEstimateCreateRedirect('project 1')).toBe('/staff/projects/project%201?tab=estimates');
  });
});
