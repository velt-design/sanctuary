'use client';
import { useEffect, useState } from 'react';
import type { ConfiguratorPublicPrice } from '../../lib/configuratorPublicPrice';
import type { PreviewDraft } from './previewDraft.types';

export function useConfiguratorPrice(draft: PreviewDraft, ready: boolean) {
  const key = JSON.stringify(draft), [attempt, setAttempt] = useState(0);
  const [reply, setReply] = useState<{ key: string; attempt: number; value: ConfiguratorPublicPrice } | null>(null);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/configurator-price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: controller.signal });
        const value = await response.json() as ConfiguratorPublicPrice;
        if (!controller.signal.aborted) setReply({ key, attempt, value });
      } catch { if (!controller.signal.aborted) setReply({ key, attempt, value: { status: 'unavailable' } }); }
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, attempt, ready]);
  return { price: reply?.key === key && reply.attempt === attempt ? reply.value : null, retry: () => setAttempt(value => value + 1) };
}
