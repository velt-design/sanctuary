'use client';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useNightAmount } from './DayNightTransition';

/** Capture the actual rendered design locally, after camera and lighting settle. */
export default function SceneSnapshot({ night, onCapture }: { night: boolean; onCapture: (image: string) => void }) {
  const { gl, scene, camera, invalidate } = useThree();
  const amount = useNightAmount();
  useEffect(() => {
    let frame = 0;
    const started = performance.now();
    const capture = () => {
      if (performance.now() - started > 6000) return;
      if (performance.now() - started < 1300 || Math.abs(amount.current - Number(night)) > .001 || !gl.domElement.dataset.camera) {
        invalidate(); frame = requestAnimationFrame(capture); return;
      }
      try {
        gl.render(scene, camera);
        onCapture(gl.domElement.toDataURL('image/webp', .88));
      } catch { /* Keep the actual live preview if this browser cannot capture. */ }
    };
    frame = requestAnimationFrame(capture);
    return () => cancelAnimationFrame(frame);
  }, [gl, scene, camera, invalidate, amount, night, onCapture]);
  return null;
}
