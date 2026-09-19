'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import css from './mobileJourney.module.css';

/** Keep an opaque, decoded image underneath the next choice throughout its fade. */
export default function MobileRoofImage({ src, alt }: { src: string; alt: string }) {
  const [shown, setShown] = useState({ src, alt });
  const [ready, setReady] = useState<string | null>(null);
  const current = useRef(src);
  current.current = src;
  const pending = src !== shown.src;
  useEffect(() => { setReady(null); }, [src]);
  return <>
    <Image src={shown.src} alt={pending ? '' : alt} aria-hidden={pending || undefined} fill sizes="(max-width:720px) 100vw, 720px" priority fetchPriority="high" />
    {pending && <Image key={src} src={src} alt={alt} fill sizes="(max-width:720px) 100vw, 720px" priority fetchPriority="high"
      className={css.roofImageIncoming} data-ready={ready === src}
      onLoad={async event => {
        const element = event.currentTarget;
        try { await element.decode(); } catch { return; }
        // Give even a cached image an initial painted frame before fading it in.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (current.current !== src || !element.isConnected) return;
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setShown({ src, alt });
          else setReady(src);
        }));
      }}
      onTransitionEnd={event => {
        if (event.propertyName === 'opacity' && ready === src && current.current === src) {
          setShown({ src, alt });
          setReady(null);
        }
      }} />}
  </>;
}
