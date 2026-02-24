import * as React from 'react';
import { cn } from './cn';

export function DebugFrame({
  enabled,
  label,
  className,
  children,
}: {
  enabled?: boolean;
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(className, enabled && 'relative outline outline-1 outline-rose-500/30')}>
      {enabled && label ? (
        <div className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-700">
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}
