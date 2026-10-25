'use client';

import { Suspense, useLayoutEffect, useRef, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import ScheduleFrame, { type ScheduleFrameProps } from './ScheduleFrame';
import { useScheduleFramePublication, useScheduleWorkspace } from './ScheduleWorkspace';
import { ScheduleSurfaceProvider } from './ScheduleSurfaceContext';
import type { ScheduleBoardViewProps } from './ScheduleBoardView';
import type { ScheduleGanttViewProps } from './ScheduleGanttView';

const Board = dynamic<ScheduleBoardViewProps>(() => import('./ScheduleBoardView'), { ssr: true });
const Gantt = dynamic<ScheduleGanttViewProps>(() => import('./ScheduleGanttView'), { ssr: true });

/** Only this guarded producer reaches private row/model/interaction code. */
export async function prepareScheduleRenderer(view: 'board' | 'gantt'): Promise<void> {
  if (view === 'gantt') await import('./ScheduleGanttView');
  else await import('./ScheduleBoardView');
}

/** The guarded client supplies props to the existing frame, never a second calendar. */
export default function ScheduleFrameOutput(props: ScheduleFrameProps) {
  const controller = useScheduleWorkspace();
  const publish = useScheduleFramePublication();
  const owner = controller?.owner;
  const standaloneOwner = useRef({});
  useLayoutEffect(() => {
    if (!publish || !owner) return;
    publish({ owner, props });
    return () => publish(null);
  }, [publish, owner, props]);
  const runtime = <Suspense fallback={null}>{props.view === 'gantt' ? <Gantt {...props.gantt} /> : <Board {...props.board} />}</Suspense>;
  return publish ? runtime : <ScheduleSurfaceProvider owner={standaloneOwner.current}
    today={props.gantt.today} ganttActive={props.view === 'gantt'}>
    <ScheduleFrame {...props} />{runtime}
  </ScheduleSurfaceProvider>;
}

/** Existing genuine schema fallback replaces the frame only after its guarded read. */
export function ScheduleLegacyOutput({ children }: { children: ReactNode }) {
  const controller = useScheduleWorkspace();
  const publish = useScheduleFramePublication();
  const owner = controller?.owner;
  useLayoutEffect(() => {
    if (!publish || !owner) return;
    publish({ owner, replacement: children });
    return () => publish(null);
  }, [publish, owner, children]);
  return publish ? null : children;
}
