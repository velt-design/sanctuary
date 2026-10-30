'use client';

import { Suspense, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { events, useFrame, useThree, type CanvasProps } from '@react-three/fiber';
import { FiberProvider } from 'its-fine';
import useMeasure from 'react-use-measure';
import { registerSceneCatalogue } from './sceneCatalogue';
import { SceneErrorRelay, SceneSuspenseRelay, useSceneContextBridge } from './sceneContextBridge';
import { SceneRootLifecycle } from './sceneRootLifecycle';

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export type SceneCanvasProps = CanvasProps & {
  /** Opt-in presentation pause. Initial inactive mounts one hidden scene; later
   * inactive input/context/size changes are deferred. Reveal keeps the same root
   * and camera and draws latest inputs before exposing the canvas. A pending
   * reveal survives prop omission and zero size. Omission otherwise preserves
   * ordinary always-active Canvas behavior and caller visibility. */
  active?: boolean;
};
type Activation = { active: boolean; serial: number; revealing: boolean; visibility: string };
function SceneActivation({ surface, activation, serial }: {
  surface: HTMLDivElement; activation: { current: Activation }; serial: number;
}) {
  const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => { if (activation.current.active) invalidate(); }, [activation, serial, invalidate]);
  useFrame(() => {
    const current = activation.current;
    // A frame from an obsolete configure/commit cannot expose a stale scene.
    if (current.active && current.revealing && current.serial === serial) {
      current.revealing = false;
      surface.style.visibility = current.visibility;
    }
  }, -100);
  return null;
}

function SceneCanvasHost({
  ref, children, fallback, resize, style, eventSource, eventPrefix, active,
  gl, scene, shadows, linear, flat, legacy, orthographic, frameloop, dpr,
  performance, raycaster, camera, onCreated, onPointerMissed,
  events: eventFactory = events, ...attributes
}: SceneCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const lifecycle = useRef<SceneRootLifecycle | null>(null);
  const callbacks = useRef({ onCreated, onPointerMissed });
  const [measure, size, forceRefresh] = useMeasure({ scroll: true, debounce: { scroll: 50, resize: 0 }, ...resize });
  // Prime the same bounds owner after its passive mount guard, without waiting for ResizeObserver.
  useEffect(() => { forceRefresh(); }, [forceRefresh]);
  const Bridge = useSceneContextBridge(active !== false);
  const initialized = useRef(false);
  const activation = useRef<Activation>({ active: active !== false, serial: 0, revealing: active !== undefined, visibility: style?.visibility ?? "" });
  useBrowserLayoutEffect(() => {
    const state = activation.current;
    // Removing an optional prop does not relinquish an already hidden surface.
    // Its pending reveal remains owned until the latest committed frame draws.
    const ownsReveal = active !== undefined || state.revealing || !state.active;
    if (ownsReveal && (!state.active || !initialized.current)) state.revealing = true;
    state.active = active !== false;
    state.visibility = style?.visibility ?? "";
    if (ownsReveal && (!state.active || state.revealing) && wrapper.current)
      wrapper.current.style.visibility = 'hidden';
  });
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
    // Even an unmeasured/paused request revokes the previous observer. A queued
    // old frame cannot reveal a scene whose latest inputs cannot commit yet.
    const serial = ++activation.current.serial;
    const node = canvas.current, surface = wrapper.current;
    if (!node || !surface || size.width <= 0 || size.height <= 0 || (active === false && initialized.current)) return;
    initialized.current = true;
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
        <Suspense fallback={<SceneSuspenseRelay report={reportPending} />}>
          {children}
          {(active !== undefined || activation.current.revealing) && <SceneActivation surface={surface} activation={activation} serial={serial} />}
        </Suspense>
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

export function SceneCanvas(props: SceneCanvasProps) {
  return <FiberProvider><SceneCanvasHost {...props} /></FiberProvider>;
}
