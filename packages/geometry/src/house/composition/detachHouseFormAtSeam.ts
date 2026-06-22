import type {
  CompositionJoin,
  CompositionPrimitive,
  HouseComposition,
} from "./types";

/**
 * PR-COMP-PHASE4a (2026-06-18): pure function that splits a
 * composition by removing a single join (seam). Returns one
 * `HouseComposition` per connected component of the remaining
 * adjacency graph.
 *
 * The user-facing model: a composite house form has N internal
 * seams (one per join). Each seam carries a small icon in the
 * workbench (PR-COMP-PHASE4b ships the icon); clicking the icon
 * detaches the composite at that seam. For a 2-primitive composite
 * with 1 join, detaching that join returns 2 single-primitive
 * compositions. For a 3-primitive linear composite with 2 joins
 * (A-B-C), detaching the A-B join returns [A] and [B, C]; detaching
 * the B-C join returns [A, B] and [C]; detaching nothing keeps the
 * composite intact.
 *
 * This function does NOT translate primitive positions or alter
 * roof intent. The constituent rectangles keep their world-space
 * coordinates (`originXMm`, `originYMm`) and their per-rectangle
 * roof intent. The workbench wraps the partitions into separate
 * `HouseFormModel` instances in PR-COMP-PHASE4b; this function
 * stays purely geometric.
 *
 * Returns `{ ok: true, partitions }` on success. The partitions
 * are returned in the order their primitives first appear in the
 * input composition (so partition 0 always contains
 * `composition.primitives[0]`). Returns a typed error on:
 *   - `invalid_join_index`: joinIndex is out of bounds.
 *   - `composition_disconnects_into_more_than_two`: reserved for a
 *     future invariant where one seam removal might disconnect more
 *     than two components (impossible in v1's 2- and 3-primitive
 *     composites; the type leaves room without breaking callers).
 *
 * The error union is closed; callers MUST exhaust both arms.
 */
type DetachHouseFormError =
  | { code: "invalid_join_index"; joinIndex: number; joinsLength: number }
  | { code: "composition_disconnects_into_more_than_two"; partitionsCount: number };

type DetachHouseFormResult =
  | { ok: true; partitions: HouseComposition[] }
  | { ok: false; error: DetachHouseFormError };

export function detachHouseFormAtSeam(input: {
  composition: HouseComposition;
  joinIndex: number;
}): DetachHouseFormResult {
  const { composition, joinIndex } = input;

  if (joinIndex < 0 || joinIndex >= composition.joins.length) {
    return {
      ok: false,
      error: {
        code: "invalid_join_index",
        joinIndex,
        joinsLength: composition.joins.length,
      },
    };
  }

  // Adjacency graph: primitive index -> set of primitive indices it
  // joins to. We rebuild this AFTER removing the seam being broken;
  // the join at `joinIndex` is excluded from the graph so BFS sees
  // the post-detach connectivity.
  const remainingJoins = composition.joins.filter((_, idx) => idx !== joinIndex);
  const adjacency = new Map<number, Set<number>>();
  for (let i = 0; i < composition.primitives.length; i += 1) {
    adjacency.set(i, new Set());
  }
  for (const join of remainingJoins) {
    adjacency.get(join.fromPrimitiveIndex)!.add(join.toPrimitiveIndex);
    adjacency.get(join.toPrimitiveIndex)!.add(join.fromPrimitiveIndex);
  }

  // BFS each unvisited node to find connected components. The
  // primitive indices in each component are in the order we visit
  // them (BFS order from the lowest-index seed), but we sort them
  // ascending so the partition's primitive ordering matches the
  // original composition's ordering wherever possible — keeps roof
  // intent debugging legible.
  const visited = new Set<number>();
  const components: number[][] = [];
  for (let seed = 0; seed < composition.primitives.length; seed += 1) {
    if (visited.has(seed)) continue;
    const queue: number[] = [seed];
    const component: number[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);
      component.push(node);
      for (const neighbour of adjacency.get(node)!) {
        if (!visited.has(neighbour)) queue.push(neighbour);
      }
    }
    component.sort((a, b) => a - b);
    components.push(component);
  }

  // v1 invariant: removing one seam from a structurally-valid
  // composition produces exactly 2 partitions (the seam was a
  // single edge in a tree-like graph). 1 partition means the seam
  // removal didn't actually disconnect anything (a cycle exists);
  // >2 means multiple seams shared an index. Both are reserved for
  // future N-primitive composites with non-tree topology — v1
  // composites are trees by construction.
  if (components.length > 2) {
    return {
      ok: false,
      error: {
        code: "composition_disconnects_into_more_than_two",
        partitionsCount: components.length,
      },
    };
  }

  const partitions: HouseComposition[] = components.map((component) =>
    buildPartition(composition, component, remainingJoins),
  );

  return { ok: true, partitions };
}

/**
 * Build a `HouseComposition` from a subset of the original
 * composition's primitives + joins. The partition's primitives are
 * the ones whose original indices are in `componentIndices`; the
 * partition's joins are the subset of `remainingJoins` whose both
 * endpoints fall inside the component, RENUMBERED to point at the
 * partition's primitive array (not the original composition's).
 *
 * The renumbering is the trickiest part: a join referencing original
 * primitive 2 + 5, in a partition containing original primitives
 * `[2, 4, 5]`, must be rewritten as a join referencing partition
 * primitives 0 + 2. We build an old->new index map from
 * `componentIndices` and translate.
 */
function buildPartition(
  composition: HouseComposition,
  componentIndices: number[],
  remainingJoins: CompositionJoin[],
): HouseComposition {
  const oldToNewIndex = new Map<number, number>();
  componentIndices.forEach((originalIndex, newIndex) => {
    oldToNewIndex.set(originalIndex, newIndex);
  });

  const primitives: CompositionPrimitive[] = componentIndices.map(
    (originalIndex) => composition.primitives[originalIndex]!,
  );

  const componentSet = new Set(componentIndices);
  const joins: CompositionJoin[] = remainingJoins
    .filter(
      (join) =>
        componentSet.has(join.fromPrimitiveIndex) &&
        componentSet.has(join.toPrimitiveIndex),
    )
    .map((join) => ({
      fromPrimitiveIndex: oldToNewIndex.get(join.fromPrimitiveIndex)!,
      fromEdge: join.fromEdge,
      toPrimitiveIndex: oldToNewIndex.get(join.toPrimitiveIndex)!,
      toEdge: join.toEdge,
    }));

  return { primitives, joins };
}
