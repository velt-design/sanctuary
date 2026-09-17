import type { SVGProps } from 'react';

/** Decorative arrow with deterministic rendering across mobile platforms. */
export default function ArrowUpRight({ style, ...props }: SVGProps<SVGSVGElement>) {
  return <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props} style={{ display: 'inline-block', verticalAlign: '-0.125em', flexShrink: 0, ...style }} aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14" /></svg>;
}
