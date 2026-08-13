'use client';

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { isLocalQuoteId } from '@/lib/localFirst/portalEntities';
import { qk } from '@/lib/queries/keys';
import { deleteDraftQuoteVersion } from '@/lib/quotes/quotesRepo';

export type QuoteDeleteTarget = {
  id: string;
  quoteRef: string;
  versionNumber: number;
};

export function useQuoteDeletion({
  hostKey,
  selectedQuoteId,
  refreshQuotes,
  selectQuote,
}: {
  hostKey: string;
  selectedQuoteId: string | null;
  refreshQuotes: () => Promise<void>;
  selectQuote: (quoteId: string | null) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<QuoteDeleteTarget | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const requestDelete = useCallback((quote: QuoteDeleteTarget) => {
    if (isLocalQuoteId(quote.id)) {
      toast.error('Wait for the draft to finish syncing before deleting.');
      return;
    }
    setTarget(quote);
  }, [toast]);

  const cancelDelete = useCallback(() => {
    if (!pending) setTarget(null);
  }, [pending]);

  const confirmDelete = useCallback(async () => {
    if (!target || pending || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await deleteDraftQuoteVersion(target.id);
      queryClient.removeQueries({ queryKey: qk.quotes.detail(hostKey, target.id) });
      if (selectedQuoteId === target.id) selectQuote(null);
      setTarget(null);
      toast.success(`${target.quoteRef} v${target.versionNumber} deleted.`);
      try {
        await refreshQuotes();
      } catch {
        toast.error('The draft quote was deleted, but the quote list could not refresh. Refresh before taking another action; do not repeat the deletion.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete draft quote');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [hostKey, pending, queryClient, refreshQuotes, selectQuote, selectedQuoteId, target, toast]);

  return { target, pending, requestDelete, cancelDelete, confirmDelete };
}
