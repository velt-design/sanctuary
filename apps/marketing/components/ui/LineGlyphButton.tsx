import * as React from 'react';
import { cn } from '@/lib/cn';

type LineGlyphButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const LineGlyphButton = React.forwardRef<HTMLButtonElement, LineGlyphButtonProps>(
  ({ type = 'button', className, ...props }, ref) => {
    return <button ref={ref} type={type} className={cn('ui-line-glyph-btn', className)} {...props} />;
  }
);

LineGlyphButton.displayName = 'LineGlyphButton';

