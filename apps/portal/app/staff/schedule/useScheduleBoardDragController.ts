'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { ScheduleItem } from '@/lib/types/scheduling';
import {
  resolveBoardDropTarget,
  type BoardDragLane,
  type BoardDragPoint,
  type BoardDragRect,
  type BoardDropTarget,
} from './boardDrag';
import { logScheduleDebug } from './scheduleDebug';

export type ScheduleBoardDropDebug = {
  activeId: string;
  rawOverId: string | null;
  sourceLaneId: string | null;
  resolvedKind: BoardDropTarget['kind'];
  resolvedLaneId: string | null;
  insertionIndex: number | null;
  placement: 'before' | 'after' | 'end' | null;
  resolvedOverId: string | null;
  point: BoardDragPoint | null;
  activeRect: BoardDragRect | null;
  targetLaneRect: BoardDragRect | null;
  unscheduledRect: BoardDragRect | null;
  laneItemCounts: Record<string, number>;
  reason?: Extract<BoardDropTarget, { valid: false }>['reason'];
};

export type ScheduleBoardDrop =
  | {
      kind: 'lane';
      laneId: string;
      insertionIndex: number;
      placement: 'before' | 'after' | 'end';
      overId: string | null;
      debug?: ScheduleBoardDropDebug;
    }
  | {
      kind: 'unscheduled';
      overId: 'unscheduled';
      debug?: ScheduleBoardDropDebug;
    };

type BoardDragEvent = DragMoveEvent | DragOverEvent | DragEndEvent;

type DragGeometry = {
  lanes: BoardDragLane[];
  unscheduledRect: BoardDragRect | null;
};

function rectFromElement(element: Element | null | undefined): BoardDragRect | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function dragRectFromEvent(event: BoardDragEvent): BoardDragRect | null {
  const rect = ((event.active.rect?.current as any)?.translated ?? (event.active.rect?.current as any)?.initial) as
    | { left: number; top: number; width: number; height: number }
    | undefined;
  if (!rect) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

export function dragPointerFromEvent(event: BoardDragEvent): BoardDragPoint | null {
  const activator = event.activatorEvent as { clientX?: unknown; clientY?: unknown } | undefined;
  const clientX = typeof activator?.clientX === 'number' && Number.isFinite(activator.clientX) ? activator.clientX : null;
  const clientY = typeof activator?.clientY === 'number' && Number.isFinite(activator.clientY) ? activator.clientY : null;
  const deltaX = typeof event.delta?.x === 'number' && Number.isFinite(event.delta.x) ? event.delta.x : 0;
  const deltaY = typeof event.delta?.y === 'number' && Number.isFinite(event.delta.y) ? event.delta.y : 0;
  if (clientX !== null && clientY !== null) {
    return { x: clientX + deltaX, y: clientY + deltaY };
  }

  const rect = dragRectFromEvent(event);
  return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
}

function toBoardDrop(target: BoardDropTarget, debug?: ScheduleBoardDropDebug): ScheduleBoardDrop | null {
  if (!target.valid) return null;
  if (target.kind === 'unscheduled') return { kind: 'unscheduled', overId: target.overId, debug };
  return {
    kind: 'lane',
    laneId: target.laneId,
    insertionIndex: target.insertionIndex,
    placement: target.placement,
    overId: target.overId,
    debug,
  };
}

function boardDropSignature(target: BoardDropTarget): string {
  if (!target.valid) return `none:${target.reason ?? ''}:${target.overId ?? ''}`;
  if (target.kind === 'unscheduled') return 'unscheduled';
  return `lane:${target.laneId}:${target.insertionIndex}:${target.placement}:${target.overId ?? ''}`;
}

export function boardEdgeScrollDelta(position: number, start: number, end: number, edge = 72, maxStep = 24): number {
  if (position < start + edge) {
    const pressure = Math.min(1, Math.max(0, (start + edge - position) / edge));
    return -Math.max(4, Math.round(maxStep * pressure));
  }
  if (position > end - edge) {
    const pressure = Math.min(1, Math.max(0, (position - (end - edge)) / edge));
    return Math.max(4, Math.round(maxStep * pressure));
  }
  return 0;
}

export function useScheduleBoardDragController(input: {
  interactionDisabled: boolean;
  blockedDragIds?: ReadonlySet<string>;
  blockedLaneIds?: ReadonlySet<string>;
  visibleInstallerIds: string[];
  laneItems: Map<string, ScheduleItem[]>;
  scheduleItemById: Map<string, ScheduleItem>;
  onDrop: (activeId: string, drop: ScheduleBoardDrop) => void;
}) {
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const laneBodyRefs = useRef(new Map<string, HTMLDivElement | null>());
  const boardCardRefs = useRef(new Map<string, HTMLElement | null>());
  const unscheduledBodyRef = useRef<HTMLDivElement | null>(null);
  const dragGeometryRef = useRef<DragGeometry | null>(null);
  const renderedTargetRef = useRef<{ target: BoardDropTarget; debug: ScheduleBoardDropDebug } | null>(null);
  const activeDragIdRef = useRef<string | null>(null);
  const remeasureFrameRef = useRef<number | null>(null);
  const latestMoveEventRef = useRef<DragMoveEvent | null>(null);
  const lastDropTargetSignatureRef = useRef<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [boardDropTarget, setBoardDropTarget] = useState<BoardDropTarget | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const measureGeometry = useCallback((): DragGeometry => {
    const lanes = input.visibleInstallerIds.map((installerId) => {
      const items = input.laneItems.get(installerId) ?? [];
      const itemRects: BoardDragLane['itemRects'] = {};
      for (const item of items) itemRects[item.id] = rectFromElement(boardCardRefs.current.get(item.id));
      return {
        id: installerId,
        itemIds: items.map((item) => item.id),
        rect: rectFromElement(laneBodyRefs.current.get(installerId) ?? null),
        itemRects,
      };
    });
    return { lanes, unscheduledRect: rectFromElement(unscheduledBodyRef.current) };
  }, [input.laneItems, input.visibleInstallerIds]);

  const resolveDrop = useCallback((event: BoardDragEvent, remeasure = false) => {
    if (remeasure || !dragGeometryRef.current) dragGeometryRef.current = measureGeometry();
    const geometry = dragGeometryRef.current;
    const activeId = String(event.active.id);
    const eventOverId = event.over ? String(event.over.id) : null;
    const activeItem = input.scheduleItemById.get(activeId) ?? null;
    const sourceLaneId = activeItem?.installerId ?? null;
    const allowedLaneIds = activeItem?.itemType === 'downtime' && sourceLaneId ? new Set([sourceLaneId]) : null;
    const point = dragPointerFromEvent(event);
    const target = resolveBoardDropTarget({
      activeId,
      sourceLaneId,
      overId: eventOverId,
      point,
      lanes: geometry.lanes,
      unscheduledRect: geometry.unscheduledRect,
      allowedLaneIds,
    });
    const scopedTarget = target.valid && target.kind === 'lane' && input.blockedLaneIds?.has(target.laneId)
      ? { valid: false, kind: 'none', overId: target.overId, reason: 'restricted' } as const
      : target;
    const resolvedLaneId = scopedTarget.valid && scopedTarget.kind === 'lane' ? scopedTarget.laneId : null;
    const targetLaneRect = resolvedLaneId
      ? geometry.lanes.find((lane) => lane.id === resolvedLaneId)?.rect ?? null
      : null;
    const debug: ScheduleBoardDropDebug = {
      activeId,
      rawOverId: eventOverId,
      sourceLaneId,
      resolvedKind: scopedTarget.kind,
      resolvedLaneId,
      insertionIndex: scopedTarget.valid && scopedTarget.kind === 'lane' ? scopedTarget.insertionIndex : null,
      placement: scopedTarget.valid && scopedTarget.kind === 'lane' ? scopedTarget.placement : null,
      resolvedOverId: scopedTarget.overId,
      point,
      activeRect: dragRectFromEvent(event),
      targetLaneRect,
      unscheduledRect: geometry.unscheduledRect,
      laneItemCounts: Object.fromEntries(geometry.lanes.map((lane) => [lane.id, lane.itemIds.length])),
      reason: scopedTarget.valid ? undefined : scopedTarget.reason,
    };
    return { target: scopedTarget, debug };
  }, [input.blockedLaneIds, input.scheduleItemById, measureGeometry]);

  const applyDropTarget = useCallback((target: BoardDropTarget, debug: ScheduleBoardDropDebug, phase: 'over' | 'move') => {
    renderedTargetRef.current = { target, debug };
    const signature = boardDropSignature(target);
    if (lastDropTargetSignatureRef.current !== signature) {
      lastDropTargetSignatureRef.current = signature;
      logScheduleDebug('board.drop.target', { phase, ...debug });
    }
    setBoardDropTarget(target);
  }, []);

  const clearDragState = useCallback(() => {
    if (remeasureFrameRef.current !== null) window.cancelAnimationFrame(remeasureFrameRef.current);
    remeasureFrameRef.current = null;
    activeDragIdRef.current = null;
    latestMoveEventRef.current = null;
    dragGeometryRef.current = null;
    renderedTargetRef.current = null;
    lastDropTargetSignatureRef.current = null;
    setActiveDragId(null);
    setBoardDropTarget(null);
  }, []);

  useEffect(() => {
    if (input.interactionDisabled && activeDragIdRef.current) clearDragState();
  }, [clearDragState, input.interactionDisabled]);

  useEffect(() => () => {
    if (remeasureFrameRef.current !== null) window.cancelAnimationFrame(remeasureFrameRef.current);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (input.interactionDisabled) return;
    const activeId = String(event.active.id);
    if (input.blockedDragIds?.has(activeId)) return;
    activeDragIdRef.current = activeId;
    latestMoveEventRef.current = null;
    dragGeometryRef.current = measureGeometry();
    renderedTargetRef.current = null;
    lastDropTargetSignatureRef.current = null;
    setActiveDragId(activeId);
    setBoardDropTarget(null);
  }, [input.blockedDragIds, input.interactionDisabled, measureGeometry]);

  const scheduleRemeasure = useCallback(() => {
    if (remeasureFrameRef.current !== null) window.cancelAnimationFrame(remeasureFrameRef.current);
    remeasureFrameRef.current = window.requestAnimationFrame(() => {
      remeasureFrameRef.current = null;
      const latestEvent = latestMoveEventRef.current;
      if (!activeDragIdRef.current || !latestEvent) return;
      const { target, debug } = resolveDrop(latestEvent, true);
      applyDropTarget(target, debug, 'move');
    });
  }, [applyDropTarget, resolveDrop]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!activeDragIdRef.current) return;
    latestMoveEventRef.current = event;
    const { target, debug } = resolveDrop(event);
    applyDropTarget(target, debug, 'move');
    const point = dragPointerFromEvent(event);
    if (!point) return;

    let scrolled = false;
    let boardScrolledVertically = false;
    const board = boardScrollRef.current;
    if (board) {
      const rect = board.getBoundingClientRect();
      if (board.scrollWidth > board.clientWidth + 1) {
        const dx = boardEdgeScrollDelta(point.x, rect.left, rect.right);
        if ((dx < 0 && board.scrollLeft > 0) || (dx > 0 && board.scrollLeft < board.scrollWidth - board.clientWidth)) {
          board.scrollLeft += dx;
          scrolled = true;
        }
      }
      if (board.scrollHeight > board.clientHeight + 1) {
        const dy = boardEdgeScrollDelta(point.y, rect.top, rect.bottom);
        if ((dy < 0 && board.scrollTop > 0) || (dy > 0 && board.scrollTop < board.scrollHeight - board.clientHeight)) {
          board.scrollTop += dy;
          scrolled = true;
          boardScrolledVertically = true;
        }
      }
    }

    const verticalTarget = target.valid && target.kind === 'unscheduled'
      ? unscheduledBodyRef.current
      : target.valid && target.kind === 'lane'
        ? laneBodyRefs.current.get(target.laneId) ?? null
        : null;
    if (verticalTarget && !boardScrolledVertically && verticalTarget.scrollHeight > verticalTarget.clientHeight + 1) {
      const rect = verticalTarget.getBoundingClientRect();
      const dy = boardEdgeScrollDelta(point.y, rect.top, rect.bottom);
      if ((dy < 0 && verticalTarget.scrollTop > 0) || (dy > 0 && verticalTarget.scrollTop < verticalTarget.scrollHeight - verticalTarget.clientHeight)) {
        verticalTarget.scrollTop += dy;
        scrolled = true;
      }
    }

    if (scrolled) {
      dragGeometryRef.current = null;
      scheduleRemeasure();
    }
  }, [applyDropTarget, resolveDrop, scheduleRemeasure]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (!activeDragIdRef.current) {
      clearDragState();
      return;
    }
    const activeId = String(event.active.id);
    if (remeasureFrameRef.current !== null) window.cancelAnimationFrame(remeasureFrameRef.current);
    remeasureFrameRef.current = null;
    // Release is authoritative: resolve once against current card/lane geometry
    // so a delayed scroll remeasure can never commit an older visual target.
    const finalTarget = resolveDrop(event, true);
    const rendered = finalTarget.target.valid ? finalTarget : renderedTargetRef.current ?? finalTarget;
    const drop = toBoardDrop(rendered.target, rendered.debug);
    logScheduleDebug('board.drop.end', { ...rendered.debug, valid: Boolean(drop) });
    clearDragState();
    if (drop) input.onDrop(activeId, drop);
  }, [clearDragState, input, resolveDrop]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    if (!activeDragIdRef.current) return;
    const { target, debug } = resolveDrop(event);
    applyDropTarget(target, debug, 'over');
  }, [applyDropTarget, resolveDrop]);

  return {
    sensors,
    activeDragId,
    boardDropTarget,
    boardScrollRef,
    laneBodyRefs,
    boardCardRefs,
    unscheduledBodyRef,
    handleDragStart,
    handleDragOver,
    handleDragMove,
    handleDragEnd,
    clearDragState,
  };
}
