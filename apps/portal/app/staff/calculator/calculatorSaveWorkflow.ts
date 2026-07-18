import type { EstimateSaveMode } from '@/lib/estimates/costingPayload';
import type { EstimateMeta } from '@/lib/estimates/types';
import type { DesignRequestPriorityTier } from '@/lib/designPackages/types';

type EstimateMetaTarget = Pick<EstimateMeta, 'id' | 'isActiveDraft'>;

export function resolveCalculatorSaveMode({
  requestedSaveMode,
  isEditingDesign,
}: {
  requestedSaveMode?: EstimateSaveMode;
  isEditingDesign: boolean;
}): EstimateSaveMode {
  return requestedSaveMode ?? (isEditingDesign ? 'preserve_current' : 'reprice_latest');
}

export function calculatorSaveActionLabel(saveMode: EstimateSaveMode): 'repricing' | 'saving' {
  return saveMode === 'reprice_latest' ? 'repricing' : 'saving';
}

export function designRequestTierFromTotal(totalIncGst: number | null | undefined): DesignRequestPriorityTier {
  if (typeof totalIncGst !== 'number' || !Number.isFinite(totalIncGst)) return 'UNPRICED';
  if (totalIncGst < 12_000) return 'TIER_4';
  if (totalIncGst < 24_000) return 'TIER_3';
  if (totalIncGst < 48_000) return 'TIER_2';
  return 'TIER_1';
}

export function formatDesignRequestTierLabel(value: DesignRequestPriorityTier): string {
  if (value === 'UNPRICED') return 'Unpriced';
  const suffix = value.split('_').at(-1) ?? '';
  return `Tier ${suffix}`;
}

export function getCalculatorSaveInitialError({
  projectId,
  hasProject,
  saveMode,
  hasCalculatedResult,
}: {
  projectId: string;
  hasProject: boolean;
  saveMode: EstimateSaveMode;
  hasCalculatedResult: boolean;
}): string | null {
  if (!projectId) return 'Select a project first.';
  if (!hasProject) return 'Project not found.';
  if (saveMode === 'reprice_latest' && !hasCalculatedResult) return 'No calculated result yet.';
  return null;
}

export function getCalculatorSaveBlockerError({
  saveMode,
  hasStatusBlockers,
  criticalWarningCount,
}: {
  saveMode: EstimateSaveMode;
  hasStatusBlockers: boolean;
  criticalWarningCount: number;
}): string | null {
  const actionLabel = calculatorSaveActionLabel(saveMode);
  if (hasStatusBlockers) return `Resolve blockers in Quote Status before ${actionLabel}.`;
  if (criticalWarningCount > 0) {
    return `Resolve critical warnings before ${actionLabel}.`;
  }
  return null;
}

export function resolveCalculatorEstimateTarget({
  activeEditEstimateId,
  activeDraftEstimateMetaId,
  estimateMetas,
  resolveEstimateId,
}: {
  activeEditEstimateId: string;
  activeDraftEstimateMetaId?: string | null;
  estimateMetas: EstimateMetaTarget[];
  resolveEstimateId: (estimateId: string) => string | null | undefined;
}): {
  activeDraftEstimateId: string;
  estimateIdToUpdate: string;
  canonicalEditEstimateId: string | null;
} {
  const activeDraftEstimateId = estimateMetas.find((estimate) => estimate.isActiveDraft)?.id ?? activeDraftEstimateMetaId ?? '';
  const estimateIdToUpdate = activeEditEstimateId || activeDraftEstimateId;
  const resolvedEditEstimateId = estimateIdToUpdate ? resolveEstimateId(estimateIdToUpdate) : null;
  return {
    activeDraftEstimateId,
    estimateIdToUpdate,
    canonicalEditEstimateId: resolvedEditEstimateId || estimateIdToUpdate || null,
  };
}

export function getCalculatorProjectSnapshotError({
  hasContact,
  projectNameSnapshot,
}: {
  hasContact: boolean;
  projectNameSnapshot: string | null | undefined;
}): string | null {
  if (!hasContact) return 'Project is missing a contact (open the project and select/create one).';
  if (!String(projectNameSnapshot ?? '').trim()) return 'Project name is missing.';
  return null;
}

export function buildCalculatorEstimateHandoffRoutes(projectId: string, estimateId: string): {
  project: string;
  quote: string;
} {
  const projectRoute = `/staff/projects/${encodeURIComponent(projectId)}`;
  const encodedEstimateId = encodeURIComponent(estimateId);
  return {
    project: `${projectRoute}?tab=estimates&estimateId=${encodedEstimateId}`,
    quote: `${projectRoute}?tab=quotes&createFromEstimateId=${encodedEstimateId}`,
  };
}
