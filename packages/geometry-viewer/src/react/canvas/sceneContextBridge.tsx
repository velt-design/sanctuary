'use client';

import { Component, Fragment, StrictMode, useLayoutEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import { FiberProvider, traverseFiber, useContextMap, useFiber, type ContextMap } from 'its-fine';

// its-fine 2.0.0 exposes the reconciler bridge publicly. Keep this version-coupled
// traversal confined here; consumers must never inspect React's private fields.
export function useSceneContextBridge(active = true) {
  const fiber = useFiber();
  const live = useContextMap();
  const snapshot = useRef<ContextMap>(new Map(live));
  // its-fine's live map is mutated on each hook render. Copy actual values;
  // retaining its Bridge function alone would still forward hidden changes.
  if (active) snapshot.current = new Map(live);
  return useMemo(() => function SceneContextBridge({ children }: PropsWithChildren) {
    const Mode = traverseFiber(fiber, true, (node) => node.type === StrictMode) ? StrictMode : Fragment;
    const bridged = [...snapshot.current].reduceRight((tree, [Context, value]) =>
      <Context.Provider value={value}>{tree}</Context.Provider>, <FiberProvider>{children}</FiberProvider>);
    return <Mode>{bridged}</Mode>;
  }, [fiber]);
}

export class SceneErrorRelay extends Component<PropsWithChildren<{ report: (error: unknown) => void }>, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { this.props.report(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function SceneSuspenseRelay({ report }: { report: (pending: Promise<void> | null) => void }) {
  useLayoutEffect(() => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    report(pending);
    return () => { resolve(); report(null); };
  }, [report]);
  return null;
}
