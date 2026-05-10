'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { arrayMove } from '@dnd-kit/sortable';

export const PROJECT_PANEL_LAYOUT_STORAGE_KEY = 'sp.projectPage.panelSlots.v1';
const PROJECT_PANEL_IDS = ['details'] as const;
const PROJECT_PANEL_RAILS = ['left', 'right'] as const;

export type ProjectPanelId = (typeof PROJECT_PANEL_IDS)[number];
export type ProjectPanelRail = (typeof PROJECT_PANEL_RAILS)[number];
type ProjectPanelSlots = Record<ProjectPanelRail, ProjectPanelId[]>;

const DEFAULT_PROJECT_PANEL_SLOTS: ProjectPanelSlots = {
  left: ['details'],
  right: [],
};

function isProjectPanelId(value: unknown): value is ProjectPanelId {
  return typeof value === 'string' && PROJECT_PANEL_IDS.includes(value as ProjectPanelId);
}

function readStoredSlots(): ProjectPanelSlots {
  if (typeof window === 'undefined') return DEFAULT_PROJECT_PANEL_SLOTS;
  try {
    const raw = window.localStorage.getItem(PROJECT_PANEL_LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_PROJECT_PANEL_SLOTS;
    return normalizeProjectPanelSlots(JSON.parse(raw));
  } catch {
    return DEFAULT_PROJECT_PANEL_SLOTS;
  }
}

function writeStoredSlots(slots: ProjectPanelSlots): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROJECT_PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(slots));
  } catch {
    // Ignore storage failures so panel layout keeps working in-memory.
  }
}

export function normalizeProjectPanelSlots(value: unknown): ProjectPanelSlots {
  const normalized: ProjectPanelSlots = { left: [], right: [] };
  const seen = new Set<ProjectPanelId>();

  if (value && typeof value === 'object') {
    for (const rail of PROJECT_PANEL_RAILS) {
      const list = (value as Record<string, unknown>)[rail];
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!isProjectPanelId(item) || seen.has(item)) continue;
        if (normalized[rail].length >= 2) continue;
        normalized[rail].push(item);
        seen.add(item);
      }
    }
  }

  for (const panelId of PROJECT_PANEL_IDS) {
    if (seen.has(panelId)) continue;
    const preferredRail: ProjectPanelRail = panelId === 'details' ? 'left' : 'right';
    const fallbackRail: ProjectPanelRail = preferredRail === 'left' ? 'right' : 'left';
    const targetRail = normalized[preferredRail].length < 2 ? preferredRail : fallbackRail;
    normalized[targetRail].push(panelId);
    seen.add(panelId);
  }

  return normalized;
}

export function findProjectPanelRail(slots: ProjectPanelSlots, panelId: ProjectPanelId): ProjectPanelRail | null {
  if (slots.left.includes(panelId)) return 'left';
  if (slots.right.includes(panelId)) return 'right';
  return null;
}

export function moveProjectPanel(
  slots: ProjectPanelSlots,
  args: {
    panelId: ProjectPanelId;
    rail: ProjectPanelRail;
    index?: number;
  },
): ProjectPanelSlots {
  const currentRail = findProjectPanelRail(slots, args.panelId);
  if (!currentRail) return slots;

  const next: ProjectPanelSlots = {
    left: slots.left.filter((panelId) => panelId !== args.panelId),
    right: slots.right.filter((panelId) => panelId !== args.panelId),
  };
  const targetRail = args.rail;
  const nextIndex = Math.max(0, Math.min(args.index ?? next[targetRail].length, next[targetRail].length));
  if (next[targetRail].length >= 2) return slots;
  next[targetRail].splice(nextIndex, 0, args.panelId);
  return normalizeProjectPanelSlots(next);
}

export function reorderProjectPanelInRail(
  slots: ProjectPanelSlots,
  rail: ProjectPanelRail,
  activePanelId: ProjectPanelId,
  overPanelId: ProjectPanelId,
): ProjectPanelSlots {
  const panels = slots[rail];
  const activeIndex = panels.indexOf(activePanelId);
  const overIndex = panels.indexOf(overPanelId);
  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return slots;
  const nextPanels = arrayMove(panels, activeIndex, overIndex);
  return rail === 'left' ? { left: nextPanels, right: slots.right } : { left: slots.left, right: nextPanels };
}

export function keyboardMoveProjectPanel(
  slots: ProjectPanelSlots,
  panelId: ProjectPanelId,
  direction: 'left' | 'right' | 'up' | 'down',
): ProjectPanelSlots {
  const currentRail = findProjectPanelRail(slots, panelId);
  if (!currentRail) return slots;

  if (direction === 'up' || direction === 'down') {
    const panels = slots[currentRail];
    const index = panels.indexOf(panelId);
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= panels.length) return slots;
    const nextPanels = arrayMove(panels, index, nextIndex);
    return currentRail === 'left' ? { left: nextPanels, right: slots.right } : { left: slots.left, right: nextPanels };
  }

  const targetRail: ProjectPanelRail = direction;
  if (targetRail === currentRail) return slots;
  if (slots[targetRail].length === 1 && slots[currentRail].length === 1) {
    const oppositePanelId = slots[targetRail][0]!;
    return normalizeProjectPanelSlots({
      [currentRail]: [oppositePanelId],
      [targetRail]: [panelId],
    });
  }

  return moveProjectPanel(slots, { panelId, rail: targetRail, index: slots[targetRail].length });
}

export function useProjectPanelSlots() {
  const [slots, setSlotsState] = useState<ProjectPanelSlots>(() => readStoredSlots());

  useEffect(() => {
    writeStoredSlots(slots);
  }, [slots]);

  const setSlots: Dispatch<SetStateAction<ProjectPanelSlots>> = useCallback((value) => {
    setSlotsState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      return normalizeProjectPanelSlots(next);
    });
  }, []);

  const movePanel = useCallback(
    (panelId: ProjectPanelId, rail: ProjectPanelRail, index?: number) => {
      setSlotsState((prev) => moveProjectPanel(prev, { panelId, rail, index }));
    },
    [],
  );

  return {
    slots,
    movePanel,
    setSlots,
  };
}
