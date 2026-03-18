import type { DesignPackageDesignerLookup } from './types';

export const DESIGN_PACKAGE_DESIGNERS = [
  { id: '11111111-1111-4111-8111-111111111111', code: 'JR', name: 'Joe' },
  { id: '22222222-2222-4222-8222-222222222222', code: 'JB', name: 'Jordan' },
] as const;

const DESIGN_PACKAGE_DESIGNERS_BY_ID = new Map<string, (typeof DESIGN_PACKAGE_DESIGNERS)[number]>(
  DESIGN_PACKAGE_DESIGNERS.map((designer) => [designer.id, designer] as const),
);

export function isKnownDesignPackageDesignerId(value: string | null | undefined): value is (typeof DESIGN_PACKAGE_DESIGNERS)[number]['id'] {
  return typeof value === 'string' && DESIGN_PACKAGE_DESIGNERS_BY_ID.has(value);
}

export function getDesignPackageDesignerLabel(designerId: string | null | undefined): string {
  if (typeof designerId !== 'string' || !designerId.trim()) return '';
  const normalized = designerId.trim();
  const known = DESIGN_PACKAGE_DESIGNERS_BY_ID.get(normalized);
  if (known) return known.code;
  return `Designer ${normalized.slice(0, 8)}`;
}

export function buildDesignPackageDesignerLookups(designerIds: Iterable<string | null | undefined>): DesignPackageDesignerLookup[] {
  const lookups: DesignPackageDesignerLookup[] = DESIGN_PACKAGE_DESIGNERS.map((designer) => ({
    id: designer.id,
    label: designer.code,
  }));
  const seen = new Set(lookups.map((lookup) => lookup.id));

  for (const rawId of designerIds) {
    const designerId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!designerId || seen.has(designerId)) continue;
    seen.add(designerId);
    lookups.push({
      id: designerId,
      label: getDesignPackageDesignerLabel(designerId),
    });
  }

  return lookups;
}
