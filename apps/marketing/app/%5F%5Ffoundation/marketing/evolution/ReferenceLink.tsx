'use client';

import { useSearchParams } from 'next/navigation';
import { TextLink } from '@/components/marketing-foundation';
import type { ReactNode } from 'react';

export default function ReferenceLink({ href, children }: { href: string; children: ReactNode }) {
  const params = useSearchParams();
  const next = new URLSearchParams();
  for (const key of ['composition', 'motion', 'still', 'roof']) {
    const value = params.get(key);
    if (value && /^(editorial|split|quiet|expressive|true|false|acrylic|solid|combination)$/.test(value)) next.set(key, value);
  }
  return <TextLink href={`${href}${next.size ? `?${next}` : ''}`}>{children}</TextLink>;
}
