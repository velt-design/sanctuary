import { parseAssemblyMemberProfile } from './profiles';

/** Dimensions for the owner-approved marketing concept, not an engineering solve. */
export function representativeBoxRules(widthMm: number, projectionMm: number) {
  if (![widthMm, projectionMm].every(v => Number.isFinite(v) && v >= 1500)
    || widthMm > 10000 || projectionMm > 6000) throw new Error('Invalid box dimensions');
  const bottomZ = 2400, perimeterDepth = 300, gutterDepth = 100;
  const joinerDepth = parseAssemblyMemberProfile('sp_joiners')!.depthMm;
  // Reserve joiner height and clearance below the level perimeter top.
  const peakZ = bottomZ + perimeterDepth - joinerDepth - 8;
  const eaveZ = bottomZ + gutterDepth;
  const fall = peakZ - eaveZ;
  const pitchedRun = projectionMm - 200; // Rear perimeter face to front gutter's inside face.
  const pitchedPitch = Math.atan(fall / pitchedRun) * 180 / Math.PI;
  const roofMode = pitchedPitch < 3 - 1e-9 ? 'gable' : 'pitched';
  const run = roofMode === 'gable' ? (projectionMm - 300) / 2 : pitchedRun;
  const pitchDeg = Math.atan(fall / run) * 180 / Math.PI;
  if (pitchDeg < 3 - 1e-9) throw new Error('Box roof needs more fall');
  return { bottomZ, topZ: bottomZ + perimeterDepth, peakZ, eaveZ, fall, pitchDeg, roofMode,
    postSize: 150,
    ridgeProfile: widthMm - 100 <= 3000 ? '100x50' : '150x50',
    rafterCount: Math.ceil((widthMm - 150) / 600) + 1,
    postCount: Math.ceil(widthMm / 4000) + 1 } as const;
}
export type RepresentativeBoxRules = ReturnType<typeof representativeBoxRules>;
