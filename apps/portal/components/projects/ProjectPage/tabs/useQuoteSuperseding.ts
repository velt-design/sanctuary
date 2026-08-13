'use client';

import { useCallback, useRef, useState } from 'react';
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
  const pendingRef = useRef(false);

  const supersedeQuote = useCallback(async (target: QuoteSupersedeTarget) => {
    if (pendingId || pendingRef.current) return;
    pendingRef.current = true;
    setPendingId(target.id);
    try {
      const updated = await markQuoteVersionSuperseded(target.id);
      queryClient.setQueryData(qk.quotes.detail(hostKey, target.id), updated);
      toast.success(`${target.quoteRef} v${target.versionNumber} marked superseded.`);
      try {
        await refreshQuotes();
      } catch {
        toast.error('The quote was marked superseded, but the quote list could not refresh. Refresh before taking another action; do not repeat the status change.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark quote superseded');
    } finally {
      pendingRef.current = false;
      setPendingId(null);
    }
  }, [hostKey, pendingId, queryClient, refreshQuotes, toast]);

  return { pendingId, supersedeQuote };
}
