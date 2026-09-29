'use client';

import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CalculatorInputs } from '@/lib/types/calculator';

export function useSimplePricingClassification({
  values,
  setValues,
  simpleEligible,
  resultIsCurrent = true,
}: {
  values: CalculatorInputs;
  setValues: Dispatch<SetStateAction<CalculatorInputs>>;
  simpleEligible: boolean;
  resultIsCurrent?: boolean;
}) {
  useEffect(() => {
    if (values.pricingClassification !== 'simple') return;
    if ((values.approvalRequirement ?? 'neither') === 'neither' && (!resultIsCurrent || simpleEligible)) return;
    setValues((previous) => previous.pricingClassification === 'simple'
      ? { ...previous, pricingClassification: 'bespoke' }
      : previous);
  }, [setValues, simpleEligible, resultIsCurrent, values.approvalRequirement, values.pricingClassification]);
}
