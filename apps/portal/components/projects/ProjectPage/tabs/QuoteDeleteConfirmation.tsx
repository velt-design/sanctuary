'use client';

import { useEffect, useState } from 'react';
import { DestructiveConfirmation } from '@/components/ui/foundation';
import type { QuoteDeleteTarget } from './useQuoteDeletion';

export default function QuoteDeleteConfirmation({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: QuoteDeleteTarget | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [value, setValue] = useState('');
  const confirmationText = target ? `DELETE ${target.quoteRef}` : 'DELETE';

  useEffect(() => setValue(''), [target]);

  return (
    <DestructiveConfirmation
      open={Boolean(target)}
      title="Delete draft quote"
      description={target ? `Permanently delete ${target.quoteRef} version ${target.versionNumber}.` : 'Permanently delete this draft quote.'}
      confirmationText={confirmationText}
      value={value}
      onValueChange={setValue}
      pending={pending}
      onCancel={onCancel}
      onConfirm={onConfirm}
      consequences="Only unsent draft quotes can be deleted. Sent or accepted quotes remain part of the commercial record."
    />
  );
}
