'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { qk } from '@/lib/queries/keys';
import { updateQuoteInternalName } from '@/lib/quotes/quotesRepo';
import type { QuoteVersion, QuoteVersionDetail } from '@/lib/quotes/types';

export function useQuoteInternalName({
  hostKey,
  projectId,
  quotes,
}: {
  hostKey: string;
  projectId: string;
  quotes: QuoteVersion[];
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [target, setTarget] = useState<QuoteVersion | null>(null);
  const [pending, setPending] = useState(false);

  const save = async (internalName: string | null) => {
    if (!target || pending) return;
    setPending(true);
    try {
      const updated = await updateQuoteInternalName(target.id, internalName);
      queryClient.setQueryData<QuoteVersion[]>(
        qk.quotes.versionsByProject(hostKey, projectId),
        (current) => (current ?? []).map((quote) => (
          quote.quoteId === updated.quoteId ? { ...quote, internalName: updated.internalName } : quote
        )),
      );
      for (const quote of quotes) {
        if (quote.quoteId !== updated.quoteId) continue;
        queryClient.setQueryData<QuoteVersionDetail>(
          qk.quotes.detail(hostKey, quote.id),
          (current) => current ? { ...current, internalName: updated.internalName } : current,
        );
      }
      setTarget(null);
      toast.success(internalName ? 'Quote name updated.' : 'Quote name cleared.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update quote name');
    } finally {
      setPending(false);
    }
  };

  return {
    target,
    pending,
    open: setTarget,
    close: () => { if (!pending) setTarget(null); },
    save,
  };
}
