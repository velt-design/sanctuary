import type { EstimateDetail } from '@/lib/estimates/types';

/** Display context only. These labels never rename a design or authorise editing. */
export type StudioDesignIdentity = {
  projectName: string | null;
  internalName: string | null;
  createdAt: string | null;
  history: 'working' | 'quoted' | 'archived';
  quoteLabel: string | null;
};

export function studioDesignIdentity(estimate: Pick<EstimateDetail,'editability'|'internalName'|'createdAt'|'status'>, projectName: unknown = null): StudioDesignIdentity {
  const lock = estimate.editability;
  return {
    projectName: typeof projectName === 'string' && projectName.trim() ? projectName : null,
    internalName: estimate.internalName?.trim() ? estimate.internalName : null,
    createdAt: Number.isFinite(Date.parse(estimate.createdAt)) ? estimate.createdAt : null,
    history: lock.isLocked || lock.hasDraftQuotes || lock.draftQuoteCount > 0 ? 'quoted' : estimate.status === 'archived' ? 'archived' : 'working',
    quoteLabel: lock.lockedByQuoteRef ? `${lock.lockedByQuoteRef}${lock.lockedByQuoteVersionNumber ? ` · quote revision ${lock.lockedByQuoteVersionNumber}` : ''}` : null,
  };
}

export function studioDesignDate(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' }).format(new Date(value)) : null;
}
