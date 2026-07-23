import { calculateSiteCostV1, type SiteOutputV1 } from '@sp/costing';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSiteInputsFromCalculatorInputs } from '@/lib/estimates/costingPayload';
import type { CalculatorInputs } from '@/lib/types/calculator';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { makeDefaultCalculatorInputs } from './calculatorInputs';
import { useCalculatorResultPresentation } from './useCalculatorResultPresentation';

type ResultPresentation = ReturnType<typeof useCalculatorResultPresentation>;

let latest: ResultPresentation | null = null;
const openIssues = vi.fn();
const setModuleField = vi.fn();

function presentation(): ResultPresentation {
  if (!latest) throw new Error('Result presentation probe has not rendered.');
  return latest;
}

function calculate(values: CalculatorInputs): SiteOutputV1 {
  return calculateSiteCostV1(buildSiteInputsFromCalculatorInputs(values));
}

function Probe({
  values,
  result,
}: {
  values: CalculatorInputs;
  result: SiteOutputV1 | null;
}) {
  latest = useCalculatorResultPresentation({
    result,
    values,
    activeModule: values.modules[0],
    activeModuleIndex: 0,
    activeModuleLabel: 'Pergola 1 · Module 1',
    moduleRoutes: [{ pergolaId: 'pergola-1', localModuleIndex: 0 }],
    moduleViewsTab: 'plan',
    engineError: null,
    isCalculating: false,
    blindItems: values.blinds?.items ?? [],
    loadedEstimateDetail: null,
    isEditingDesign: false,
    resultFreshness: result ? 'current' : 'waiting',
    canViewInternalCosts: true,
    issuesCount: 2,
    openIssues,
    setModuleField,
  });
  return null;
}

afterEach(() => {
  latest = null;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('useCalculatorResultPresentation', () => {
  it('builds the active module, pricing, preview, and save view models', () => {
    const values = makeDefaultCalculatorInputs();
    const result = calculate(values);
    const rendered = renderIntoDocument(<Probe values={values} result={result} />);

    expect(presentation().moduleResult).toBe(result.pergolas[0].modules[0]);
    expect(presentation().modulePlanModel).not.toBeNull();
    expect(presentation().moduleSectionModel).not.toBeNull();
    expect(presentation().moduleViewsStatus).toBe('ready');
    expect(presentation().moduleViewsStatusDetail).toContain('derived geometry');
    expect(presentation().derivedArea).toBeGreaterThan(0);
    expect(presentation().pricingPreview.hasCorePricing).toBe(true);
    expect(presentation().saveDialogSummary).toMatchObject({
      modules: '1',
      activeModule: 'Pergola 1 · Module 1: pitched',
      roofSize: '6m × 3m',
    });
    expect(presentation().pricingSummaryProps).toMatchObject({
      issuesCount: 2,
      canViewInternalCosts: true,
    });
    expect(presentation().pricingSummaryProps.onOpenIssues).toBe(openIssues);
    expect(presentation().structureOutputRows.find((row) => row.label === 'Area (m²)')?.value).not.toBe('—');
    expect(presentation().bomPreview.length).toBeGreaterThan(0);
    expect(presentation().labourPreview.length).toBeGreaterThan(0);
    rendered.unmount();
  });

  it('tracks price impact baselines and clears invalid gutter elbow input', () => {
    const initialValues = makeDefaultCalculatorInputs();
    const initialResult = calculate(initialValues);
    const rendered = renderIntoDocument(<Probe values={initialValues} result={initialResult} />);

    expect(presentation().impactDiff).toBeNull();

    const changedValues: CalculatorInputs = {
      ...initialValues,
      modules: [{ ...initialValues.modules[0], lengthM: '8' }],
    };
    rendered.rerender(<Probe values={changedValues} result={calculate(changedValues)} />);
    expect(presentation().impactDiff).not.toBeNull();

    act(() => presentation().resetImpactBaseline());
    expect(presentation().impactDiff).toBeNull();
    rendered.unmount();

    const noGutterValues: CalculatorInputs = {
      ...initialValues,
      modules: [{
        ...initialValues.modules[0],
        overrides: { frontBeamProfile: '150x50' },
        invertedEnabled: true,
        invertedHouseGutter: true,
        downpipeElbowCount: '3',
      }],
    };
    const noGutterRendered = renderIntoDocument(<Probe values={noGutterValues} result={null} />);
    expect(setModuleField).toHaveBeenCalledWith('downpipeElbowCount', '0');
    noGutterRendered.unmount();
  });
});
