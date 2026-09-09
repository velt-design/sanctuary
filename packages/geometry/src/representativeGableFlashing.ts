import type { Assembly3D } from './contracts';
import { resolveAssemblyMemberProfileAnchors } from './profiles';

/** Keep a single fold, with its underside 2mm clear of the actual joiner tops. */
export function sizeRepresentativeGableFlashing(assembly: Assembly3D, wingLengthMm: number) {
  const ridge = assembly.members.find(member => member.role === 'ridge')!;
  for (const flashing of assembly.roofFlashings ?? []) {
    const ratio = wingLengthMm / Number(flashing.metadata?.wingLengthMm ?? 150);
    for (const wing of flashing.wings) {
      const apex = wing.boundary.find(point => Math.abs(point.y - ridge.centerline.start.y) < .001)!;
      wing.boundary = wing.boundary.map(point => ({ ...point,
        y: apex.y + (point.y - apex.y) * ratio, z: apex.z + (point.z - apex.z) * ratio }));
    }
    // Raise both wings together so their ridge edge stays shared. Equal gable
    // pitches and joiner profiles give the same required lift on each side.
    const lift = Math.max(...flashing.wings.map(wing => {
      const sign = wing.plane.normal.z < 0 ? -1 : 1;
      const n = { x: wing.plane.normal.x * sign, y: wing.plane.normal.y * sign, z: wing.plane.normal.z * sign };
      const dot = (p: { x: number; y: number; z: number }) => p.x*n.x + p.y*n.y + p.z*n.z;
      const joiners = assembly.members.filter(m => m.role === 'joiner' && dot(m.localFrame.zAxis) > .999);
      const top = Math.max(...joiners.map(m => dot(m.centerline.start) + resolveAssemblyMemberProfileAnchors(m.profile).topsideZ));
      return (top + 2 + flashing.thicknessMm / 2 - dot(wing.boundary[0])) / n.z;
    }));
    for (const wing of flashing.wings) {
      wing.boundary = wing.boundary.map(point => ({ ...point, z: point.z + lift }));
      wing.plane = { ...wing.plane, origin: { ...wing.plane.origin, z: wing.plane.origin.z + lift } };
    }
    flashing.metadata = { ...flashing.metadata, representativeGableRidge: true, wingLengthMm, girthMm: wingLengthMm * 2,
      joinerClearanceMm: 2, surfaceOffsetMm: flashing.wings[0].boundary[0].z - ridge.centerline.start.z - ridge.profile.depthMm / 2 };
  }
}
