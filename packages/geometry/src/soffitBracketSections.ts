import type { ContextSection } from './representativeSurroundings';

/** Existing website 40 mm L section; callers own the actual contact datums. */
export function buildSoffitBracketSections(input: {
  startX: number; endX: number; wallY: number; backY: number;
  soffitZ: number; ledgerBottomZ: number; count: number;
}): ContextSection[] {
  const span = input.endX - input.startX - 40;
  return Array.from({ length: input.count }, (_, index) => ({
    id: `soffit-bracket-${index + 1}`,
    startX: input.startX + span * index / (input.count - 1),
    endX: input.startX + span * index / (input.count - 1) + 40,
    section: [
      { y: input.wallY, z: input.soffitZ - 40 }, { y: input.backY + 40, z: input.soffitZ - 40 },
      { y: input.backY + 40, z: input.ledgerBottomZ }, { y: input.backY, z: input.ledgerBottomZ },
      { y: input.backY, z: input.soffitZ }, { y: input.wallY, z: input.soffitZ },
    ],
  }));
}
