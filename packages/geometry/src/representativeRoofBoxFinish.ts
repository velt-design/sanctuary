import type { Assembly3D } from './contracts';
import { boxGutterProfile, boxMember } from './representativeBoxMembers';
import { representativeRoofProfile } from './representativeRoofProfiles';
import type { RepresentativeRoofFinish } from './representativeRoofFinishTypes';

function boxRoofEnvelope(finish: RepresentativeRoofFinish) {
  const eaveOffset = 175;
  const peakOffset = 300 - representativeRoofProfile(finish.profile, finish.trayWidth).height - 8;
  return { eaveOffset, peakOffset, maxProjection: 300 + 2 * (peakOffset - eaveOffset) / Math.tan(3 * Math.PI / 180) };
}

/** Largest 100mm slider step within the envelope used by the builder. */
export function representativeBoxRoofMaxProjection(finish: RepresentativeRoofFinish) {
  return Math.floor(boxRoofEnvelope(finish).maxProjection / 100) * 100;
}

/** Fit a level ceiling and the representative roof layers inside the 300mm box.
 * Retains the preview's 3-degree layout rule; not a manufacturer suitability check. */
export function prepareBoxRoofFinish(assembly: Assembly3D, finish: RepresentativeRoofFinish, projection: number) {
  const perimeter = assembly.members.find(m => m.role === 'ledger')!;
  const bottom = perimeter.centerline.start.z - 150;
  const envelope = boxRoofEnvelope(finish);
  const eave = bottom + envelope.eaveOffset;
  const peak = bottom + envelope.peakOffset;
  const run = projection - 200;
  const gable = Math.atan((peak - eave) / run) * 180 / Math.PI < 3;
  if (projection > envelope.maxProjection)
    throw new Error('This solid box roof needs a deeper perimeter. Reduce the projection or choose acrylic.');
  const original = assembly.roofPlanes;
  const template = original[0];
  const x1 = Math.min(...template.boundary.map(p => p.x)), x2 = Math.max(...template.boundary.map(p => p.x));
  const slopes = gable ? [[projection / 2, peak, 150, eave], [projection / 2, peak, projection - 150, eave]] : [[50, peak, projection - 150, eave]];
  assembly.roofPlanes = slopes.map(([a, z1, b, z2], i) => {
    const length = Math.hypot(b - a, z2 - z1), direction = Math.sign(b - a);
    const fall = { x: 0, y: (b - a) / length, z: (z2 - z1) / length };
    const normal = { x: 0, y: -(z2 - z1) / length * direction, z: Math.abs(b - a) / length };
    const boundary = [{ x: x1, y: a, z: z1 }, { x: x2, y: a, z: z1 }, { x: x2, y: b, z: z2 }, { x: x1, y: b, z: z2 }];
    return { id: `solid-box-roof-${i}`, boundary, fallVector: fall, plane: { origin: boundary[0], xAxis: { x: 1, y: 0, z: 0 }, yAxis: fall, normal }, metadata: { roofMode: gable ? 'gable' : 'pitched' } };
  });
  // Source ridge and cap belong to the old slope. Rebuild these below at the new datum.
  assembly.members = assembly.members.filter(m => m.role !== 'ridge' && m.role !== 'gutter');
  for (const y of gable ? [100, projection - 100] : [projection - 100])
    assembly.members.push(boxMember(`solid-box-gutter-${y}`, 'gutter', { x: 50, y, z: bottom + 50 },
      { x: x2, y, z: bottom + 50 }, boxGutterProfile()));
  assembly.roofFlashings = [];
  return { ceilingZ: bottom, peak, gable };
}
