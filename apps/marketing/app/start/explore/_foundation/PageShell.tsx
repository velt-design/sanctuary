import * as React from 'react';
import { cn } from './cn';
import { T } from './tokens';

const PAGE_SHELL_CENTER_STYLE: React.CSSProperties = {
  width: '100%',
  maxWidth: '1360px',
  marginInline: 'auto',
};

export function PageShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(T.SHELL, className)} style={PAGE_SHELL_CENTER_STYLE}>
      {children}
    </div>
  );
}
