'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// Keep the original Board key so existing preferences become shared without migration loss.
export const SCHEDULE_HIDDEN_CREWS_STORAGE_KEY = 'sp.schedule.board.hiddenCrewIds.v1';

export function parseHiddenCrewIds(raw: string | null, validCrewIds: ReadonlySet<string>): Set<string> {
  if (!raw) return new Set();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string' && validCrewIds.has(value)));
  } catch {
    return new Set();
  }
}

function readHiddenCrewIds(validCrewIds: ReadonlySet<string>): Set<string> {
  if (typeof window === 'undefined') return new Set();

  try {
    return parseHiddenCrewIds(window.localStorage.getItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY), validCrewIds);
  } catch {
    return new Set();
  }
}

function writeHiddenCrewIds(hiddenCrewIds: ReadonlySet<string>): void {
  if (typeof window === 'undefined') return;

  try {
    if (hiddenCrewIds.size === 0) {
      window.localStorage.removeItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY, JSON.stringify(Array.from(hiddenCrewIds)));
  } catch {
    // Visibility is a convenience preference, so storage failures should not block Schedule.
  }
}

export function useScheduleCrewVisibility(crewIds: readonly string[]) {
  const validCrewIds = useMemo(() => new Set(crewIds), [crewIds]);
  const [hiddenCrewIds, setHiddenCrewIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (validCrewIds.size === 0) {
      setHiddenCrewIds(new Set());
      return;
    }
    const storedCrewIds = readHiddenCrewIds(validCrewIds);
    setHiddenCrewIds(storedCrewIds);
    writeHiddenCrewIds(storedCrewIds);
  }, [validCrewIds]);

  const updateHiddenCrewIds = useCallback(
    (update: (current: ReadonlySet<string>) => Set<string>) => {
      setHiddenCrewIds((current) => {
        const next = new Set(Array.from(update(current)).filter((crewId) => validCrewIds.has(crewId)));
        writeHiddenCrewIds(next);
        return next;
      });
    },
    [validCrewIds],
  );

  const toggleCrew = useCallback(
    (crewId: string) => {
      if (!validCrewIds.has(crewId)) return;
      updateHiddenCrewIds((current) => {
        const next = new Set(current);
        if (next.has(crewId)) next.delete(crewId);
        else next.add(crewId);
        return next;
      });
    },
    [updateHiddenCrewIds, validCrewIds],
  );

  const hideCrews = useCallback(
    (crewIdsToHide: readonly string[]) => {
      updateHiddenCrewIds((current) => {
        const next = new Set(current);
        for (const crewId of crewIdsToHide) {
          if (validCrewIds.has(crewId)) next.add(crewId);
        }
        return next;
      });
    },
    [updateHiddenCrewIds, validCrewIds],
  );

  const showAllCrews = useCallback(() => {
    updateHiddenCrewIds(() => new Set());
  }, [updateHiddenCrewIds]);

  return {
    hiddenCrewIds,
    toggleCrew,
    hideCrews,
    showAllCrews,
  };
}
