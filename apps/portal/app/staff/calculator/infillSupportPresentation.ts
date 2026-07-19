import type {
  InfillEdge,
  InfillEdgeConfirmations,
  InfillLineItem,
  InfillResolvedAcrylicSourceInput,
  InfillSupportInput,
} from '@/lib/types/calculator';

export const INFILL_EDGES: InfillEdge[] = ['top', 'bottom', 'left', 'right'];
export type InfillEdgeAnswer = 'yes' | 'no';
type InfillEdgeAnswers = Record<InfillEdge, InfillEdgeAnswer>;
export type InfillResolvedPanelOrientation = Exclude<InfillLineItem['panelOrientation'], 'auto'>;

export function makeNoEdgeConfirmations(): InfillEdgeConfirmations {
  return { top: 'no', bottom: 'no', left: 'no', right: 'no' };
}

export function inferEdgeConfirmations(support: Pick<InfillSupportInput, 'hasTop' | 'hasBottom' | 'hasLeft' | 'hasRight'>): InfillEdgeAnswers {
  return {
    top: support.hasTop ? 'yes' : 'no',
    bottom: support.hasBottom ? 'yes' : 'no',
    left: support.hasLeft ? 'yes' : 'no',
    right: support.hasRight ? 'yes' : 'no',
  };
}

function normalizeEdgeAnswer(value: unknown, fallback: InfillEdgeAnswer): InfillEdgeAnswer {
  if (value === 'yes') return 'yes';
  if (value === 'no' || value === 'unsure') return 'no';
  return fallback;
}

export function normalizeEdgeConfirmations(
  value: unknown,
  fallbackSupport: Pick<InfillSupportInput, 'hasTop' | 'hasBottom' | 'hasLeft' | 'hasRight'>,
): InfillEdgeConfirmations {
  const inferred = inferEdgeConfirmations(fallbackSupport);
  if (!value || typeof value !== 'object') return inferred;
  const candidate = value as Partial<Record<InfillEdge, unknown>>;
  return {
    top: normalizeEdgeAnswer(candidate.top, inferred.top),
    bottom: normalizeEdgeAnswer(candidate.bottom, inferred.bottom),
    left: normalizeEdgeAnswer(candidate.left, inferred.left),
    right: normalizeEdgeAnswer(candidate.right, inferred.right),
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
  confirmation: InfillEdgeAnswer,
): InfillSupportInput {
  const current = normalizeEdgeConfirmations(support.edgeConfirmations, support);
  return resolveSupportConfirmations({
    ...support,
    edgeConfirmations: { ...current, [edge]: confirmation },
  });
}

export function explicitInfillSelectionPatch(
  item: InfillLineItem,
  resolvedAcrylicSource: InfillResolvedAcrylicSourceInput,
  resolvedPanelOrientation: InfillResolvedPanelOrientation,
): Partial<InfillLineItem> | null {
  const acrylicSource = item.acrylicSource === 'auto' ? resolvedAcrylicSource : item.acrylicSource;
  const panelOrientation = item.panelOrientation === 'auto' ? resolvedPanelOrientation : item.panelOrientation;
  if (acrylicSource === item.acrylicSource && panelOrientation === item.panelOrientation) return null;
  const targetPanelWidthM = acrylicSource === 'strip_620' ? '0.64' : '1.2';
  return {
    acrylicSource,
    panelOrientation,
    ...(item.acrylicSource === 'auto' ? { targetPanelWidthM, maxPanelWidthM: targetPanelWidthM } : {}),
  };
}
