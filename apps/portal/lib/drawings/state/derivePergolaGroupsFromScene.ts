import type { PergolaObjectModel } from './objectFirstWorkbenchModel';

/**
 * A logical pergola — one or more `PergolaObjectModel` members connected via
 * scene-snapped attachments. PR-2B.2 (2026-05-22): logical-pergola grouping
 * comes from spatial adjacency in the scene, not from a stored field.
 *
 * Per the Phase 2 cost direction (north star locked 2026-05-22):
 * "pergolas which are connected to each other / snapped to each other will
 * be costed as members of the same pergola; pergolas not connected together
 * will be costed as separate pergolas. All of this is derived information
 * from the scene."
 *
 * Two pergolas are in the same group iff they're reachable through the
 * snap-graph (`PergolaAttachment.host.objectFamily === 'pergolas'`). The
 * relationship is treated as undirected — A snapped to B and B snapped to A
 * are equivalent, since spatial adjacency is mutual.
 */
type PergolaGroup = {
  /**
   * Stable id for the logical pergola: the lexicographically smallest member
   * id in the connected component. Deterministic across runs given the same
   * input set; downstream consumers (cost engine, UI) can rely on this id
   * staying the same as long as the connected component composition does.
   */
  pergolaId: string;
  /** All pergola objects in this connected component, ordered by id. */
  members: readonly PergolaObjectModel[];
};

/**
 * Group pergolas by snap-derived spatial adjacency. Pure function — same
 * input always produces the same output. Stable id ordering: groups are
 * returned in lexicographic order by `pergolaId`, and members within each
 * group are ordered by their own id.
 *
 * Snap references that point to pergolas not present in the input set
 * (orphaned references) are ignored — the dangling pergola keeps its own
 * group rather than dropping out of the result.
 */
export function derivePergolaGroupsFromScene(input: {
  pergolas: readonly PergolaObjectModel[];
}): readonly PergolaGroup[] {
  const { pergolas } = input;
  if (pergolas.length === 0) return [];

  // Union-find with path compression; lexicographically smaller id is the
  // canonical root in any merged set so the group's pergolaId is stable.
  const parent = new Map<string, string>();
  for (const pergola of pergolas) {
    parent.set(pergola.id, pergola.id);
  }

  function find(id: string): string {
    let root = id;
    let next = parent.get(root);
    while (next !== undefined && next !== root) {
      root = next;
      next = parent.get(root);
    }
    // Path compression: relink every node along the lookup to the root.
    let current = id;
    while (parent.get(current) !== root) {
      const link = parent.get(current);
      if (link === undefined) break;
      parent.set(current, root);
      current = link;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;
    if (rootA < rootB) {
      parent.set(rootB, rootA);
    } else {
      parent.set(rootA, rootB);
    }
  }

  const pergolaIds = new Set(pergolas.map((pergola) => pergola.id));
  for (const pergola of pergolas) {
    const host = pergola.attachment?.host;
    if (!host) continue;
    if (host.objectFamily !== 'pergolas') continue;
    if (!pergolaIds.has(host.objectId)) continue;
    union(pergola.id, host.objectId);
  }

  const groups = new Map<string, PergolaObjectModel[]>();
  for (const pergola of pergolas) {
    const root = find(pergola.id);
    const existing = groups.get(root);
    if (existing) {
      existing.push(pergola);
    } else {
      groups.set(root, [pergola]);
    }
  }

  const result: PergolaGroup[] = Array.from(groups.entries()).map(([pergolaId, members]) => ({
    pergolaId,
    members: [...members].sort((a, b) => a.id.localeCompare(b.id)),
  }));
  result.sort((a, b) => a.pergolaId.localeCompare(b.pergolaId));
  return result;
}
