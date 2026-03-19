'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEventHandler,
  type PointerEventHandler,
} from 'react';

export const PROJECT_PAGE_LEFT_MIN_PX = 260;
export const PROJECT_PAGE_LEFT_MAX_PX = 420;
export const PROJECT_PAGE_LEFT_DEFAULT_PX = 280;
export const PROJECT_PAGE_RIGHT_MIN_PX = 280;
export const PROJECT_PAGE_RIGHT_MAX_PX = 420;
export const PROJECT_PAGE_RIGHT_DEFAULT_PX = 320;
export const PROJECT_PAGE_CENTER_MIN_PX = 760;
export const PROJECT_PAGE_HANDLE_WIDTH_PX = 18;
export const PROJECT_PAGE_RESIZE_KEYBOARD_STEP_PX = 16;
export const PROJECT_PAGE_LAYOUT_STORAGE_KEY = 'sp.projectPage.columnLayout.v1';
export const PROJECT_PAGE_DESKTOP_MIN_WIDTH_PX =
  PROJECT_PAGE_LEFT_MIN_PX + PROJECT_PAGE_RIGHT_MIN_PX + PROJECT_PAGE_CENTER_MIN_PX + PROJECT_PAGE_HANDLE_WIDTH_PX * 2;

export type ProjectColumnLayout = {
  leftWidthPx: number;
  rightWidthPx: number;
};

type ResizeSide = 'left' | 'right';

type ResizeSession = {
  side: ResizeSide;
  startClientX: number;
  startLeftWidthPx: number;
  startRightWidthPx: number;
};

function clampWidth(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sameLayout(a: ProjectColumnLayout, b: ProjectColumnLayout): boolean {
  return a.leftWidthPx === b.leftWidthPx && a.rightWidthPx === b.rightWidthPx;
}

function readStoredLayout(): ProjectColumnLayout {
  const fallback = {
    leftWidthPx: PROJECT_PAGE_LEFT_DEFAULT_PX,
    rightWidthPx: PROJECT_PAGE_RIGHT_DEFAULT_PX,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(PROJECT_PAGE_LAYOUT_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ProjectColumnLayout> | null;
    return {
      leftWidthPx: clampWidth(parsed?.leftWidthPx ?? NaN, PROJECT_PAGE_LEFT_MIN_PX, PROJECT_PAGE_LEFT_MAX_PX, fallback.leftWidthPx),
      rightWidthPx: clampWidth(parsed?.rightWidthPx ?? NaN, PROJECT_PAGE_RIGHT_MIN_PX, PROJECT_PAGE_RIGHT_MAX_PX, fallback.rightWidthPx),
    };
  } catch {
    return fallback;
  }
}

function writeStoredLayout(layout: ProjectColumnLayout): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROJECT_PAGE_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore storage failures so resizing still works.
  }
}

export function isProjectPageDesktopWidth(containerWidthPx: number): boolean {
  return Number.isFinite(containerWidthPx) && containerWidthPx >= PROJECT_PAGE_DESKTOP_MIN_WIDTH_PX;
}

function availableSideWidthPx(containerWidthPx: number): number {
  return Math.max(0, Math.round(containerWidthPx) - PROJECT_PAGE_CENTER_MIN_PX - PROJECT_PAGE_HANDLE_WIDTH_PX * 2);
}

export function clampStoredProjectColumnLayout(layout: ProjectColumnLayout, containerWidthPx: number): ProjectColumnLayout {
  const base = {
    leftWidthPx: clampWidth(layout.leftWidthPx, PROJECT_PAGE_LEFT_MIN_PX, PROJECT_PAGE_LEFT_MAX_PX, PROJECT_PAGE_LEFT_DEFAULT_PX),
    rightWidthPx: clampWidth(layout.rightWidthPx, PROJECT_PAGE_RIGHT_MIN_PX, PROJECT_PAGE_RIGHT_MAX_PX, PROJECT_PAGE_RIGHT_DEFAULT_PX),
  };

  if (!isProjectPageDesktopWidth(containerWidthPx)) return base;

  const sideBudgetPx = availableSideWidthPx(containerWidthPx);
  if (base.leftWidthPx + base.rightWidthPx <= sideBudgetPx) return base;

  const leftExtraPx = Math.max(0, base.leftWidthPx - PROJECT_PAGE_LEFT_MIN_PX);
  const rightExtraPx = Math.max(0, base.rightWidthPx - PROJECT_PAGE_RIGHT_MIN_PX);
  const totalExtraPx = leftExtraPx + rightExtraPx;
  const overflowPx = base.leftWidthPx + base.rightWidthPx - sideBudgetPx;

  if (overflowPx <= 0) return base;
  if (totalExtraPx <= 0) {
    return {
      leftWidthPx: PROJECT_PAGE_LEFT_MIN_PX,
      rightWidthPx: PROJECT_PAGE_RIGHT_MIN_PX,
    };
  }

  const leftSharePx = Math.min(leftExtraPx, Math.round((overflowPx * leftExtraPx) / totalExtraPx));
  const rightSharePx = overflowPx - leftSharePx;
  let nextLeftWidthPx = Math.max(PROJECT_PAGE_LEFT_MIN_PX, base.leftWidthPx - leftSharePx);
  let nextRightWidthPx = Math.max(PROJECT_PAGE_RIGHT_MIN_PX, base.rightWidthPx - rightSharePx);
  const remainingOverflowPx = nextLeftWidthPx + nextRightWidthPx - sideBudgetPx;

  if (remainingOverflowPx > 0) {
    const reduceRightPx = Math.min(remainingOverflowPx, nextRightWidthPx - PROJECT_PAGE_RIGHT_MIN_PX);
    nextRightWidthPx -= reduceRightPx;
    const reduceLeftPx = Math.min(remainingOverflowPx - reduceRightPx, nextLeftWidthPx - PROJECT_PAGE_LEFT_MIN_PX);
    nextLeftWidthPx -= reduceLeftPx;
  }

  return {
    leftWidthPx: nextLeftWidthPx,
    rightWidthPx: nextRightWidthPx,
  };
}

export function clampActiveProjectColumnResize(
  layout: ProjectColumnLayout,
  side: ResizeSide,
  containerWidthPx: number,
): ProjectColumnLayout {
  if (!isProjectPageDesktopWidth(containerWidthPx)) return clampStoredProjectColumnLayout(layout, containerWidthPx);

  const sideBudgetPx = availableSideWidthPx(containerWidthPx);
  if (side === 'left') {
    const rightWidthPx = clampWidth(
      layout.rightWidthPx,
      PROJECT_PAGE_RIGHT_MIN_PX,
      PROJECT_PAGE_RIGHT_MAX_PX,
      PROJECT_PAGE_RIGHT_DEFAULT_PX,
    );
    const maxLeftWidthPx = Math.min(PROJECT_PAGE_LEFT_MAX_PX, sideBudgetPx - rightWidthPx);
    return {
      leftWidthPx: clampWidth(
        layout.leftWidthPx,
        PROJECT_PAGE_LEFT_MIN_PX,
        Math.max(PROJECT_PAGE_LEFT_MIN_PX, maxLeftWidthPx),
        PROJECT_PAGE_LEFT_DEFAULT_PX,
      ),
      rightWidthPx,
    };
  }

  const leftWidthPx = clampWidth(layout.leftWidthPx, PROJECT_PAGE_LEFT_MIN_PX, PROJECT_PAGE_LEFT_MAX_PX, PROJECT_PAGE_LEFT_DEFAULT_PX);
  const maxRightWidthPx = Math.min(PROJECT_PAGE_RIGHT_MAX_PX, sideBudgetPx - leftWidthPx);
  return {
    leftWidthPx,
    rightWidthPx: clampWidth(
      layout.rightWidthPx,
      PROJECT_PAGE_RIGHT_MIN_PX,
      Math.max(PROJECT_PAGE_RIGHT_MIN_PX, maxRightWidthPx),
      PROJECT_PAGE_RIGHT_DEFAULT_PX,
    ),
  };
}

export function useProjectColumnLayout() {
  const [layout, setLayout] = useState<ProjectColumnLayout>(() => readStoredLayout());
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const [containerWidthPx, setContainerWidthPx] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const isDesktopLayout = isProjectPageDesktopWidth(containerWidthPx);

  useLayoutEffect(() => {
    const node = containerNode;
    if (!node) return;

    const measure = () => {
      const nextWidthPx = Math.round(node.getBoundingClientRect().width);
      setContainerWidthPx((prev) => (prev === nextWidthPx ? prev : nextWidthPx));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerNode]);

  useEffect(() => {
    writeStoredLayout(layout);
  }, [layout]);

  useEffect(() => {
    if (!isDesktopLayout) return;
    setLayout((prev) => {
      const next = clampStoredProjectColumnLayout(prev, containerWidthPx);
      return sameLayout(prev, next) ? prev : next;
    });
  }, [containerWidthPx, isDesktopLayout]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!isResizing) {
      document.body.classList.remove('projectPageResizing');
      return undefined;
    }

    document.body.classList.add('projectPageResizing');
    return () => {
      document.body.classList.remove('projectPageResizing');
    };
  }, [isResizing]);

  useEffect(() => {
    if (!isResizing) return undefined;

    const stopResize = () => {
      resizeSessionRef.current = null;
      setIsResizing(false);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const session = resizeSessionRef.current;
      if (!session) return;
      const deltaPx = event.clientX - session.startClientX;
      setLayout(() => {
        if (session.side === 'left') {
          return clampActiveProjectColumnResize(
            {
              leftWidthPx: session.startLeftWidthPx + deltaPx,
              rightWidthPx: session.startRightWidthPx,
            },
            'left',
            containerWidthPx,
          );
        }
        return clampActiveProjectColumnResize(
          {
            leftWidthPx: session.startLeftWidthPx,
            rightWidthPx: session.startRightWidthPx - deltaPx,
          },
          'right',
          containerWidthPx,
        );
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    };
  }, [containerWidthPx, isResizing]);

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerNode(node);
  }, []);

  const nudgeResize = useCallback(
    (side: ResizeSide, direction: -1 | 1) => {
      if (!isDesktopLayout) return;
      setLayout((prev) =>
        clampActiveProjectColumnResize(
          {
            leftWidthPx: prev.leftWidthPx + (side === 'left' ? direction * PROJECT_PAGE_RESIZE_KEYBOARD_STEP_PX : 0),
            rightWidthPx: prev.rightWidthPx + (side === 'right' ? direction * PROJECT_PAGE_RESIZE_KEYBOARD_STEP_PX : 0),
          },
          side,
          containerWidthPx,
        ),
      );
    },
    [containerWidthPx, isDesktopLayout],
  );

  const createPointerDownHandler = useCallback(
    (side: ResizeSide): PointerEventHandler<HTMLButtonElement> =>
      (event) => {
        if (!isDesktopLayout) return;
        if (event.button !== 0) return;
        event.preventDefault();
        resizeSessionRef.current = {
          side,
          startClientX: event.clientX,
          startLeftWidthPx: layout.leftWidthPx,
          startRightWidthPx: layout.rightWidthPx,
        };
        setIsResizing(true);
      },
    [isDesktopLayout, layout.leftWidthPx, layout.rightWidthPx],
  );

  const createKeyDownHandler = useCallback(
    (side: ResizeSide): KeyboardEventHandler<HTMLButtonElement> =>
      (event) => {
        if (!isDesktopLayout) return;
        if (side === 'left' && event.key === 'ArrowLeft') {
          event.preventDefault();
          nudgeResize('left', -1);
          return;
        }
        if (side === 'left' && event.key === 'ArrowRight') {
          event.preventDefault();
          nudgeResize('left', 1);
          return;
        }
        if (side === 'right' && event.key === 'ArrowLeft') {
          event.preventDefault();
          nudgeResize('right', 1);
          return;
        }
        if (side === 'right' && event.key === 'ArrowRight') {
          event.preventDefault();
          nudgeResize('right', -1);
        }
      },
    [isDesktopLayout, nudgeResize],
  );

  const shellStyle = useMemo(
    () =>
      ({
        '--project-page-left-width': `${layout.leftWidthPx}px`,
        '--project-page-right-width': `${layout.rightWidthPx}px`,
        '--project-page-center-min': `${PROJECT_PAGE_CENTER_MIN_PX}px`,
        '--project-page-handle-width': `${PROJECT_PAGE_HANDLE_WIDTH_PX}px`,
      }) as CSSProperties,
    [layout.leftWidthPx, layout.rightWidthPx],
  );

  return {
    containerRef: setContainerRef,
    createKeyDownHandler,
    createPointerDownHandler,
    isDesktopLayout,
    isResizing,
    leftWidthPx: layout.leftWidthPx,
    rightWidthPx: layout.rightWidthPx,
    shellStyle,
  };
}
