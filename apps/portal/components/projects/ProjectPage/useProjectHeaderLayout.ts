'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type PointerEventHandler,
} from 'react';
import { isProjectPageDesktopWidth } from './useProjectColumnLayout';

export const PROJECT_PAGE_HEADER_LAYOUT_STORAGE_KEY = 'sp.projectPage.headerLayout.v1';
export const PROJECT_PAGE_HEADER_SNAP_STEP_PX = 32;
export const PROJECT_PAGE_HEADER_SNAP_FULL_PX = 92;

export type ProjectHeaderMode = 'expanded' | 'compact' | 'collapsed';
export type ProjectHeaderOpenMode = Exclude<ProjectHeaderMode, 'collapsed'>;

type ProjectHeaderLayout = {
  mode: ProjectHeaderMode;
  lastOpenMode: ProjectHeaderOpenMode;
};

type ResizeSession = {
  startClientY: number;
  maxAbsDeltaPx: number;
  startMode: ProjectHeaderMode;
};

function normalizeHeaderLayout(layout: Partial<ProjectHeaderLayout> | null | undefined): ProjectHeaderLayout {
  return {
    mode: layout?.mode === 'compact' || layout?.mode === 'collapsed' ? layout.mode : 'expanded',
    lastOpenMode: layout?.lastOpenMode === 'compact' ? 'compact' : 'expanded',
  };
}

function sameLayout(a: ProjectHeaderLayout, b: ProjectHeaderLayout): boolean {
  return a.mode === b.mode && a.lastOpenMode === b.lastOpenMode;
}

function readStoredLayout(): ProjectHeaderLayout {
  const fallback = normalizeHeaderLayout(null);
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(PROJECT_PAGE_HEADER_LAYOUT_STORAGE_KEY);
    if (!raw) return fallback;
    return normalizeHeaderLayout(JSON.parse(raw) as Partial<ProjectHeaderLayout> | null);
  } catch {
    return fallback;
  }
}

function writeStoredLayout(layout: ProjectHeaderLayout): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(PROJECT_PAGE_HEADER_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore storage failures so the UI still works.
  }
}

function resolveModeFromDelta(startMode: ProjectHeaderMode, deltaY: number): ProjectHeaderMode {
  if (startMode === 'expanded') {
    if (deltaY <= -PROJECT_PAGE_HEADER_SNAP_FULL_PX) return 'collapsed';
    if (deltaY <= -PROJECT_PAGE_HEADER_SNAP_STEP_PX) return 'compact';
    return 'expanded';
  }

  if (startMode === 'compact') {
    if (deltaY <= -PROJECT_PAGE_HEADER_SNAP_STEP_PX) return 'collapsed';
    if (deltaY >= PROJECT_PAGE_HEADER_SNAP_STEP_PX) return 'expanded';
    return 'compact';
  }

  if (deltaY >= PROJECT_PAGE_HEADER_SNAP_FULL_PX) return 'expanded';
  if (deltaY >= PROJECT_PAGE_HEADER_SNAP_STEP_PX) return 'compact';
  return 'collapsed';
}

export function useProjectHeaderLayout() {
  const [layout, setLayout] = useState<ProjectHeaderLayout>(() => readStoredLayout());
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const [containerWidthPx, setContainerWidthPx] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [previewMode, setPreviewMode] = useState<ProjectHeaderMode | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const suppressClickRef = useRef(false);
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
    if (typeof document === 'undefined') return undefined;
    if (!isResizing) {
      document.body.classList.remove('projectPageHeaderResizing');
      return undefined;
    }

    document.body.classList.add('projectPageHeaderResizing');
    return () => {
      document.body.classList.remove('projectPageHeaderResizing');
    };
  }, [isResizing]);

  useEffect(() => {
    if (!isDesktopLayout) {
      resizeSessionRef.current = null;
      setPreviewMode(null);
      setIsResizing(false);
    }
  }, [isDesktopLayout]);

  useEffect(() => {
    if (!isResizing) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      const session = resizeSessionRef.current;
      if (!session) return;
      const deltaY = event.clientY - session.startClientY;
      session.maxAbsDeltaPx = Math.max(session.maxAbsDeltaPx, Math.abs(deltaY));
      setPreviewMode(resolveModeFromDelta(session.startMode, deltaY));
    };

    const stopResize = (commit: boolean) => {
      const session = resizeSessionRef.current;
      resizeSessionRef.current = null;
      setIsResizing(false);
      suppressClickRef.current = Boolean(session && session.maxAbsDeltaPx > 3);
      setPreviewMode((currentPreviewMode) => {
        if (commit && session) {
          const nextMode = currentPreviewMode ?? session.startMode;
          setLayout((prev) => {
            const nextLayout =
              nextMode === 'collapsed'
                ? { ...prev, mode: 'collapsed' as const }
                : { mode: nextMode, lastOpenMode: nextMode };
            return sameLayout(prev, nextLayout) ? prev : nextLayout;
          });
        }
        return null;
      });
    };

    const handlePointerUp = () => stopResize(true);
    const handlePointerCancel = () => stopResize(false);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [isResizing]);

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerNode(node);
  }, []);

  const createHandlePointerDownHandler = useCallback(
    (): PointerEventHandler<HTMLElement> =>
      (event) => {
        if (!isDesktopLayout) return;
        if (event.button !== 0) return;
        event.preventDefault();
        resizeSessionRef.current = {
          startClientY: event.clientY,
          maxAbsDeltaPx: 0,
          startMode: layout.mode,
        };
        setPreviewMode(layout.mode);
        setIsResizing(true);
      },
    [isDesktopLayout, layout.mode],
  );

  const createHandleClickHandler = useCallback(
    (): MouseEventHandler<HTMLElement> =>
      (event) => {
        if (!isDesktopLayout || layout.mode !== 'collapsed') return;
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        event.preventDefault();
        setLayout((prev) => {
          const next = {
            mode: prev.lastOpenMode,
            lastOpenMode: prev.lastOpenMode,
          };
          return sameLayout(prev, next) ? prev : next;
        });
      },
    [isDesktopLayout, layout.mode],
  );

  const createHandleKeyDownHandler = useCallback(
    (): KeyboardEventHandler<HTMLElement> =>
      (event) => {
        if (!isDesktopLayout || layout.mode !== 'collapsed') return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setLayout((prev) => {
          const next = {
            mode: prev.lastOpenMode,
            lastOpenMode: prev.lastOpenMode,
          };
          return sameLayout(prev, next) ? prev : next;
        });
      },
    [isDesktopLayout, layout.mode],
  );

  const restoreLastOpenMode = useCallback(() => {
    setLayout((prev) => {
      const next = {
        mode: prev.lastOpenMode,
        lastOpenMode: prev.lastOpenMode,
      };
      return sameLayout(prev, next) ? prev : next;
    });
  }, []);

  return {
    createHandleClickHandler,
    createHandleKeyDownHandler,
    containerRef: setContainerRef,
    createHandlePointerDownHandler,
    displayMode: isDesktopLayout ? previewMode ?? layout.mode : ('expanded' as const),
    isDesktopLayout,
    isResizing,
    restoreLastOpenMode,
  };
}
