// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { ensureSchedulingCrewsV2Migration } from '@/lib/repo/migrations';
import { BRAND_ACCENT_HEX } from '@sp/theme';

function setJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getJson<T>(key: string): T {
  const raw = window.localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : (null as any);
}

describe('ensureSchedulingCrewsV2Migration', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const mockStorage: Storage = {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      configurable: true,
    });
    window.localStorage.clear();
  });

  it('maps legacy crew installer IDs to v2 crew IDs and removes unmapped schedule items', () => {
    setJson('sp_installers_v1', [
      { id: 'ins_old_1', name: 'Crew 1', color: '#000', active: true, sortOrder: 1 },
      { id: 'ins_old_2', name: 'Crew 2', color: '#111', active: true, sortOrder: 2 },
      { id: 'ins_old_3', name: 'Crew 3', color: '#222', active: true, sortOrder: 3 },
    ]);

    setJson('sp_schedule_items_v1', [
      { id: 'sch_1', projectId: 'p1', estimateId: 'e1', installerId: 'ins_old_1', sortIndex: 0, updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'sch_2', projectId: 'p2', estimateId: 'e2', installerId: 'ins_old_2', sortIndex: 0, updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'sch_3', projectId: 'p3', estimateId: 'e3', installerId: 'ins_old_3', sortIndex: 0, updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'sch_4', projectId: 'p4', estimateId: 'e4', installerId: 'ins_unknown', sortIndex: 0, updatedAt: '2026-01-01T00:00:00Z' },
    ]);

    const res = ensureSchedulingCrewsV2Migration();
    expect(res.changed).toBe(true);
    expect(res.mapped).toBe(3);
    expect(res.movedToUnscheduled).toBe(1);

    const installers = getJson<any[]>('sp_installers_v1');
    expect(installers).toHaveLength(5);
    expect(installers.map((i) => i.id)).toEqual(['crew_jayden', 'crew_david', 'crew_alistair', 'crew_eder', 'crew_jesse']);
    expect(installers.map((i) => i.name)).toEqual(['Jayden', 'David', 'Alistair', 'Eder', 'Jesse']);

    const items = getJson<any[]>('sp_schedule_items_v1');
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.installerId)).toEqual(['crew_jayden', 'crew_david', 'crew_alistair']);
  });

  it('removes schedule items that reference missing installers even when v2 is already installed', () => {
    setJson('sp_installers_v1', [
      { id: 'crew_jayden', name: 'Jayden', color: BRAND_ACCENT_HEX, active: true, sortOrder: 1 },
      { id: 'crew_david', name: 'David', color: '#1f6f8b', active: true, sortOrder: 2 },
      { id: 'crew_alistair', name: 'Alistair', color: '#2a9d8f', active: true, sortOrder: 3 },
      { id: 'crew_eder', name: 'Eder', color: '#f4a261', active: true, sortOrder: 4 },
      { id: 'crew_jesse', name: 'Jesse', color: '#264653', active: true, sortOrder: 5 },
    ]);

    setJson('sp_schedule_items_v1', [
      { id: 'sch_1', projectId: 'p1', estimateId: 'e1', installerId: 'crew_jayden', sortIndex: 0, updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'sch_2', projectId: 'p2', estimateId: 'e2', installerId: 'crew_missing', sortIndex: 0, updatedAt: '2026-01-01T00:00:00Z' },
    ]);

    const res = ensureSchedulingCrewsV2Migration();
    expect(res.movedToUnscheduled).toBe(1);

    const items = getJson<any[]>('sp_schedule_items_v1');
    expect(items).toHaveLength(1);
    expect(items[0].installerId).toBe('crew_jayden');
  });
});

