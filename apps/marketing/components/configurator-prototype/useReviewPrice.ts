'use client';
import { useEffect, useState } from 'react';
import type { ReviewPrice } from '../../lib/configuratorReviewPrice';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';

export function useReviewPrice(input: SimpleCoverInput, roof: PreviewRoofChoices, ready: boolean, attempt = 0) {
  const key = JSON.stringify({ version: 1, input, roof });
  const [reply, setReply] = useState<{ key: string; value: ReviewPrice } | null>(null);
  useEffect(() => {
    if (!ready || process.env.NODE_ENV !== 'development') return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/configurator-review-price', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: controller.signal,
        });
        const value = await response.json() as ReviewPrice;
        if (!controller.signal.aborted) setReply({ key, value });
      } catch { if (!controller.signal.aborted) setReply({ key, value: { status: 'unavailable' } }); }
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, ready, attempt]);
  // Hide any previous price immediately, before a new request finishes.
  const max = input.level === 'ground' ? 30 : 20;
  if (input.widthMm * input.projectionMm > max * 1_000_000)
    return { status: 'custom', reason: 'Your design needs a tailored quote.' } as const;
  return reply?.key === key ? reply.value : null;
}
