import type { Point3 } from './contracts';
import type { ContextBox } from './representativeSurroundings';
import { buildReferenceTree } from './referenceTree';

const specimen = buildReferenceTree();
const companion = buildReferenceTree('spreading');

export type RepresentativeTree = {
  position: Point3;
  heightMm: number;
  radiusMm: number;
  specimen: ReturnType<typeof buildReferenceTree>;
};

/** Decorative reference only: foliage envelopes stay clear of the patio. */
export function buildRepresentativeLandscape(patio: ContextBox, groundZ: number): RepresentativeTree[] {
  return [{ position: { x: patio.min.x - 1280, y: patio.min.y + 1400, z: groundZ },
    heightMm: 3200, radiusMm: 1250, specimen },
  { position: { x: patio.max.x + 1100, y: patio.min.y + 1700, z: groundZ },
    heightMm: 2300, radiusMm: 1100, specimen: companion }];
}
