import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export const OVERLAY_CTA_BASE_CLASS =
  'absolute inline-flex items-center justify-center whitespace-nowrap border border-white/90 px-4 py-2 text-[12px] font-semibold uppercase leading-none tracking-[0.09em] text-white no-underline transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-60';

type OverlayCtaButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const OverlayCtaButton = React.forwardRef<HTMLButtonElement, OverlayCtaButtonProps>(
  ({ type = 'button', className, ...props }, ref) => {
    return <button ref={ref} type={type} data-overlay-cta="true" className={cn(OVERLAY_CTA_BASE_CLASS, className)} {...props} />;
  }
);

OverlayCtaButton.displayName = 'OverlayCtaButton';

type OverlayCtaLinkProps = React.ComponentPropsWithoutRef<typeof Link>;

export function OverlayCtaLink({ className, ...props }: OverlayCtaLinkProps) {
  return <Link data-overlay-cta="true" className={cn(OVERLAY_CTA_BASE_CLASS, className)} {...props} />;
}
