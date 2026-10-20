'use client';

import { Suspense, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { events, type CanvasProps } from '@react-three/fiber';
import { FiberProvider } from 'its-fine';
import useMeasure from 'react-use-measure';
import { registerSceneCatalogue } from './sceneCatalogue';
import { SceneErrorRelay, SceneSuspenseRelay, useSceneContextBridge } from './sceneContextBridge';
import { SceneRootLifecycle } from './sceneRootLifecycle';

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function SceneCanvasHost({
  ref, children, fallback, resize, style, eventSource, eventPrefix,
  gl, scene, shadows, linear, flat, legacy, orthographic, frameloop, dpr,
  performance, raycaster, camera, onCreated, onPointerMissed,
  events: eventFactory = events, ...attributes
}: CanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const lifecycle = useRef<SceneRootLifecycle | null>(null);
  const callbacks = useRef({ onCreated, onPointerMissed });
  const [measure, size] = useMeasure({ scroll: true, debounce: { scroll: 50, resize: 0 }, ...resize });
  const Bridge = useSceneContextBridge();
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const [pending, setPending] = useState<Promise<void> | null>(null);
  const reportError = useCallback((error: unknown) => setFailure({ error }), []);
  const reportPending = useCallback((value: Promise<void> | null) => setPending(value), []);
  useImperativeHandle(ref, () => canvas.current!);
  useBrowserLayoutEffect(() => { callbacks.current = { onCreated, onPointerMissed }; });

  useBrowserLayoutEffect(() => {
    if (!canvas.current) return;
    registerSceneCatalogue();
    lifecycle.current ??= new SceneRootLifecycle(canvas.current, reportError);
    lifecycle.current.resume();
  }, [reportError]);

  // Passive cleanup distinguishes actual unmount from Suspense hiding layout
  // effects while a scene asset is loading.
  useEffect(() => {
    const session = lifecycle.current;
    session?.resume();
    return () => session?.release();
  }, []);

  useBrowserLayoutEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;
    lifecycle.current?.update({
      options: {
        gl, scene, shadows, linear, flat, legacy, orthographic, frameloop, dpr,
        performance, raycaster, camera, events: eventFactory, size,
        onPointerMissed: (event) => callbacks.current.onPointerMissed?.(event),
        onCreated: (state) => {
          const target = eventSource && 'current' in eventSource ? eventSource.current : eventSource;
          state.events.connect?.(target ?? wrapper.current!);
          if (eventPrefix) state.setEvents({
            compute: (event, current) => {
              const x = event[`${eventPrefix}X` as keyof typeof event] as number;
              const y = event[`${eventPrefix}Y` as keyof typeof event] as number;
              current.pointer.set(x / current.size.width * 2 - 1, -(y / current.size.height) * 2 + 1);
              current.raycaster.setFromCamera(current.pointer, current.camera);
            },
          });
          callbacks.current.onCreated?.(state);
        },
      },
      children: <Bridge><SceneErrorRelay report={reportError}>
        <Suspense fallback={<SceneSuspenseRelay report={reportPending} />}>{children}</Suspense>
      </SceneErrorRelay></Bridge>,
    });
  });

  if (failure) throw failure.error;
  if (pending) throw pending;
  return <div ref={wrapper} style={{
    position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
    pointerEvents: eventSource ? 'none' : 'auto', ...style,
  }} {...attributes}>
    <div ref={measure} style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvas} style={{ display: 'block' }}>{fallback}</canvas>
    </div>
  </div>;
}

export function SceneCanvas(props: CanvasProps) {
  return <FiberProvider><SceneCanvasHost {...props} /></FiberProvider>;
}
