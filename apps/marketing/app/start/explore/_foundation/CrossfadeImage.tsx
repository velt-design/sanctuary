'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from './cn';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { T } from './tokens';

export function CrossfadeImage({
  src,
  alt,
  fit = 'cover',
  position = 'center',
  className,
  priority,
}: {
  src: string;
  alt: string;
  fit?: 'cover' | 'contain';
  position?: string;
  className?: string;
  priority?: boolean;
}) {
  const reduced = usePrefersReducedMotion();

  const [baseSrc, setBaseSrc] = React.useState(src);
  const [overlaySrc, setOverlaySrc] = React.useState<string | null>(null);
  const [overlayOn, setOverlayOn] = React.useState(false);

  React.useEffect(() => {
    if (src === baseSrc) return;

    if (reduced) {
      setBaseSrc(src);
      setOverlaySrc(null);
      setOverlayOn(false);
      return;
    }

    setOverlaySrc(src);
    setOverlayOn(false);

    const raf = requestAnimationFrame(() => setOverlayOn(true));
    const timeoutId = window.setTimeout(() => {
      setBaseSrc(src);
      setOverlaySrc(null);
      setOverlayOn(false);
    }, T.DUR_SWAP);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeoutId);
    };
  }, [baseSrc, reduced, src]);

  const objectClass = fit === 'contain' ? 'object-contain' : 'object-cover';

  return (
    <div className={cn('absolute inset-0', className)}>
      <Image
        src={baseSrc}
        alt={alt}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 60vw, 100vw"
        className={cn(objectClass)}
        style={{ objectPosition: position }}
      />

      {overlaySrc ? (
        <Image
          src={overlaySrc}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          className={cn(objectClass, 'transition-opacity')}
          style={{
            objectPosition: position,
            opacity: overlayOn ? 1 : 0,
            transitionDuration: `${T.DUR_SWAP}ms`,
          }}
        />
      ) : null}
    </div>
  );
}
