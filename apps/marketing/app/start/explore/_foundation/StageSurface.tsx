import * as React from 'react';
import { cn } from './cn';
import { T } from './tokens';

export function StageSurface({
  size = 'standard',
  className,
  children,
}: {
  size?: 'standard' | 'wide' | 'auto';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(T.STAGE_SURFACE, size === 'standard' ? T.STAGE_H : '', size === 'wide' ? T.STAGE_WIDE_H : '', className)}>
      {children}
    </div>
  );
}
