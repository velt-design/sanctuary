'use client';

import { useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import ProjectDetailsSidebar from './ProjectDetailsSidebar';
import ProjectTasksSidebar from './ProjectTasksSidebar';
import ProjectMainTabs from './ProjectMainTabs';
import ProjectPanelFrame from './ProjectPanelFrame';
import { useProjectColumnLayout } from './useProjectColumnLayout';
import {
  findProjectPanelRail,
  keyboardMoveProjectPanel,
  moveProjectPanel,
  reorderProjectPanelInRail,
  type ProjectPanelId,
  type ProjectPanelRail,
  useProjectPanelSlots,
} from './useProjectPanelSlots';
import styles from './ProjectPage.module.css';

const PANEL_TITLES: Record<ProjectPanelId, string> = {
  details: 'Project details',
  tasks: 'Project tasks',
};

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function isProjectPanelId(value: string): value is ProjectPanelId {
  return value === 'details' || value === 'tasks';
}

function getRailSlotId(rail: ProjectPanelRail): string {
  return `rail-slot:${rail}`;
}

function parseRailSlotId(value: string): ProjectPanelRail | null {
  if (value === getRailSlotId('left')) return 'left';
  if (value === getRailSlotId('right')) return 'right';
  return null;
}

function RailDropSlot({
  rail,
  visible,
}: {
  rail: ProjectPanelRail;
  visible: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: getRailSlotId(rail),
    disabled: !visible,
  });

  return (
    <div
      ref={visible ? setNodeRef : undefined}
      className={cx(
        styles.railDropZone,
        visible ? styles.railDropZoneVisible : styles.railDropZoneHidden,
        isOver && styles.railDropZoneActive,
      )}
      data-project-drop-rail={rail}
      aria-hidden={!visible}
    >
      <span className={styles.railDropZoneCopy}>{rail === 'left' ? 'Drop on left rail' : 'Drop on right rail'}</span>
    </div>
  );
}

function SortableProjectPanel({
  children,
  dragEnabled,
  dropTarget,
  onKeyboardMove,
  panelId,
  title,
}: {
  children: ReactNode;
  dragEnabled: boolean;
  dropTarget: boolean;
  onKeyboardMove: (panelId: ProjectPanelId, direction: 'left' | 'right' | 'up' | 'down') => void;
  panelId: ProjectPanelId;
  title: string;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({
    id: panelId,
    disabled: !dragEnabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.52 : 1,
  } as const;
  const listenerKeyDown = listeners?.onKeyDown;
  const dragHandleProps =
    dragEnabled && listeners
      ? {
          ...attributes,
          ...listeners,
          onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              onKeyboardMove(panelId, 'left');
              return;
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              onKeyboardMove(panelId, 'right');
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              onKeyboardMove(panelId, 'up');
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              onKeyboardMove(panelId, 'down');
              return;
            }
            listenerKeyDown?.(event);
          },
        }
      : undefined;

  return (
    <div
      ref={setNodeRef}
      className={styles.panelSlot}
      style={style}
      data-project-panel={panelId}
      data-drop-target={dropTarget ? 'true' : undefined}
    >
      <ProjectPanelFrame
        dragHandleProps={dragHandleProps}
        dragHandleRef={dragEnabled ? setActivatorNodeRef : undefined}
        dragging={isDragging}
        dropTarget={dropTarget}
        title={title}
      >
        {children}
      </ProjectPanelFrame>
    </div>
  );
}

export default function ProjectPageShell({
  snapshot,
  tab,
}: {
  snapshot: ProjectPageSnapshot;
  tab: string;
}) {
  const { containerRef, createKeyDownHandler, createPointerDownHandler, isDesktopLayout, isResizing, shellStyle } =
    useProjectColumnLayout();
  const { setSlots, slots } = useProjectPanelSlots();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activePanelId, setActivePanelId] = useState<ProjectPanelId | null>(null);
  const [overTargetId, setOverTargetId] = useState<string | null>(null);
  const isPanelDragging = activePanelId !== null;

  const handleKeyboardMove = (panelId: ProjectPanelId, direction: 'left' | 'right' | 'up' | 'down') => {
    setSlots((prev) => keyboardMoveProjectPanel(prev, panelId, direction));
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!isDesktopLayout) return;
    const nextId = String(event.active.id);
    if (!isProjectPanelId(nextId)) return;
    setActivePanelId(nextId);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverTargetId(event.over?.id ? String(event.over.id) : null);
  };

  const clearDragState = () => {
    setActivePanelId(null);
    setOverTargetId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const panelId = activePanelId;
    const overId = event.over?.id ? String(event.over.id) : null;
    clearDragState();
    if (!panelId || !overId) return;

    const targetRail = parseRailSlotId(overId);
    if (targetRail) {
      setSlots((prev) => {
        if (prev[targetRail].length >= 2 && findProjectPanelRail(prev, panelId) !== targetRail) return prev;
        return moveProjectPanel(prev, { panelId, rail: targetRail, index: prev[targetRail].length });
      });
      return;
    }

    if (!isProjectPanelId(overId) || overId === panelId) return;

    setSlots((prev) => {
      const sourceRail = findProjectPanelRail(prev, panelId);
      const overRail = findProjectPanelRail(prev, overId);
      if (!sourceRail || !overRail) return prev;
      if (sourceRail === overRail) {
        return reorderProjectPanelInRail(prev, sourceRail, panelId, overId);
      }
      if (prev[overRail].length >= 2) return prev;
      return moveProjectPanel(prev, { panelId, rail: overRail, index: prev[overRail].length });
    });
  };

  const renderPanel = (panelId: ProjectPanelId) => {
    if (panelId === 'details') {
      return <ProjectDetailsSidebar project={snapshot.project} />;
    }
    return <ProjectTasksSidebar projectId={snapshot.project.id} tasks={snapshot.tasks} />;
  };

  const renderRail = (rail: ProjectPanelRail) => {
    const panelIds = slots[rail];
    if (!isDesktopLayout && panelIds.length === 0) return null;

    const showDropZone =
      isDesktopLayout &&
      (panelIds.length === 0 ||
        (isPanelDragging && panelIds.length < 2 && activePanelId !== null && findProjectPanelRail(slots, activePanelId) !== rail));

    return (
      <aside
        key={rail}
        className={cx(styles.rail, rail === 'left' ? styles.railLeft : styles.railRight)}
        data-panel-count={panelIds.length}
        data-project-rail={rail}
      >
        <SortableContext items={panelIds} strategy={verticalListSortingStrategy}>
          <div className={styles.railStack} data-panel-count={panelIds.length}>
            {panelIds.map((panelId) => (
              <SortableProjectPanel
                key={panelId}
                dragEnabled={isDesktopLayout}
                dropTarget={isDesktopLayout && activePanelId !== panelId && overTargetId === panelId}
                onKeyboardMove={handleKeyboardMove}
                panelId={panelId}
                title={PANEL_TITLES[panelId]}
              >
                {renderPanel(panelId)}
              </SortableProjectPanel>
            ))}

            <RailDropSlot rail={rail} visible={showDropZone} />
          </div>
        </SortableContext>
      </aside>
    );
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      onDragCancel={clearDragState}
      sensors={sensors}
    >
      <div
        ref={containerRef}
        className={cx(
          styles.bodyGrid,
          isDesktopLayout && styles.bodyGridDesktop,
          isResizing && styles.bodyGridResizing,
          isPanelDragging && styles.bodyGridDraggingPanels,
        )}
        data-project-page-shell="true"
        style={shellStyle}
      >
        {renderRail('left')}

        {isDesktopLayout ? (
          <button
            type="button"
            className={cx(styles.resizeHandle, styles.resizeHandleLeft)}
            aria-label="Resize left project rail"
            onKeyDown={createKeyDownHandler('left')}
            onPointerDown={createPointerDownHandler('left')}
          />
        ) : null}

        <section className={styles.center}>
          <ProjectMainTabs snapshot={snapshot} tab={tab} />
        </section>

        {isDesktopLayout ? (
          <button
            type="button"
            className={cx(styles.resizeHandle, styles.resizeHandleRight)}
            aria-label="Resize right project rail"
            onKeyDown={createKeyDownHandler('right')}
            onPointerDown={createPointerDownHandler('right')}
          />
        ) : null}

        {renderRail('right')}
      </div>

      <DragOverlay>
        {activePanelId ? (
          <div className={styles.panelOverlay}>
            <ProjectPanelFrame overlay title={PANEL_TITLES[activePanelId]}>
              <div className={styles.panelOverlayCopy}>Move {PANEL_TITLES[activePanelId].toLowerCase()}</div>
            </ProjectPanelFrame>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
