import type {
  InfillEdge,
  InfillEdgeConfirmation,
  InfillEdgeConfirmations,
  InfillSupportInput,
} from '@/lib/types/calculator';

export const INFILL_EDGES: InfillEdge[] = ['top', 'bottom', 'left', 'right'];

export function makeUnsureEdgeConfirmations(): InfillEdgeConfirmations {
  return { top: 'unsure', bottom: 'unsure', left: 'unsure', right: 'unsure' };
}

export function inferEdgeConfirmations(support: Pick<InfillSupportInput, 'hasTop' | 'hasBottom' | 'hasLeft' | 'hasRight'>): InfillEdgeConfirmations {
  return {
    top: support.hasTop ? 'yes' : 'no',
    bottom: support.hasBottom ? 'yes' : 'no',
    left: support.hasLeft ? 'yes' : 'no',
    right: support.hasRight ? 'yes' : 'no',
  };
}

function isEdgeConfirmation(value: unknown): value is InfillEdgeConfirmation {
  return value === 'yes' || value === 'no' || value === 'unsure';
}

export function normalizeEdgeConfirmations(
  value: unknown,
  fallbackSupport: Pick<InfillSupportInput, 'hasTop' | 'hasBottom' | 'hasLeft' | 'hasRight'>,
): InfillEdgeConfirmations {
  const inferred = inferEdgeConfirmations(fallbackSupport);
  if (!value || typeof value !== 'object') return inferred;
  const candidate = value as Partial<Record<InfillEdge, unknown>>;
  return {
    top: isEdgeConfirmation(candidate.top) ? candidate.top : inferred.top,
    bottom: isEdgeConfirmation(candidate.bottom) ? candidate.bottom : inferred.bottom,
    left: isEdgeConfirmation(candidate.left) ? candidate.left : inferred.left,
    right: isEdgeConfirmation(candidate.right) ? candidate.right : inferred.right,
  };
}

export function resolveSupportConfirmations(support: InfillSupportInput): InfillSupportInput {
  const edgeConfirmations = normalizeEdgeConfirmations(support.edgeConfirmations, support);
  return {
    ...support,
    edgeConfirmations,
    hasTop: edgeConfirmations.top === 'yes',
    hasBottom: edgeConfirmations.bottom === 'yes',
    hasLeft: edgeConfirmations.left === 'yes',
    hasRight: edgeConfirmations.right === 'yes',
  };
}

export function updateEdgeConfirmation(
  support: InfillSupportInput,
  edge: InfillEdge,
  confirmation: InfillEdgeConfirmation,
): InfillSupportInput {
  const current = normalizeEdgeConfirmations(support.edgeConfirmations, support);
  return resolveSupportConfirmations({
    ...support,
    edgeConfirmations: { ...current, [edge]: confirmation },
  });
}

export function getUnsureEdges(support: InfillSupportInput, edges: InfillEdge[] = INFILL_EDGES): InfillEdge[] {
  const resolved = normalizeEdgeConfirmations(support.edgeConfirmations, support);
  return edges.filter((edge) => resolved[edge] === 'unsure');
}

export function supportConfirmationSummary(support: InfillSupportInput, edges: InfillEdge[] = INFILL_EDGES): string | null {
  const unsureEdges = getUnsureEdges(support, edges);
  if (!unsureEdges.length) return null;
  const labels = unsureEdges.map((edge) => edge[0].toUpperCase() + edge.slice(1));
  const edgeList = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
  return `${edgeList} ${unsureEdges.length === 1 ? 'edge was' : 'edges were'} not confirmed, so a new support is included.`;
}
