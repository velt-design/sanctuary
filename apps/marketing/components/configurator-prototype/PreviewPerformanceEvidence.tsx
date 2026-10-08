import { useEffect, useRef, type ComponentRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls } from '@react-three/drei';

/** Development-only evidence, observable without exposing scene internals. */
export default function PreviewPerformanceEvidence() {
  const { gl, controls } = useThree();
  const sample = useRef({ active: false, intervals: [] as number[], frames: 0 });
  useFrame((_, delta) => {
    sample.current.frames++;
    if (sample.current.active) sample.current.intervals.push(delta * 1000);
    gl.domElement.dataset.renderEvidence = JSON.stringify({
      frames: sample.current.frames, calls: gl.info.render.calls,
      triangles: gl.info.render.triangles, pixelRatio: gl.getPixelRatio(),
    });
  });
  useEffect(() => {
    const orbit = controls as ComponentRef<typeof OrbitControls> | null;
    const start = () => { sample.current.active = true; sample.current.intervals = []; };
    const end = () => {
      sample.current.active = false;
      // The first frame includes idle time before pointerdown, not render work.
      const sorted = sample.current.intervals.slice(1).sort((a, b) => a - b);
      gl.domElement.dataset.orbitEvidence = JSON.stringify({ samples: sorted.length,
        medianMs: sorted[Math.floor(sorted.length * .5)] ?? null,
        p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] ?? null,
      });
    };
    orbit?.addEventListener('start', start);
    orbit?.addEventListener('end', end);
    return () => { orbit?.removeEventListener('start', start); orbit?.removeEventListener('end', end); };
  }, [controls, gl]);
  return null;
}
