import * as React from 'react';
import { cn } from './cn';
import { T } from './tokens';

export function PageShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn(T.SHELL, className)}>{children}</div>;
}
