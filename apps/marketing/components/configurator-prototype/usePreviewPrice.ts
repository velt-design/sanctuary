'use client';

import { useEffect, useState } from 'react';
import type { SimpleCoverInput, SimpleCoverPublicResult } from '../../lib/simpleCoverCalculator';
import { sameSimpleCoverInput } from './model';

export function usePreviewPrice(input: SimpleCoverInput, enabled = true) {
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<{ input: SimpleCoverInput; attempt: number; result: SimpleCoverPublicResult } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const result: SimpleCoverPublicResult = await fetch('/api/simple-cover-price', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input), signal: controller.signal,
        }).then((res) => res.json());
        if ('input' in result && !sameSimpleCoverInput(result.input, input)) throw new Error('Mismatched estimate');
        if (active) setResponse({ input, attempt, result });
      } catch {
        if (active) setResponse({ input, attempt, result: {
          ok: false, status: 'unavailable', message: 'Estimate unavailable. You can keep exploring your design.',
        } });
      }
    }, 220);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [input, attempt, enabled]);
  const current = response && response.attempt === attempt && sameSimpleCoverInput(response.input, input);
  return { result: current ? response.result : null, retry: () => setAttempt((value) => value + 1) };
}
