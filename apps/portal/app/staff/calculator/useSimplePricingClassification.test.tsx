import { act, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { CalculatorInputs } from '@/lib/types/calculator';
import { makeDefaultCalculatorInputs } from './calculatorInputs';
import { useSimplePricingClassification } from './useSimplePricingClassification';

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
