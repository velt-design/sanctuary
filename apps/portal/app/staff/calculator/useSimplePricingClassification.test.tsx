import { act, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { CalculatorInputs } from '@/lib/types/calculator';
import { makeDefaultCalculatorInputs } from './calculatorInputs';
import { useSimplePricingClassification } from './useSimplePricingClassification';
import { COSTING_CONTROL_PREVIEW_SCENARIOS_V1, evaluateSimpleRangeEligibilityV2, loadCostingConfigV1 } from '@sp/costing';

let latest: CalculatorInputs | null = null;

function Probe({ eligible, approval = 'neither' }: { eligible: boolean; approval?: CalculatorInputs['approvalRequirement'] }) {
  const [values, setValues] = useState<CalculatorInputs>({
    ...makeDefaultCalculatorInputs(),
    pricingClassification: 'simple',
    approvalRequirement: approval,
  });
  latest = values;
  useSimplePricingClassification({ values, setValues, simpleEligible: eligible });
  return null;
}

afterEach(() => {
  latest = null;
  document.body.innerHTML = '';
});

describe('useSimplePricingClassification', () => {
  it('keeps an acrylic-side job Simple through UI classification while preserving historical server policy', () => {
    const request = structuredClone(COSTING_CONTROL_PREVIEW_SCENARIOS_V1[0].inputs);
    request.pricing_classification = 'simple';
    request.pergolas[0].modules[0].infills = [{
      id: 'side', location: 'side', acrylic_source: 'sheet_panels',
      panel_orientation: 'vertical', width_mode: 'target_width',
      support: { has_top: true, has_bottom: true, has_left: true, has_right: true, internal_support_mode: 'none' },
      shape: { type: 'rect', width_m: 2, height_m: 2.4 },
    }];
    const eligible = evaluateSimpleRangeEligibilityV2(request).eligible;
    const rendered = renderIntoDocument(<Probe eligible={eligible} />);
    act(() => undefined);
    expect(latest?.pricingClassification).toBe('simple');
    expect(evaluateSimpleRangeEligibilityV2(request, {
      ...loadCostingConfigV1(), appliedControlManifestVersion: 'v2.7',
    }).reason_codes).toContain('INFILLS_INCLUDED');
    rendered.unmount();
  });
  it('automatically steps an ineligible design to Bespoke', () => {
    const rendered = renderIntoDocument(<Probe eligible={false} />);
    act(() => undefined);
    expect(latest?.pricingClassification).toBe('bespoke');
    rendered.unmount();
  });

  it('automatically steps approval work to Bespoke', () => {
    const rendered = renderIntoDocument(<Probe eligible approval="engineering_required" />);
    act(() => undefined);
    expect(latest?.pricingClassification).toBe('bespoke');
    rendered.unmount();
  });
});
