'use client';
import { useEffect, useRef, useState } from 'react';

/** Hold the framing during input; refit from the current frame on release. */
export function useFootprintScale(target: number, interacting: boolean) {
  const [scale, setScale] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (interacting) return;
    const from = current.current;
    if (from === target) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      current.current = target;
      setScale(target);
      return;
    }
    let frame = 0;
    let start: number | undefined;
    function tick(now: number) {
      start ??= now;
      const progress = Math.min(1, (now - start) / 650);
      // Smooth start and finish, with no overshoot; interpolate zoom proportionally.
      const eased = progress * progress * (3 - 2 * progress);
      current.current = from * Math.pow(target / from, eased);
      setScale(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, interacting]);
  return scale;
}
