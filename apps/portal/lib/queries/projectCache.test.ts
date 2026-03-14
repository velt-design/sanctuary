import { describe, expect, it, vi } from 'vitest';
import { buildProjectSnapshotPlaceholder, invalidateProjectReadCaches } from './projectCache';
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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.projects.list('host') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.quotes.versionsByProject('host', 'proj_123') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.estimates.metaByProject('host', 'proj_123') });
  });
});
