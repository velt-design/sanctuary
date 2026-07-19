'use client';

import type { SiteOutputV1 } from '@sp/costing';
import { useEffect, useState } from 'react';

export type CalculatorCostingRequester = (
  requestPayloadJson: string,
  signal: AbortSignal,
) => Promise<SiteOutputV1>;

async function requestCalculatorCosting(
  requestPayloadJson: string,
  signal: AbortSignal,
): Promise<SiteOutputV1> {
  const response = await fetch('/api/staff/costing/v1/job', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: requestPayloadJson,
    signal,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(String(json?.error ?? 'Costing failed'));
  return json as SiteOutputV1;
}

export function useCalculatorCostingRequest(input: {
  readyToCalculate: boolean;
  requestPayloadJson: string;
  debounceMs?: number;
  request?: CalculatorCostingRequester;
}) {
  const [result, setResult] = useState<SiteOutputV1 | null>(null);
  const [lastSuccessfulRequestPayloadJson, setLastSuccessfulRequestPayloadJson] = useState<string | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const request = input.request ?? requestCalculatorCosting;
  const debounceMs = input.debounceMs ?? 200;

  useEffect(() => {
    if (!input.readyToCalculate) {
      setEngineError(null);
      setIsCalculating(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsCalculating(true);
      setEngineError(null);

      try {
        const nextResult = await request(input.requestPayloadJson, controller.signal);
        if (controller.signal.aborted) return;
        setResult(nextResult);
        setLastSuccessfulRequestPayloadJson(input.requestPayloadJson);
      } catch (error) {
        if (controller.signal.aborted) return;
        setEngineError(error instanceof Error ? error.message : 'Costing failed');
      } finally {
        if (!controller.signal.aborted) setIsCalculating(false);
      }
    }, debounceMs);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [debounceMs, input.readyToCalculate, input.requestPayloadJson, request]);

  return {
    result,
    lastSuccessfulRequestPayloadJson,
    engineError,
    isCalculating,
  };
}
