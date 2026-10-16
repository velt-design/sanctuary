'use client';

import type { ReactNode } from 'react';
import { DataStatePanel, LoadingSkeleton } from '@/components/ui/foundation';

export default function CalculatorSessionBoundary({
  ready,
  error,
  onRetry,
  children,
}: {
  ready: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (error) {
    return <DataStatePanel state="error" title="Could not open estimate" description={error} onRetry={onRetry} />;
  }
  if (!ready) return <LoadingSkeleton rows={4} columns={4} label="Opening estimate" />;
  return children;
}
