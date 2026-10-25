"use client";

import { useMemo, type ReactNode } from 'react';
import { CalculatorSessionReadProvider } from './CalculatorSessionReadContext';

export default function CalculatorSessionBoundary({ ready, error, onRetry, children }: {
  ready: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ ready: ready && !error, error, onRetry }), [ready, error, onRetry]);
  return <CalculatorSessionReadProvider value={value}>{children}</CalculatorSessionReadProvider>;
}
