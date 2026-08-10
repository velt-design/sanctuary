'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { qk } from '@/lib/queries/keys';
import { markQuoteVersionSuperseded } from '@/lib/quotes/quotesRepo';

export type QuoteSupersedeTarget = {
  id: string;
  quoteRef: string;
  versionNumber: number;
};

export function useQuoteSuperseding({
  hostKey,
  refreshQuotes,
}: {
  hostKey: string;
  refreshQuotes: () => Promise<void>;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const supersedeQuote = useCallback(async (target: QuoteSupersedeTarget) => {
    if (pendingId) return;
    setPendingId(target.id);
    try {
      const updated = await markQuoteVersionSuperseded(target.id);
      queryClient.setQueryData(qk.quotes.detail(hostKey, target.id), updated);
      await refreshQuotes();
      toast.success(`${target.quoteRef} v${target.versionNumber} marked superseded.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark quote superseded');
    } finally {
      setPendingId(null);
    }
  }, [hostKey, pendingId, queryClient, refreshQuotes, toast]);

  return { pendingId, supersedeQuote };
}
