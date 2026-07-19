import { describe, expect, it, vi } from 'vitest';
import {
  buildProjectSnapshotPlaceholder,
  getProjectSnapshotPlaceholderFromCaches,
  invalidateProjectReadCaches,
} from './projectCache';
import { qk } from './keys';

describe('projectCache helpers', () => {
  it('builds a usable project snapshot placeholder from a project summary', () => {
    const placeholder = buildProjectSnapshotPlaceholder({
      id: 'proj_123',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
      status: 'QUOTING',
      isArchived: false,
      isLost: false,
      legacyStatus: 'QUOTING',
      projectName: 'Beach House',
      name: 'Beach House',
      contactId: 'ct_1',
      clientName: 'Alex',
      region: 'North',
      quoteRef: 'Q-100',
      siteAddress: '1 Ocean Road',
      address: '1 Ocean Road',
      nextActionDate: '2026-03-05',
      followUpDate: '2026-03-05',
      notes: '',
    });

    expect(placeholder.snapshot.project.id).toBe('proj_123');
    expect(placeholder.snapshot.project.name).toBe('Beach House');
    expect(placeholder.snapshot.project.contactId).toBe('ct_1');
    expect(placeholder.snapshot.pipeline.stage).toBe('quoting');
    expect(placeholder.snapshot.tasks.items).toEqual([]);
    expect(placeholder.generatedAt).toBe('2026-03-02T00:00:00.000Z');
  });

  it('invalidates the expected read keys for a project', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await invalidateProjectReadCaches(
      { invalidateQueries } as any,
      'host',
      'proj_123',
      { includeQuotes: true, includeEstimates: true },
    );

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.projects.snapshot('host', 'proj_123') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.projects.detail('host', 'proj_123') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.projects.listPrefix('host') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.quotes.versionsByProject('host', 'proj_123') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.estimates.metaByProject('host', 'proj_123') });
  });

  it.each(['active', 'all'] as const)('builds a summary from the %s project cache and enriches it from contacts', (scope) => {
    const values = new Map<string, unknown>([
      [JSON.stringify(qk.projects.list('host', scope)), [{
        id: 'proj_123',
        contactId: 'ct_1',
        projectName: 'Beach House',
        status: 'QUOTING',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:00.000Z',
      }]],
      [JSON.stringify(qk.contacts.list('host')), [{
        id: 'ct_1',
        displayName: 'Alex Mason',
        email: 'alex@example.com',
        phone: '021 123 4567',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:00.000Z',
      }]],
    ]);
    const queryClient = {
      getQueryData: (key: readonly unknown[]) => values.get(JSON.stringify(key)),
    } as any;

    const result = getProjectSnapshotPlaceholderFromCaches(queryClient, 'host', 'proj_123');

    expect(result?.snapshot.project.name).toBe('Beach House');
    expect(result?.snapshot.project.contactName).toBe('Alex Mason');
    expect(result?.snapshot.project.contactEmail).toBe('alex@example.com');
    expect(result?.snapshot.project.contactPhone).toBe('021 123 4567');
  });

  it('never reads a project from another query client or host boundary', () => {
    const userA = {
      getQueryData: (key: readonly unknown[]) =>
        JSON.stringify(key) === JSON.stringify(qk.projects.list('host-a', 'active'))
          ? [{ id: 'proj_private', projectName: 'Private', status: 'NEW' }]
          : undefined,
    } as any;
    const userB = { getQueryData: () => undefined } as any;

    expect(getProjectSnapshotPlaceholderFromCaches(userA, 'host-a', 'proj_private')).toBeDefined();
    expect(getProjectSnapshotPlaceholderFromCaches(userA, 'host-b', 'proj_private')).toBeUndefined();
    expect(getProjectSnapshotPlaceholderFromCaches(userB, 'host-a', 'proj_private')).toBeUndefined();
  });
});
