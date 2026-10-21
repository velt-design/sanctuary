import type { SVGProps } from 'react';
import ArrowIcon from './ArrowIcon';

/** Decorative arrow with deterministic rendering across mobile platforms. */
export default function ArrowUpRight(props: SVGProps<SVGSVGElement>) {
  return <ArrowIcon {...props} direction="up-right" />;
}
