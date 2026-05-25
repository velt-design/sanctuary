import { describe, expect, it } from 'vitest';
import type { PergolaObjectModel } from './objectFirstWorkbenchModel';
import { derivePergolaGroupsFromScene } from './derivePergolaGroupsFromScene';

function makePergola(overrides: Partial<PergolaObjectModel> & { id: string }): PergolaObjectModel {
  return {
    id: overrides.id,
    label: overrides.label ?? overrides.id,
    family: overrides.family ?? 'mono',
    connectionKind: overrides.connectionKind,
    attachmentEdgeId: overrides.attachmentEdgeId ?? null,
    attachmentZoneId: overrides.attachmentZoneId ?? null,
    side: overrides.side ?? 'rear',
    strategy: overrides.strategy ?? null,
    geometry: overrides.geometry,
    position: overrides.position,
    attachment: overrides.attachment,
  };
}

function snapToPergola(targetPergolaId: string): PergolaObjectModel['attachment'] {
  return {
    host: {
      objectFamily: 'pergolas',
      objectId: targetPergolaId,
      edgeKind: 'pergola_outline',
      edgeId: '',
      myEdgeIndex: 0,
    },
    spatialKind: 'pergola_outline',
    method: 'none',
  };
}

function snapToHouse(houseFormId: string): PergolaObjectModel['attachment'] {
  return {
    host: {
      objectFamily: 'house_forms',
      objectId: houseFormId,
      edgeKind: 'wall',
      edgeId: 'footprint-edge-0',
      myEdgeIndex: 0,
    },
    spatialKind: 'wall',
    method: 'facade_ledger',
  };
}

describe('derivePergolaGroupsFromScene', () => {
  it('returns an empty array for an empty input', () => {
    const groups = derivePergolaGroupsFromScene({ pergolas: [] });
    expect(groups).toEqual([]);
  });

  it('puts a single freestanding pergola in its own group', () => {
    const groups = derivePergolaGroupsFromScene({
      pergolas: [makePergola({ id: 'pergola-1' })],
    });
    expect(groups).toEqual([
      { pergolaId: 'pergola-1', modules: [expect.objectContaining({ id: 'pergola-1' })] },
    ]);
  });

  it('keeps two unsnapped pergolas as separate groups', () => {
    const groups = derivePergolaGroupsFromScene({
      pergolas: [makePergola({ id: 'pergola-1' }), makePergola({ id: 'pergola-2' })],
    });
    expect(groups).toHaveLength(2);
    expect(groups[0]?.pergolaId).toBe('pergola-1');
    expect(groups[1]?.pergolaId).toBe('pergola-2');
  });

  it('groups two pergolas snapped to each other as one logical pergola', () => {
    // pergola-2 is attached to pergola-1 in the scene (snap-derived).
    // They cost as two modules of the same logical pergola.
    const groups = derivePergolaGroupsFromScene({
      pergolas: [
        makePergola({ id: 'pergola-1' }),
        makePergola({ id: 'pergola-2', attachment: snapToPergola('pergola-1') }),
      ],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.pergolaId).toBe('pergola-1');
    expect(groups[0]?.modules.map((m) => m.id)).toEqual(['pergola-1', 'pergola-2']);
  });

  it('groups three transitively-snapped pergolas as one logical pergola', () => {
    // pergola-3 → pergola-2 → pergola-1. All three are one logical pergola.
    const groups = derivePergolaGroupsFromScene({
      pergolas: [
        makePergola({ id: 'pergola-1' }),
        makePergola({ id: 'pergola-2', attachment: snapToPergola('pergola-1') }),
        makePergola({ id: 'pergola-3', attachment: snapToPergola('pergola-2') }),
      ],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.pergolaId).toBe('pergola-1');
    expect(groups[0]?.modules.map((m) => m.id)).toEqual(['pergola-1', 'pergola-2', 'pergola-3']);
  });

  it('keeps a pergola attached to a house in its own group (not snapped to other pergolas)', () => {
    // House attachment is not pergola-to-pergola adjacency — different family.
    const groups = derivePergolaGroupsFromScene({
      pergolas: [
        makePergola({ id: 'pergola-1', attachment: snapToHouse('house-main') }),
        makePergola({ id: 'pergola-2' }),
      ],
    });
    expect(groups).toHaveLength(2);
    expect(groups[0]?.pergolaId).toBe('pergola-1');
    expect(groups[1]?.pergolaId).toBe('pergola-2');
  });

  it('separates two cliques: snapped pergolas group, unsnapped pergolas stay alone', () => {
    // Cluster A (pergola-1 + pergola-2) vs. detached pergola-3.
    const groups = derivePergolaGroupsFromScene({
      pergolas: [
        makePergola({ id: 'pergola-1' }),
        makePergola({ id: 'pergola-2', attachment: snapToPergola('pergola-1') }),
        makePergola({ id: 'pergola-3' }),
      ],
    });
    expect(groups).toHaveLength(2);
    expect(groups[0]?.pergolaId).toBe('pergola-1');
    expect(groups[0]?.modules.map((m) => m.id)).toEqual(['pergola-1', 'pergola-2']);
    expect(groups[1]?.pergolaId).toBe('pergola-3');
    expect(groups[1]?.modules.map((m) => m.id)).toEqual(['pergola-3']);
  });

  it('ignores orphaned snap references to nonexistent pergolas', () => {
    // pergola-1's snap target was deleted; the orphaned reference should not
    // cause the pergola to be dropped or grouped with a phantom.
    const groups = derivePergolaGroupsFromScene({
      pergolas: [makePergola({ id: 'pergola-1', attachment: snapToPergola('deleted-pergola') })],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.pergolaId).toBe('pergola-1');
    expect(groups[0]?.modules.map((m) => m.id)).toEqual(['pergola-1']);
  });

  it('treats snap references as undirected — direction does not change grouping', () => {
    // pergola-2 → pergola-1 vs. pergola-1 → pergola-2 produces the same group.
    const directionA = derivePergolaGroupsFromScene({
      pergolas: [
        makePergola({ id: 'pergola-1' }),
        makePergola({ id: 'pergola-2', attachment: snapToPergola('pergola-1') }),
      ],
    });
    const directionB = derivePergolaGroupsFromScene({
      pergolas: [
        makePergola({ id: 'pergola-1', attachment: snapToPergola('pergola-2') }),
        makePergola({ id: 'pergola-2' }),
      ],
    });
    expect(directionA[0]?.modules.map((m) => m.id)).toEqual(directionB[0]?.modules.map((m) => m.id));
    expect(directionA[0]?.pergolaId).toBe(directionB[0]?.pergolaId);
  });

  it('returns groups in lexicographic order by pergolaId for determinism', () => {
    const groups = derivePergolaGroupsFromScene({
      pergolas: [makePergola({ id: 'zebra' }), makePergola({ id: 'apple' }), makePergola({ id: 'mango' })],
    });
    expect(groups.map((g) => g.pergolaId)).toEqual(['apple', 'mango', 'zebra']);
  });

  it('produces a stable pergolaId regardless of input ordering', () => {
    // Input order shouldn't change which id "wins" the group label —
    // lexicographically smallest always wins.
    const orderA = derivePergolaGroupsFromScene({
      pergolas: [
        makePergola({ id: 'pergola-1' }),
        makePergola({ id: 'pergola-2', attachment: snapToPergola('pergola-1') }),
      ],
    });
    const orderB = derivePergolaGroupsFromScene({
      pergolas: [
        makePergola({ id: 'pergola-2', attachment: snapToPergola('pergola-1') }),
        makePergola({ id: 'pergola-1' }),
      ],
    });
    expect(orderA[0]?.pergolaId).toBe('pergola-1');
    expect(orderB[0]?.pergolaId).toBe('pergola-1');
  });

  it('handles a mixed scene: snapped chain + house-attached + standalone', () => {
    const groups = derivePergolaGroupsFromScene({
      pergolas: [
        makePergola({ id: 'chain-a' }),
        makePergola({ id: 'chain-b', attachment: snapToPergola('chain-a') }),
        makePergola({ id: 'chain-c', attachment: snapToPergola('chain-b') }),
        makePergola({ id: 'house-attached', attachment: snapToHouse('house-main') }),
        makePergola({ id: 'standalone' }),
      ],
    });
    expect(groups).toHaveLength(3);
    const chainGroup = groups.find((g) => g.pergolaId === 'chain-a');
    expect(chainGroup?.modules.map((m) => m.id)).toEqual(['chain-a', 'chain-b', 'chain-c']);
    expect(groups.find((g) => g.pergolaId === 'house-attached')?.modules).toHaveLength(1);
    expect(groups.find((g) => g.pergolaId === 'standalone')?.modules).toHaveLength(1);
  });
});
