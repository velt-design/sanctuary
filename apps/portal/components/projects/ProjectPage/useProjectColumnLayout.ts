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
  type MouseEventHandler,
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
export const PROJECT_PAGE_COLLAPSE_OVERSHOOT_PX = 40;
export const PROJECT_PAGE_LAYOUT_STORAGE_KEY = 'sp.projectPage.columnLayout.v1';
export const PROJECT_PAGE_DESKTOP_MIN_WIDTH_PX =
  PROJECT_PAGE_LEFT_MIN_PX + PROJECT_PAGE_RIGHT_MIN_PX + PROJECT_PAGE_CENTER_MIN_PX + PROJECT_PAGE_HANDLE_WIDTH_PX * 2;

export type ProjectColumnLayout = {
  leftWidthPx: number;
  rightWidthPx: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
};

type ResizeSide = 'left' | 'right';

type ResizeSession = {
  side: ResizeSide;
  startClientX: number;
  startCollapsed: boolean;
  startLeftWidthPx: number;
  startRightWidthPx: number;
  maxAbsDeltaPx: number;
};

type VisibleProjectColumnLayout = {
  leftWidthPx: number;
  rightWidthPx: number;
};

function clampWidth(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sideMinWidthPx(side: ResizeSide): number {
  return side === 'left' ? PROJECT_PAGE_LEFT_MIN_PX : PROJECT_PAGE_RIGHT_MIN_PX;
}

function normalizeProjectColumnLayout(layout: Partial<ProjectColumnLayout> | null | undefined): ProjectColumnLayout {
  return {
    leftWidthPx: clampWidth(
      layout?.leftWidthPx ?? NaN,
      PROJECT_PAGE_LEFT_MIN_PX,
      PROJECT_PAGE_LEFT_MAX_PX,
      PROJECT_PAGE_LEFT_DEFAULT_PX,
    ),
    rightWidthPx: clampWidth(
      layout?.rightWidthPx ?? NaN,
      PROJECT_PAGE_RIGHT_MIN_PX,
      PROJECT_PAGE_RIGHT_MAX_PX,
      PROJECT_PAGE_RIGHT_DEFAULT_PX,
    ),
    leftCollapsed: Boolean(layout?.leftCollapsed),
    rightCollapsed: Boolean(layout?.rightCollapsed),
  };
}

function sameLayout(a: ProjectColumnLayout, b: ProjectColumnLayout): boolean {
  return (
    a.leftWidthPx === b.leftWidthPx &&
    a.rightWidthPx === b.rightWidthPx &&
    a.leftCollapsed === b.leftCollapsed &&
    a.rightCollapsed === b.rightCollapsed
  );
}

function sameVisibleLayout(a: VisibleProjectColumnLayout, b: VisibleProjectColumnLayout): boolean {
  return a.leftWidthPx === b.leftWidthPx && a.rightWidthPx === b.rightWidthPx;
}

function readStoredLayout(): ProjectColumnLayout {
  const fallback = normalizeProjectColumnLayout(null);
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(PROJECT_PAGE_LAYOUT_STORAGE_KEY);
    if (!raw) return fallback;
    return normalizeProjectColumnLayout(JSON.parse(raw) as Partial<ProjectColumnLayout> | null);
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

function clampExpandedPairToBudget(layout: ProjectColumnLayout, containerWidthPx: number): VisibleProjectColumnLayout {
  const base = normalizeProjectColumnLayout(layout);
  if (!isProjectPageDesktopWidth(containerWidthPx)) {
    return {
      leftWidthPx: base.leftWidthPx,
      rightWidthPx: base.rightWidthPx,
    };
  }

  const sideBudgetPx = availableSideWidthPx(containerWidthPx);
  if (base.leftWidthPx + base.rightWidthPx <= sideBudgetPx) {
    return {
      leftWidthPx: base.leftWidthPx,
      rightWidthPx: base.rightWidthPx,
    };
  }

  const leftExtraPx = Math.max(0, base.leftWidthPx - PROJECT_PAGE_LEFT_MIN_PX);
  const rightExtraPx = Math.max(0, base.rightWidthPx - PROJECT_PAGE_RIGHT_MIN_PX);
  const totalExtraPx = leftExtraPx + rightExtraPx;
  const overflowPx = base.leftWidthPx + base.rightWidthPx - sideBudgetPx;

  if (overflowPx <= 0) {
    return {
      leftWidthPx: base.leftWidthPx,
      rightWidthPx: base.rightWidthPx,
    };
  }

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

function resolveVisibleProjectColumnLayout(layout: ProjectColumnLayout, containerWidthPx: number): VisibleProjectColumnLayout {
  const base = normalizeProjectColumnLayout(layout);
  if (!isProjectPageDesktopWidth(containerWidthPx)) {
    return {
      leftWidthPx: base.leftWidthPx,
      rightWidthPx: base.rightWidthPx,
    };
  }

  const sideBudgetPx = availableSideWidthPx(containerWidthPx);

  if (base.leftCollapsed && base.rightCollapsed) {
    return {
      leftWidthPx: 0,
      rightWidthPx: 0,
    };
  }

  if (base.leftCollapsed) {
    return {
      leftWidthPx: 0,
      rightWidthPx: clampWidth(
        base.rightWidthPx,
        PROJECT_PAGE_RIGHT_MIN_PX,
        Math.max(PROJECT_PAGE_RIGHT_MIN_PX, Math.min(PROJECT_PAGE_RIGHT_MAX_PX, sideBudgetPx)),
        PROJECT_PAGE_RIGHT_DEFAULT_PX,
      ),
    };
  }

  if (base.rightCollapsed) {
    return {
      leftWidthPx: clampWidth(
        base.leftWidthPx,
        PROJECT_PAGE_LEFT_MIN_PX,
        Math.max(PROJECT_PAGE_LEFT_MIN_PX, Math.min(PROJECT_PAGE_LEFT_MAX_PX, sideBudgetPx)),
        PROJECT_PAGE_LEFT_DEFAULT_PX,
      ),
      rightWidthPx: 0,
    };
  }

  return clampExpandedPairToBudget(base, containerWidthPx);
}

export function clampStoredProjectColumnLayout(layout: ProjectColumnLayout, containerWidthPx: number): ProjectColumnLayout {
  const base = normalizeProjectColumnLayout(layout);
  if (!isProjectPageDesktopWidth(containerWidthPx)) return base;

  const visible = resolveVisibleProjectColumnLayout(base, containerWidthPx);
  return {
    leftWidthPx: base.leftCollapsed ? base.leftWidthPx : visible.leftWidthPx,
    rightWidthPx: base.rightCollapsed ? base.rightWidthPx : visible.rightWidthPx,
    leftCollapsed: base.leftCollapsed,
    rightCollapsed: base.rightCollapsed,
  };
}

export function clampActiveProjectColumnResize(
  layout: ProjectColumnLayout,
  side: ResizeSide,
  containerWidthPx: number,
): ProjectColumnLayout {
  const base = normalizeProjectColumnLayout(layout);
  if (!isProjectPageDesktopWidth(containerWidthPx)) return clampStoredProjectColumnLayout(base, containerWidthPx);

  const sideBudgetPx = availableSideWidthPx(containerWidthPx);
  const visible = resolveVisibleProjectColumnLayout(base, containerWidthPx);

  if (side === 'left') {
    const otherWidthPx = base.rightCollapsed ? 0 : visible.rightWidthPx;
    const maxLeftWidthPx = Math.min(PROJECT_PAGE_LEFT_MAX_PX, sideBudgetPx - otherWidthPx);
    return {
      ...base,
      leftCollapsed: false,
      leftWidthPx: clampWidth(
        base.leftWidthPx,
        PROJECT_PAGE_LEFT_MIN_PX,
        Math.max(PROJECT_PAGE_LEFT_MIN_PX, maxLeftWidthPx),
        PROJECT_PAGE_LEFT_DEFAULT_PX,
      ),
    };
  }

  const otherWidthPx = base.leftCollapsed ? 0 : visible.leftWidthPx;
  const maxRightWidthPx = Math.min(PROJECT_PAGE_RIGHT_MAX_PX, sideBudgetPx - otherWidthPx);
  return {
    ...base,
    rightCollapsed: false,
    rightWidthPx: clampWidth(
      base.rightWidthPx,
      PROJECT_PAGE_RIGHT_MIN_PX,
      Math.max(PROJECT_PAGE_RIGHT_MIN_PX, maxRightWidthPx),
      PROJECT_PAGE_RIGHT_DEFAULT_PX,
    ),
  };
}

function setRailCollapsed(layout: ProjectColumnLayout, side: ResizeSide, collapsed: boolean, containerWidthPx: number): ProjectColumnLayout {
  const base = normalizeProjectColumnLayout(layout);
  const next = side === 'left' ? { ...base, leftCollapsed: collapsed } : { ...base, rightCollapsed: collapsed };
  return clampStoredProjectColumnLayout(next, containerWidthPx);
}

export function useProjectColumnLayout() {
  const [layout, setLayout] = useState<ProjectColumnLayout>(() => readStoredLayout());
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const [containerWidthPx, setContainerWidthPx] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [previewLayout, setPreviewLayout] = useState<VisibleProjectColumnLayout | null>(null);
  const [collapseArmedSide, setCollapseArmedSideState] = useState<ResizeSide | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const collapseArmedSideRef = useRef<ResizeSide | null>(null);
  const isDesktopLayout = isProjectPageDesktopWidth(containerWidthPx);

  const setCollapseArmedSide = useCallback((next: ResizeSide | null) => {
    collapseArmedSideRef.current = next;
    setCollapseArmedSideState((prev) => (prev === next ? prev : next));
  }, []);

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
    setPreviewLayout((prev) => {
      if (!prev) return prev;
      const next = resolveVisibleProjectColumnLayout(layout, containerWidthPx);
      return sameVisibleLayout(prev, next) ? prev : next;
    });
  }, [containerWidthPx, layout]);

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

    const handlePointerMove = (event: PointerEvent) => {
      const session = resizeSessionRef.current;
      if (!session) return;

      const deltaPx = event.clientX - session.startClientX;
      session.maxAbsDeltaPx = Math.max(session.maxAbsDeltaPx, Math.abs(deltaPx));
      if (session.startCollapsed) {
        const outwardDeltaPx = session.side === 'left' ? deltaPx : -deltaPx;
        const expandArmed = outwardDeltaPx >= PROJECT_PAGE_COLLAPSE_OVERSHOOT_PX;
        setCollapseArmedSide(expandArmed ? session.side : null);
        return;
      }

      const proposedLayout =
        session.side === 'left'
          ? {
              ...layout,
              leftCollapsed: false,
              leftWidthPx: session.startLeftWidthPx + deltaPx,
            }
          : {
              ...layout,
              rightCollapsed: false,
              rightWidthPx: session.startRightWidthPx - deltaPx,
            };
      const proposedWidthPx = session.side === 'left' ? proposedLayout.leftWidthPx : proposedLayout.rightWidthPx;
      const collapseThresholdPx = sideMinWidthPx(session.side) - PROJECT_PAGE_COLLAPSE_OVERSHOOT_PX;
      const collapseArmed = proposedWidthPx <= collapseThresholdPx;

      setCollapseArmedSide(collapseArmed ? session.side : null);
      setPreviewLayout(
        resolveVisibleProjectColumnLayout(
          collapseArmed
            ? session.side === 'left'
              ? { ...layout, leftCollapsed: false, leftWidthPx: PROJECT_PAGE_LEFT_MIN_PX }
              : { ...layout, rightCollapsed: false, rightWidthPx: PROJECT_PAGE_RIGHT_MIN_PX }
            : clampActiveProjectColumnResize(proposedLayout, session.side, containerWidthPx),
          containerWidthPx,
        ),
      );
    };

    const stopResize = (commitCollapse: boolean) => {
      const session = resizeSessionRef.current;
      resizeSessionRef.current = null;
      setIsResizing(false);
      setPreviewLayout(null);
      const armedSide = collapseArmedSideRef.current;
      setCollapseArmedSide(null);
      if (!session) return;

      if (session.startCollapsed) {
        if (commitCollapse && armedSide === session.side) {
          setLayout((prev) => setRailCollapsed(prev, session.side, false, containerWidthPx));
        }
        suppressClickRef.current = session.maxAbsDeltaPx > 3 ? session.side : null;
        return;
      }

      if (commitCollapse && armedSide === session.side) {
        setLayout((prev) => setRailCollapsed(prev, session.side, true, containerWidthPx));
        return;
      }

      const deltaPx = eventPositionRef.current - session.startClientX;
      const next = clampActiveProjectColumnResize(
        session.side === 'left'
          ? {
              ...layout,
              leftCollapsed: false,
              leftWidthPx: session.startLeftWidthPx + deltaPx,
            }
          : {
              ...layout,
              rightCollapsed: false,
              rightWidthPx: session.startRightWidthPx - deltaPx,
            },
        session.side,
        containerWidthPx,
      );
      setLayout((prev) => {
        const normalized = clampStoredProjectColumnLayout(
          session.side === 'left'
            ? { ...prev, leftCollapsed: false, leftWidthPx: next.leftWidthPx }
            : { ...prev, rightCollapsed: false, rightWidthPx: next.rightWidthPx },
          containerWidthPx,
        );
        return sameLayout(prev, normalized) ? prev : normalized;
      });
    };

    let eventPosition = resizeSessionRef.current?.startClientX ?? 0;
    const eventPositionRef = {
      get current() {
        return eventPosition;
      },
      set current(value: number) {
        eventPosition = value;
      },
    };

    const trackPointerPosition = (event: PointerEvent) => {
      eventPositionRef.current = event.clientX;
    };

    const handleTrackedPointerMove = (event: PointerEvent) => {
      trackPointerPosition(event);
      handlePointerMove(event);
    };

    const handlePointerUp = () => stopResize(true);
    const handlePointerCancel = () => stopResize(false);

    window.addEventListener('pointermove', handleTrackedPointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handleTrackedPointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [containerWidthPx, isResizing, layout, setCollapseArmedSide]);

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerNode(node);
  }, []);
  const suppressClickRef = useRef<ResizeSide | null>(null);

  const setRailCollapsedState = useCallback(
    (side: ResizeSide, collapsed: boolean) => {
      if (!isDesktopLayout) return;
      setLayout((prev) => {
        const next = setRailCollapsed(prev, side, collapsed, containerWidthPx);
        return sameLayout(prev, next) ? prev : next;
      });
    },
    [containerWidthPx, isDesktopLayout],
  );

  const expandRail = useCallback(
    (side: ResizeSide) => {
      setRailCollapsedState(side, false);
    },
    [setRailCollapsedState],
  );

  const toggleRailCollapsed = useCallback(
    (side: ResizeSide) => {
      if (!isDesktopLayout) return;
      setLayout((prev) => {
        const isCollapsed = side === 'left' ? prev.leftCollapsed : prev.rightCollapsed;
        const next = setRailCollapsed(prev, side, !isCollapsed, containerWidthPx);
        return sameLayout(prev, next) ? prev : next;
      });
    },
    [containerWidthPx, isDesktopLayout],
  );

  const nudgeResize = useCallback(
    (side: ResizeSide, direction: -1 | 1) => {
      if (!isDesktopLayout) return;
      setLayout((prev) =>
        clampActiveProjectColumnResize(
          side === 'left'
            ? {
                ...prev,
                leftCollapsed: false,
                leftWidthPx: prev.leftWidthPx + direction * PROJECT_PAGE_RESIZE_KEYBOARD_STEP_PX,
              }
            : {
                ...prev,
                rightCollapsed: false,
                rightWidthPx: prev.rightWidthPx + direction * PROJECT_PAGE_RESIZE_KEYBOARD_STEP_PX,
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
        const isCollapsed = side === 'left' ? layout.leftCollapsed : layout.rightCollapsed;
        resizeSessionRef.current = {
          side,
          startClientX: event.clientX,
          startCollapsed: isCollapsed,
          startLeftWidthPx: layout.leftWidthPx,
          startRightWidthPx: layout.rightWidthPx,
          maxAbsDeltaPx: 0,
        };
        setCollapseArmedSide(null);
        setPreviewLayout(resolveVisibleProjectColumnLayout(layout, containerWidthPx));
        setIsResizing(true);
      },
    [containerWidthPx, isDesktopLayout, layout, setCollapseArmedSide],
  );

  const createClickHandler = useCallback(
    (side: ResizeSide): MouseEventHandler<HTMLButtonElement> =>
      (event) => {
        if (!isDesktopLayout) return;
        if (suppressClickRef.current === side) {
          suppressClickRef.current = null;
          return;
        }
        const isCollapsed = side === 'left' ? layout.leftCollapsed : layout.rightCollapsed;
        if (!isCollapsed) return;
        event.preventDefault();
        expandRail(side);
      },
    [expandRail, isDesktopLayout, layout.leftCollapsed, layout.rightCollapsed],
  );

  const createKeyDownHandler = useCallback(
    (side: ResizeSide): KeyboardEventHandler<HTMLButtonElement> =>
      (event) => {
        if (!isDesktopLayout) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleRailCollapsed(side);
          return;
        }

        const isCollapsed = side === 'left' ? layout.leftCollapsed : layout.rightCollapsed;
        if (isCollapsed) return;

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
    [isDesktopLayout, layout.leftCollapsed, layout.rightCollapsed, nudgeResize, toggleRailCollapsed],
  );

  const visibleLayout = previewLayout ?? resolveVisibleProjectColumnLayout(layout, containerWidthPx);

  const shellStyle = useMemo(
    () =>
      ({
        '--project-page-left-width': `${visibleLayout.leftWidthPx}px`,
        '--project-page-right-width': `${visibleLayout.rightWidthPx}px`,
        '--project-page-center-min': `${PROJECT_PAGE_CENTER_MIN_PX}px`,
        '--project-page-handle-width': `${PROJECT_PAGE_HANDLE_WIDTH_PX}px`,
      }) as CSSProperties,
    [visibleLayout.leftWidthPx, visibleLayout.rightWidthPx],
  );

  return {
    containerRef: setContainerRef,
    createClickHandler,
    createKeyDownHandler,
    createPointerDownHandler,
    expandRail,
    isDesktopLayout,
    isResizing,
    leftCollapseArmed: collapseArmedSide === 'left',
    leftCollapsed: layout.leftCollapsed,
    leftWidthPx: visibleLayout.leftWidthPx,
    rightCollapseArmed: collapseArmedSide === 'right',
    rightCollapsed: layout.rightCollapsed,
    rightWidthPx: visibleLayout.rightWidthPx,
    shellStyle,
  };
}
