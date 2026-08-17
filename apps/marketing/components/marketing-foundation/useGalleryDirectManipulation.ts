'use client';

import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react';

type GesturePhase = 'idle' | 'pending-intent' | 'dragging-horizontal' | 'settling';

type GestureState = {
  activeIndex: number;
  currentX: number;
  frameId: number | null;
  phase: GesturePhase;
  pointerId: number | null;
  settleTimer: number | null;
  startX: number;
  startY: number;
  viewportWidth: number;
};

type UseGalleryDirectManipulationOptions = {
  activeIndex: number;
  enabled: boolean;
  itemSignature: string;
  onActivate: () => void;
  onCommit: (offset: -1 | 1) => void;
};

const COMMIT_THRESHOLD_PX = 48;
const INTENT_THRESHOLD_PX = 8;
const HORIZONTAL_DOMINANCE_RATIO = 1.2;
const SETTLE_DURATION_MS = 160;

function createIdleGesture(): GestureState {
  return {
    activeIndex: 0,
    currentX: 0,
    frameId: null,
    phase: 'idle',
    pointerId: null,
    settleTimer: null,
    startX: 0,
    startY: 0,
    viewportWidth: 0,
  };
}

export function useGalleryDirectManipulation({
  activeIndex,
  enabled,
  itemSignature,
  onActivate,
  onCommit,
}: UseGalleryDirectManipulationOptions): {
  handlers: {
    onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  };
  viewportRef: RefObject<HTMLDivElement | null>;
} {
  const viewportRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<GestureState>(createIdleGesture());
  const commitRef = useRef(onCommit);
  const activateRef = useRef(onActivate);
  commitRef.current = onCommit;
  activateRef.current = onActivate;

  const setPhase = useCallback((phase: GesturePhase) => {
    gestureRef.current.phase = phase;
    if (viewportRef.current) {
      viewportRef.current.dataset.galleryGesture = phase;
    }
  }, []);

  const writeOffset = useCallback((offset: number) => {
    viewportRef.current?.style.setProperty('--gallery-drag-x', `${offset}px`);
  }, []);

  const clearScheduledWork = useCallback(() => {
    const gesture = gestureRef.current;
    if (gesture.frameId !== null) {
      window.cancelAnimationFrame(gesture.frameId);
      gesture.frameId = null;
    }
    if (gesture.settleTimer !== null) {
      window.clearTimeout(gesture.settleTimer);
      gesture.settleTimer = null;
    }
  }, []);

  const releasePointer = useCallback(() => {
    const viewport = viewportRef.current;
    const pointerId = gestureRef.current.pointerId;
    if (
      viewport
      && pointerId !== null
      && viewport.hasPointerCapture?.(pointerId)
    ) {
      try {
        viewport.releasePointerCapture?.(pointerId);
      } catch {
        // Capture may already have been released by the browser.
      }
    }
  }, []);

  const resetGesture = useCallback(() => {
    clearScheduledWork();
    releasePointer();
    writeOffset(0);
    gestureRef.current = createIdleGesture();
    if (viewportRef.current) {
      viewportRef.current.dataset.galleryGesture = 'idle';
    }
  }, [clearScheduledWork, releasePointer, writeOffset]);

  const scheduleOffset = useCallback((offset: number) => {
    const gesture = gestureRef.current;
    gesture.currentX = gesture.startX + offset;
    if (gesture.frameId !== null) return;

    gesture.frameId = window.requestAnimationFrame(() => {
      const current = gestureRef.current;
      current.frameId = null;
      const rawOffset = current.currentX - current.startX;
      const boundedOffset = Math.max(
        -current.viewportWidth,
        Math.min(current.viewportWidth, rawOffset),
      );
      writeOffset(boundedOffset);
    });
  }, [writeOffset]);

  const settle = useCallback((offset: -1 | 0 | 1) => {
    const gesture = gestureRef.current;
    clearScheduledWork();
    setPhase('settling');
    releasePointer();

    const target = offset === 0 ? 0 : (offset > 0 ? -1 : 1) * gesture.viewportWidth;
    writeOffset(target);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    gesture.settleTimer = window.setTimeout(() => {
      if (offset !== 0) commitRef.current(offset);
      resetGesture();
    }, reducedMotion ? 0 : SETTLE_DURATION_MS);
  }, [clearScheduledWork, releasePointer, resetGesture, setPhase, writeOffset]);

  const cancelGesture = useCallback((animate: boolean) => {
    const phase = gestureRef.current.phase;
    if (phase === 'idle') return;
    if (animate && phase === 'dragging-horizontal') {
      settle(0);
      return;
    }
    resetGesture();
  }, [resetGesture, settle]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return;

    if (gestureRef.current.phase !== 'idle') {
      cancelGesture(false);
      return;
    }

    const supportedPointer = event.pointerType === 'touch' || event.pointerType === 'pen';
    if (!supportedPointer || event.isPrimary === false) return;

    const width = event.currentTarget.getBoundingClientRect().width
      || event.currentTarget.clientWidth
      || 1;
    gestureRef.current = {
      activeIndex,
      currentX: event.clientX,
      frameId: null,
      phase: 'pending-intent',
      pointerId: event.pointerId,
      settleTimer: null,
      startX: event.clientX,
      startY: event.clientY,
      viewportWidth: width,
    };
    setPhase('pending-intent');
    activateRef.current();
  }, [activeIndex, cancelGesture, enabled, setPhase]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;

    const horizontalDistance = event.clientX - gesture.startX;
    const verticalDistance = event.clientY - gesture.startY;
    const horizontalMagnitude = Math.abs(horizontalDistance);
    const verticalMagnitude = Math.abs(verticalDistance);

    if (gesture.phase === 'pending-intent') {
      if (
        verticalMagnitude >= INTENT_THRESHOLD_PX
        && verticalMagnitude > horizontalMagnitude
      ) {
        resetGesture();
        return;
      }

      if (
        horizontalMagnitude < INTENT_THRESHOLD_PX
        || horizontalMagnitude < verticalMagnitude * HORIZONTAL_DOMINANCE_RATIO
      ) {
        return;
      }

      setPhase('dragging-horizontal');
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic browser tests may not register an active native pointer.
      }
    }

    if (gestureRef.current.phase !== 'dragging-horizontal') return;
    event.preventDefault();
    scheduleOffset(horizontalDistance);
  }, [resetGesture, scheduleOffset, setPhase]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;
    if (gesture.phase === 'pending-intent') {
      resetGesture();
      return;
    }
    if (gesture.phase !== 'dragging-horizontal') return;

    const horizontalDistance = event.clientX - gesture.startX;
    gesture.currentX = event.clientX;
    settle(
      Math.abs(horizontalDistance) >= COMMIT_THRESHOLD_PX
        ? (horizontalDistance < 0 ? 1 : -1)
        : 0,
    );
  }, [resetGesture, settle]);

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (gestureRef.current.pointerId === event.pointerId) cancelGesture(true);
  }, [cancelGesture]);

  const handleLostPointerCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (
      gesture.pointerId === event.pointerId
      && (gesture.phase === 'pending-intent' || gesture.phase === 'dragging-horizontal')
    ) {
      cancelGesture(true);
    }
  }, [cancelGesture]);

  useEffect(() => {
    const handleResize = () => cancelGesture(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') cancelGesture(false);
    };
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cancelGesture]);

  useEffect(() => {
    cancelGesture(false);
  }, [activeIndex, cancelGesture, itemSignature]);

  useEffect(() => () => resetGesture(), [resetGesture]);

  return {
    handlers: {
      onLostPointerCapture: handleLostPointerCapture,
      onPointerCancel: handlePointerCancel,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
    viewportRef,
  };
}
