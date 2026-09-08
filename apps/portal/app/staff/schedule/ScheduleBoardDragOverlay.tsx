'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { defaultDropAnimationSideEffects, DragOverlay, useDndContext, type DropAnimation } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { BoardDropTarget } from './boardDrag';
import { captureBoardDragSnapshot, type BoardDragSnapshot } from './scheduleBoardDragSnapshot';
import styles from './ScheduleBoardDragOverlay.module.css';

const hideLandingCard = defaultDropAnimationSideEffects({ styles: { active: { opacity: '0' } } });
const landingAnimation: DropAnimation = {
  duration: 160,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  keyframes({ active, dragOverlay, transform }) {
    return [{ transform: CSS.Transform.toString(transform.initial) }, {
      transform: CSS.Transform.toString({ ...transform.final,
        scaleX: transform.initial.scaleX * active.rect.width / dragOverlay.rect.width,
        scaleY: transform.initial.scaleY * active.rect.height / dragOverlay.rect.height }),
    }];
  },
  sideEffects(args) {
    const cleanup = hideLandingCard(args);
    args.active.node.dataset.boardLanding = 'true';
    return () => { cleanup?.(); delete args.active.node.dataset.boardLanding; };
  },
};

function SnapshotCard({ snapshot, target }: { snapshot: BoardDragSnapshot; target: BoardDropTarget | null }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    host.current?.replaceChildren(snapshot.node.cloneNode(true));
  }, [snapshot]);
  return <div ref={host} className={styles.snapshot} style={{ width: snapshot.width, height: snapshot.height }}
    aria-hidden="true" data-board-drag-overlay="true" data-valid={target?.valid ? 'true' : 'false'}
    data-position={target?.valid && target.kind === 'lane' ? target.insertionIndex + 1 : undefined} />;
}

export default function ScheduleBoardDragOverlay({ activeId, target }: { activeId: string | null; target: BoardDropTarget | null }) {
  const { activeNode } = useDndContext();
  const [snapshot, setSnapshot] = useState<BoardDragSnapshot | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  useLayoutEffect(() => {
    if (activeId && activeNode) setSnapshot(captureBoardDragSnapshot(activeId, activeNode));
  }, [activeId, activeNode]);
  return <DragOverlay dropAnimation={reducedMotion ? null : landingAnimation} transition={reducedMotion ? 'none' : undefined}>
    {activeId && snapshot?.id === activeId ? <SnapshotCard snapshot={snapshot} target={target} /> : null}
  </DragOverlay>;
}
