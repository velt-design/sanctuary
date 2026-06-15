import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Reusable smooth expand/collapse. Animates height via the CSS grid
// `grid-template-rows: 0fr -> 1fr` trick, so it needs no JS height measuring and
// works with any (including dynamic) content. Respects reduced-motion.

type CollapseProps = {
  open: boolean;
  // When true, the content is forced open at the `md` breakpoint and up,
  // regardless of `open` (e.g. collapse on mobile, always show on desktop).
  openOnDesktop?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
};

export default function Collapse({
  open,
  openOnDesktop = false,
  id,
  className,
  children,
}: CollapseProps) {
  return (
    <div
      id={id}
      className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        openOnDesktop && 'md:grid-rows-[1fr]'
      )}
    >
      <div className={cn('min-h-0 overflow-hidden', className)}>{children}</div>
    </div>
  );
}
