'use client';

import { useCallback, useEffect, useState, type ButtonHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
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
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import { LazyProjectDetailsSidebar } from './projectDetailsModule';
import { ProjectPageDesignRailProvider } from './ProjectPageDesignRailContext';
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
};

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function isProjectPanelId(value: string): value is ProjectPanelId {
  return value === 'details';
}

function getRailSlotId(rail: ProjectPanelRail): string {
  return `rail-slot:${rail}`;
}

function getRailHandleSlotId(rail: ProjectPanelRail): string {
  return `rail-handle-slot:${rail}`;
}

function parseRailDropId(value: string): ProjectPanelRail | null {
  if (value === getRailSlotId('left') || value === getRailHandleSlotId('left')) return 'left';
  if (value === getRailSlotId('right') || value === getRailHandleSlotId('right')) return 'right';
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

function ProjectRailHandle({
  ariaLabel,
  collapseArmed,
  collapsed,
  dropEnabled,
  onClick,
  onKeyDown,
  onPointerDown,
  rail,
  railClassName,
}: {
  ariaLabel: string;
  collapseArmed: boolean;
  collapsed: boolean;
  dropEnabled: boolean;
  onClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  onKeyDown: ButtonHTMLAttributes<HTMLButtonElement>['onKeyDown'];
  onPointerDown: ButtonHTMLAttributes<HTMLButtonElement>['onPointerDown'];
  rail: ProjectPanelRail;
  railClassName: string;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: getRailHandleSlotId(rail),
    disabled: !dropEnabled,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cx(
        styles.resizeHandle,
        railClassName,
        collapsed && styles.resizeHandleCollapsed,
        collapseArmed && styles.resizeHandleCollapseArmed,
        isOver && styles.resizeHandleDropTarget,
      )}
      aria-label={ariaLabel}
      aria-expanded={!collapsed}
      data-collapsed={collapsed ? 'true' : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    />
  );
}

export default function ProjectPageShell({
  snapshot,
  snapshotContentReady = true,
  snapshotState = 'fresh',
  tab,
}: {
  snapshot: ProjectPageSnapshot;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
}) {
  const {
    containerRef,
    createClickHandler,
    createKeyDownHandler,
    createPointerDownHandler,
    expandRail,
    isDesktopLayout,
    isResizing,
    leftCollapseArmed,
    leftCollapsed,
    rightCollapseArmed,
    rightCollapsed,
    shellStyle,
  } = useProjectColumnLayout();
  const { setSlots, slots } = useProjectPanelSlots();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activePanelId, setActivePanelId] = useState<ProjectPanelId | null>(null);
  const [overTargetId, setOverTargetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(tab);
  const [designRailNode, setDesignRailNode] = useState<HTMLDivElement | null>(null);
  const isPanelDragging = activePanelId !== null;
  const isRailCollapsed = (rail: ProjectPanelRail) =>
    isDesktopLayout && (rail === 'left' ? leftCollapsed : rightCollapsed);
  const isDesignRailOverrideActive = isDesktopLayout && activeTab === 'estimates';
  const effectiveLeftPanelIds: ProjectPanelId[] = isDesignRailOverrideActive ? ['details'] : slots.left;
  const effectiveRightPanelIds: ProjectPanelId[] = isDesignRailOverrideActive ? [] : slots.right;
  const handleDesignRailNode = useCallback((node: HTMLDivElement | null) => {
    setDesignRailNode((current) => (current === node ? current : node));
  }, []);

  useEffect(() => {
    setActiveTab(tab);
  }, [tab]);

  useEffect(() => {
    if (!isDesktopLayout) return;
    if (!isDesignRailOverrideActive) return;
    if (!rightCollapsed) return;
    expandRail('right');
  }, [expandRail, isDesktopLayout, isDesignRailOverrideActive, rightCollapsed]);

  const handleKeyboardMove = (panelId: ProjectPanelId, direction: 'left' | 'right' | 'up' | 'down') => {
    if (isDesignRailOverrideActive) return;
    setSlots((prev) => keyboardMoveProjectPanel(prev, panelId, direction));
    if ((direction === 'left' || direction === 'right') && isRailCollapsed(direction)) {
      expandRail(direction);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!isDesktopLayout) return;
    if (isDesignRailOverrideActive) return;
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

    const targetRail = parseRailDropId(overId);
    if (targetRail) {
      setSlots((prev) => {
        if (prev[targetRail].length >= 2 && findProjectPanelRail(prev, panelId) !== targetRail) return prev;
        return moveProjectPanel(prev, { panelId, rail: targetRail, index: prev[targetRail].length });
      });
      expandRail(targetRail);
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
      return <LazyProjectDetailsSidebar project={snapshot.project} />;
    }
    return null;
  };

  const renderRail = (rail: ProjectPanelRail) => {
    const panelIds = rail === 'left' ? effectiveLeftPanelIds : effectiveRightPanelIds;
    const collapsed = isRailCollapsed(rail);
    if (!isDesktopLayout) return null;

    const showDropZone =
      !collapsed &&
      isDesktopLayout &&
      (panelIds.length === 0 ||
        (isPanelDragging && panelIds.length < 2 && activePanelId !== null && findProjectPanelRail(slots, activePanelId) !== rail));

    if (collapsed) {
      return (
        <aside
          key={rail}
          className={cx(styles.rail, rail === 'left' ? styles.railLeft : styles.railRight, styles.railCollapsed)}
          data-collapsed="true"
          data-panel-count={panelIds.length}
          data-project-rail={rail}
        />
      );
    }

    if (rail === 'right' && isDesignRailOverrideActive) {
      return (
        <aside
          key={rail}
          className={cx(styles.rail, styles.railRight)}
          data-panel-count="0"
          data-project-design-rail-active="true"
          data-project-rail={rail}
        >
          <div className={styles.railStack} data-panel-count="0">
            <div className={styles.panelSlot} data-project-custom-rail="design-configurator">
              <ProjectPanelFrame title="Model configurator">
                <div ref={handleDesignRailNode} className={styles.designRailSlot} data-project-design-rail-slot="true" />
              </ProjectPanelFrame>
            </div>
          </div>
        </aside>
      );
    }

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
                dragEnabled={isDesktopLayout && !isDesignRailOverrideActive}
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
    <ProjectPageDesignRailProvider value={{ renderInShell: isDesignRailOverrideActive, rightRailNode: designRailNode }}>
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
          data-project-design-workspace={isDesignRailOverrideActive ? 'true' : undefined}
          data-project-page-shell="true"
          style={shellStyle}
        >
        {renderRail('left')}

        {isDesktopLayout ? (
          <ProjectRailHandle
            ariaLabel={leftCollapsed ? 'Expand left project rail' : 'Resize left project rail'}
            collapseArmed={leftCollapseArmed}
            collapsed={leftCollapsed}
            dropEnabled={
              leftCollapsed &&
              !isDesignRailOverrideActive &&
              isPanelDragging &&
              (slots.left.length === 0 ||
                (slots.left.length < 2 && activePanelId !== null && findProjectPanelRail(slots, activePanelId) !== 'left'))
            }
            onClick={createClickHandler('left')}
            onKeyDown={createKeyDownHandler('left')}
            onPointerDown={createPointerDownHandler('left')}
            rail="left"
            railClassName={styles.resizeHandleLeft}
          />
        ) : null}

        <section className={styles.center}>
          <ProjectMainTabs
            snapshot={snapshot}
            snapshotContentReady={snapshotContentReady}
            snapshotState={snapshotState}
            showDetailsTab={!isDesktopLayout}
            tab={tab}
            onActiveTabChange={setActiveTab}
          />
        </section>

        {isDesktopLayout ? (
          <ProjectRailHandle
            ariaLabel={rightCollapsed ? 'Expand right project rail' : 'Resize right project rail'}
            collapseArmed={rightCollapseArmed}
            collapsed={rightCollapsed}
            dropEnabled={
              rightCollapsed &&
              !isDesignRailOverrideActive &&
              isPanelDragging &&
              (slots.right.length === 0 ||
                (slots.right.length < 2 && activePanelId !== null && findProjectPanelRail(slots, activePanelId) !== 'right'))
            }
            onClick={createClickHandler('right')}
            onKeyDown={createKeyDownHandler('right')}
            onPointerDown={createPointerDownHandler('right')}
            rail="right"
            railClassName={styles.resizeHandleRight}
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
    </ProjectPageDesignRailProvider>
  );
}
