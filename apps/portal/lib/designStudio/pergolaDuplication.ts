import type { StudioJsonObject } from './contracts';

export type StudioDuplicateRows = { flashings: Record<string, string | null>; infills: Record<string, string | null> };
/** Safe snapshot at duplication time. Row maps run target ID -> private baseline ID. */
export type StudioPergolaDuplication = { targetId: string; sourceId: string | null; values: StudioJsonObject; rowOrigins: StudioDuplicateRows };
export const duplicateCollections = [['flashings', 'rows'], ['infills', 'items']] as const;
