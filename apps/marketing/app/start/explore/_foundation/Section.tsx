import * as React from 'react';
import { cn } from './cn';
import { T } from './tokens';
import { PageShell } from './PageShell';

export function Section({
  tone = 'plain',
  className,
  children,
}: {
  tone?: 'plain' | 'tint';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(tone === 'tint' ? T.TINT_BG : 'bg-white', T.SECTION_Y, className)}>
      <PageShell>{children}</PageShell>
    </section>
  );
}
