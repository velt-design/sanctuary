"use client";

import { useCallback, useLayoutEffect, useRef, type ReactNode, type RefObject, type SyntheticEvent } from "react";
import { useSearchParams } from 'next/navigation';
import styles from "./ProjectPage.module.css";
const positions = new Map<string, number>();
const viewKey = (query: { get: (key: string) => string | null }, tab: string) =>
  [tab, query.get('quoteId') ?? '', query.get('estimateId') ?? '', query.get('createFromEstimateId') ?? ''].join('/');

/** One frame owns restoration; React owns its work-area event lifetime. */
function useProjectWorkspace(body: RefObject<HTMLDivElement | null>, disabled: boolean, projectId: string, selectedTab?: string) {
  const query = useSearchParams();
  const restoring = useRef<number | null>(null);
  const tab = selectedTab ?? query.get('tab') ?? 'activity';
  const view = viewKey(query, tab);
  const key = `${projectId}/${view}`;
  const restore = useCallback(() => {
    const node = body.current;
    const target = restoring.current;
    if (node && target !== null && node.scrollTop !== Math.min(target, Math.max(0, node.scrollHeight - node.clientHeight))) node.scrollTop = target;
  }, [body]);
  useLayoutEffect(() => {
    const node = body.current;
    if (disabled || !node) return;
    restoring.current = positions.get(key) ?? 0;
    restore();
    const observer = new MutationObserver(restore);
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [body, disabled, key, restore]);
  const takeControl = (event: SyntheticEvent<HTMLDivElement>) => {
    // Portalled dialogs bubble through React, but do not own the work scroller.
    if (event.currentTarget.contains(event.target as Node)) restoring.current = null;
  };
  return disabled ? {} : {
    onScroll: (event: SyntheticEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.target as Node)) return;
      const intent = new URLSearchParams(window.location.search);
      if (viewKey(intent, intent.get('tab') ?? tab) !== view) return;
      if (restoring.current !== null) { restore(); return; }
      positions.set(key, event.currentTarget.scrollTop);
      if (positions.size > 100) positions.delete(positions.keys().next().value!);
    },
    onWheel: takeControl,
    onTouchMove: takeControl,
    onPointerDown: takeControl,
    onKeyDown: takeControl,
  };
}
export default function ProjectPageFrameSurface({ calculatorWorkspace = false, projectId, selectedTab, header, children }: { calculatorWorkspace?: boolean; projectId: string; selectedTab?: string; header: ReactNode; children: ReactNode }) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const workspace = useProjectWorkspace(bodyRef, calculatorWorkspace, projectId, selectedTab);

  return (
    <div
      className={`${styles.pageFrame} ${calculatorWorkspace ? styles.pageFrameCalculatorWorkspace : ""}`}
      data-project-page-frame="true"
      data-project-calculator-workspace={calculatorWorkspace ? "true" : undefined}
    >
      {!calculatorWorkspace ? (
        <div
          className={styles.pageFrameMastheadSlot}
          data-project-masthead-slot="fixed"
        >
          {header}
        </div>
      ) : null}

      <div {...workspace} ref={bodyRef} className={styles.pageFrameBody} data-project-workspace-scroll={calculatorWorkspace ? undefined : 'true'} tabIndex={calculatorWorkspace ? undefined : 0} aria-label={calculatorWorkspace ? undefined : 'Project workspace'}>
        {children}
      </div>
    </div>
  );
}
