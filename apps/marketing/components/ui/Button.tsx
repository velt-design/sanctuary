import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

const VARIANT = {
  solid: 'bg-ink text-white hover:bg-ink/90',
  brand: 'bg-brand text-white hover:bg-brand/90',
  outline: 'border border-ink text-ink hover:bg-ink hover:text-white',
  ghost: 'text-ink hover:bg-panel',
} as const;

const SIZE = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-5 text-[13px] md:text-sm',
  lg: 'h-12 px-6 text-sm md:text-base',
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'solid', size = 'md', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full font-medium uppercase tracking-[0.08em]',
          'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
          'disabled:pointer-events-none disabled:opacity-50',
          VARIANT[variant],
          SIZE[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export type ButtonLinkProps = React.ComponentPropsWithoutRef<typeof Link> & {
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
};

export function ButtonLink({
  variant = 'solid',
  size = 'md',
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium uppercase tracking-[0.08em]',
        'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...props}
    />
  );
}
