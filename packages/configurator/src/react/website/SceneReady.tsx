'use client';
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/** Signal after a rendered frame, not merely after the WebGL context exists. */
export default function SceneReady({ onReady }: { onReady?: () => void }) {
  const sent = useRef(false);
  const frame = useRef(0);
  useFrame(() => {
    if (!onReady || sent.current) return;
    sent.current = true;
    frame.current = requestAnimationFrame(onReady);
  });
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return null;
}

export function SceneFallbackReady({ onReady }: { onReady?: () => void }) {
  useEffect(() => { onReady?.(); }, [onReady]);
  return null;
}
