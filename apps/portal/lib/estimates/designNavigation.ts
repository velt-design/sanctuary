import type { EstimateMeta } from './types';

export function hasEstimateDesignKind(estimate: Pick<EstimateMeta, 'designKind'>): boolean {
  return estimate.designKind === 'calculator' || estimate.designKind === 'studio';
}

/** Routing ownership only. Invalid or unsupported Studio data must still reach Studio's recovery boundary. */
export function estimateDesignKind(outputs: unknown): 'calculator' | 'studio' {
  return outputs !== null && typeof outputs === 'object' && !Array.isArray(outputs)
    && Object.hasOwn(outputs, 'studio_authored') ? 'studio' : 'calculator';
}

export function studioEstimateHref(
  estimate: Pick<EstimateMeta, 'id' | 'projectId' | 'designKind'> | null | undefined,
  intent: 'design' | 'revision' | 'duplicate' = 'design',
): string | null {
  if (estimate?.designKind !== 'studio') return null;
  const root = `/staff/design-studio/${encodeURIComponent(estimate.projectId)}/${encodeURIComponent(estimate.id)}`;
  return intent === 'design' ? `${root}/edit` : `${root}/edit?intent=${intent}`;
}
