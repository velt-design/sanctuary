'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Tool, ToolPointerEvent } from './Tool';

type ToolDispatcherContextValue = {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  cancelActiveTool: () => void;
  dispatchPointerDown: (event: ToolPointerEvent) => void;
  dispatchPointerMove: (event: ToolPointerEvent) => void;
  dispatchPointerUp: (event: ToolPointerEvent) => void;
};

const ToolDispatcherContext = createContext<ToolDispatcherContextValue | null>(null);

export function ToolDispatcherProvider({
  initialTool,
  children,
}: {
  initialTool: Tool;
  children: ReactNode;
}) {
  const [activeTool, setActiveTool] = useState<Tool>(initialTool);
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  useEffect(() => {
    return () => {
      activeToolRef.current.onCancel?.();
    };
  }, []);

  const handleSetActiveTool = useCallback((tool: Tool) => {
    if (activeToolRef.current.id === tool.id) {
      setActiveTool(tool);
      return;
    }
    activeToolRef.current.onCancel?.();
    setActiveTool(tool);
  }, []);

  const cancelActiveTool = useCallback(() => {
    activeToolRef.current.onCancel?.();
  }, []);

  const dispatchPointerDown = useCallback((event: ToolPointerEvent) => {
    activeToolRef.current.onPointerDown?.(event);
  }, []);
  const dispatchPointerMove = useCallback((event: ToolPointerEvent) => {
    activeToolRef.current.onPointerMove?.(event);
  }, []);
  const dispatchPointerUp = useCallback((event: ToolPointerEvent) => {
    activeToolRef.current.onPointerUp?.(event);
  }, []);

  const value = useMemo<ToolDispatcherContextValue>(
    () => ({
      activeTool,
      setActiveTool: handleSetActiveTool,
      cancelActiveTool,
      dispatchPointerDown,
      dispatchPointerMove,
      dispatchPointerUp,
    }),
    [activeTool, cancelActiveTool, dispatchPointerDown, dispatchPointerMove, dispatchPointerUp, handleSetActiveTool],
  );

  return <ToolDispatcherContext.Provider value={value}>{children}</ToolDispatcherContext.Provider>;
}

export function useToolDispatcher(): ToolDispatcherContextValue {
  const value = useContext(ToolDispatcherContext);
  if (!value) {
    throw new Error('useToolDispatcher must be used inside <ToolDispatcherProvider>');
  }
  return value;
}
