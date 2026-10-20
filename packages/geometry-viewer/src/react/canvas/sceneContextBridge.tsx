'use client';

import { Component, Fragment, StrictMode, useLayoutEffect, useMemo, type PropsWithChildren } from 'react';
import { traverseFiber, useContextBridge, useFiber } from 'its-fine';

// its-fine 2.0.0 exposes the reconciler bridge publicly. Keep this version-coupled
// traversal confined here; consumers must never inspect React's private fields.
export function useSceneContextBridge() {
  const fiber = useFiber();
  const ContextBridge = useContextBridge();
  return useMemo(() => function SceneContextBridge({ children }: PropsWithChildren) {
    const Mode = traverseFiber(fiber, true, (node) => node.type === StrictMode) ? StrictMode : Fragment;
    return <Mode><ContextBridge>{children}</ContextBridge></Mode>;
  }, [fiber, ContextBridge]);
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
