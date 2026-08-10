'use client';

import { useCallback, useState } from 'react';
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
    if (!target || pending) return;
    setPending(true);
    try {
      await deleteDraftQuoteVersion(target.id);
      queryClient.removeQueries({ queryKey: qk.quotes.detail(hostKey, target.id) });
      if (selectedQuoteId === target.id) selectQuote(null);
      await refreshQuotes();
      setTarget(null);
      toast.success(`${target.quoteRef} v${target.versionNumber} deleted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete draft quote');
    } finally {
      setPending(false);
    }
  }, [hostKey, pending, queryClient, refreshQuotes, selectQuote, selectedQuoteId, target, toast]);

  return { target, pending, requestDelete, cancelDelete, confirmDelete };
}
