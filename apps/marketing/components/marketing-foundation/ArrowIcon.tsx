import type { SVGProps } from 'react';

const paths = {
  'up-right': 'M5 19 19 5M5 5h14v14',
  'down-right': 'M5 5 19 19M5 19h14V5',
  right: 'M4 12h16m-7-7 7 7-7 7',
  left: 'M20 12H4m7-7-7 7 7 7',
  down: 'M12 4v16m-7-7 7 7 7-7',
  up: 'M12 20V4m-7 7 7-7 7 7',
  horizontal: 'M4 12h16M9 7l-5 5 5 5m6-10 5 5-5 5',
} as const;

/** Decorative geometry, never a font glyph or platform emoji. Label the containing control. */
export default function ArrowIcon({ direction = 'up-right', style, ...props }: SVGProps<SVGSVGElement> & { direction?: keyof typeof paths }) {
  return <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props} style={{ display: 'inline-block', verticalAlign: '-0.125em', flexShrink: 0, ...style }} aria-hidden="true" focusable="false" data-arrow-icon={direction}><path d={paths[direction]} /></svg>;
}
