'use client';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ConfiguratorPublicPrice } from '../../lib/configuratorPublicPrice';
import type { PreviewDraft } from './previewDraft.types';
import { isInlineFunnelPath } from '../../lib/googleFunnel';
import { configuratorPriceStore } from '../../lib/configuratorPriceStore';

const serverPrice = () => null;

export function useConfiguratorPrice(draft: PreviewDraft, ready: boolean) {
  const key = JSON.stringify(draft), [attempt, setAttempt] = useState(0);
  const funnel = typeof window !== 'undefined' && isInlineFunnelPath(window.location.pathname);
  const subscribedKey = funnel && ready ? key : null;
  const subscribe = useCallback((listener: () => void) => configuratorPriceStore.subscribe(subscribedKey, listener), [subscribedKey]);
  const snapshot = useCallback(() => configuratorPriceStore.getSnapshot(subscribedKey), [subscribedKey]);
  const sharedPrice = useSyncExternalStore(subscribe, snapshot, serverPrice);
  const [reply, setReply] = useState<{ key: string; attempt: number; value: ConfiguratorPublicPrice } | null>(null);
  useEffect(() => {
    if (!ready || funnel) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/configurator-price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: controller.signal });
        const value = await response.json() as ConfiguratorPublicPrice;
        if (!controller.signal.aborted) setReply({ key, attempt, value });
      } catch { if (!controller.signal.aborted) setReply({ key, attempt, value: { status: 'unavailable' } }); }
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, attempt, ready, funnel]);
  return funnel ? { price: sharedPrice, retry: configuratorPriceStore.retry }
    : { price: reply?.key === key && reply.attempt === attempt ? reply.value : null, retry: () => setAttempt(value => value + 1) };
}
