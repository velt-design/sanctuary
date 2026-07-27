'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export const CALCULATOR_PREVIEW_SPLIT_STORAGE_KEY = 'sanctuary-portal:calculator:previewRightWidthPx:v2';
export const CALCULATOR_PREVIEW_SPLIT_STACK_BREAKPOINT_PX = 1080;
const CALCULATOR_PREVIEW_SPLIT_LEFT_MIN_PX = 640;
export const CALCULATOR_PREVIEW_SPLIT_RIGHT_MIN_PX = 360;
const CALCULATOR_PREVIEW_SPLIT_HANDLE_WIDTH_PX = 18;

const CALCULATOR_PREVIEW_SPLIT_COMPACT_DEFAULT_PX = 440;
const CALCULATOR_PREVIEW_SPLIT_WIDE_DEFAULT_PX = 480;
const CALCULATOR_PREVIEW_SPLIT_WIDE_FRAME_PX = 1280;

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function calculatorPreviewDefaultRightWidth(frameWidthPx: number): number {
  return frameWidthPx >= CALCULATOR_PREVIEW_SPLIT_WIDE_FRAME_PX
    ? CALCULATOR_PREVIEW_SPLIT_WIDE_DEFAULT_PX
    : CALCULATOR_PREVIEW_SPLIT_COMPACT_DEFAULT_PX;
}

export function calculatorPreviewMaxRightWidth(frameWidthPx: number): number {
  if (!Number.isFinite(frameWidthPx) || frameWidthPx <= 0) {
    return CALCULATOR_PREVIEW_SPLIT_WIDE_DEFAULT_PX;
  }
  const max = Math.floor(
    frameWidthPx - CALCULATOR_PREVIEW_SPLIT_LEFT_MIN_PX - CALCULATOR_PREVIEW_SPLIT_HANDLE_WIDTH_PX,
  );
  return Math.max(CALCULATOR_PREVIEW_SPLIT_RIGHT_MIN_PX, max);
}

export function calculatorPreviewRightWidth(
  frameWidthPx: number,
  preferredRightWidthPx: number | null,
): number {
  const maxWidth = calculatorPreviewMaxRightWidth(frameWidthPx);
  const requestedWidth = preferredRightWidthPx ?? calculatorPreviewDefaultRightWidth(frameWidthPx);
  return Math.round(clampNumber(requestedWidth, CALCULATOR_PREVIEW_SPLIT_RIGHT_MIN_PX, maxWidth));
}

function readPreferredRightWidth(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CALCULATOR_PREVIEW_SPLIT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
  } catch {
    return null;
  }
}

function persistPreferredRightWidth(value: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CALCULATOR_PREVIEW_SPLIT_STORAGE_KEY, String(Math.round(value)));
  } catch {
    void 0;
  }
}

export function useCalculatorPreviewSplit() {
  const splitRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [frameWidthPx, setFrameWidthPx] = useState(CALCULATOR_PREVIEW_SPLIT_WIDE_FRAME_PX);
  const [preferredRightWidthPx, setPreferredRightWidthPx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setPreferredRightWidthPx(readPreferredRightWidth());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const frame = splitRef.current;
    if (!frame) return;

    const syncFrameWidth = () => {
      const width = frame.getBoundingClientRect().width;
      if (!Number.isFinite(width) || width <= 0) return;
      setFrameWidthPx((previous) => (previous === width ? previous : width));
    };

    syncFrameWidth();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncFrameWidth);
      observer.observe(frame);
    }

    window.addEventListener('resize', syncFrameWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncFrameWidth);
    };
  }, []);

  const rightWidthMaxPx = calculatorPreviewMaxRightWidth(frameWidthPx);
  const rightWidthPx = calculatorPreviewRightWidth(frameWidthPx, preferredRightWidthPx);

  const setUserPreferredRightWidth = useCallback((next: number, maxWidth = rightWidthMaxPx) => {
    const clamped = Math.round(
      clampNumber(next, CALCULATOR_PREVIEW_SPLIT_RIGHT_MIN_PX, maxWidth),
    );
    setPreferredRightWidthPx(clamped);
    persistPreferredRightWidth(clamped);
  }, [rightWidthMaxPx]);

  const updateFromClientX = useCallback((clientX: number) => {
    const frame = splitRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || rect.width <= 0) return;
    const maxWidth = calculatorPreviewMaxRightWidth(rect.width);
    setFrameWidthPx(rect.width);
    setUserPreferredRightWidth(rect.right - clientX, maxWidth);
  }, [setUserPreferredRightWidth]);

  const stopDragging = useCallback(() => {
    pointerIdRef.current = null;
    setIsDragging(false);
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const currentFrameWidth = splitRef.current?.getBoundingClientRect().width ?? 0;
    if (currentFrameWidth > 0 && currentFrameWidth < CALCULATOR_PREVIEW_SPLIT_STACK_BREAKPOINT_PX) return;
    pointerIdRef.current = event.pointerId;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromClientX(event.clientX);
    event.preventDefault();
  }, [updateFromClientX]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    updateFromClientX(event.clientX);
  }, [updateFromClientX]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    stopDragging();
  }, [stopDragging]);

  const onLostPointerCapture = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== null && pointerIdRef.current !== event.pointerId) return;
    stopDragging();
  }, [stopDragging]);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const currentFrameWidth = splitRef.current?.getBoundingClientRect().width ?? 0;
    if (currentFrameWidth > 0 && currentFrameWidth < CALCULATOR_PREVIEW_SPLIT_STACK_BREAKPOINT_PX) return;
    const step = event.shiftKey ? 48 : 16;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setUserPreferredRightWidth(rightWidthPx + step);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setUserPreferredRightWidth(rightWidthPx - step);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setUserPreferredRightWidth(CALCULATOR_PREVIEW_SPLIT_RIGHT_MIN_PX);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setUserPreferredRightWidth(rightWidthMaxPx);
    }
  }, [rightWidthMaxPx, rightWidthPx, setUserPreferredRightWidth]);

  const splitStyle = useMemo(
    () =>
      ({
        ['--preview-right-width' as '--preview-right-width']: `${rightWidthPx}px`,
      }) as CSSProperties,
    [rightWidthPx],
  );

  return {
    splitRef,
    splitStyle,
    isDragging,
    rightWidthPx,
    rightWidthMaxPx,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onLostPointerCapture,
    onKeyDown,
  };
}
