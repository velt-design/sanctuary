import type { Assembly3D, AssemblyMember3D } from './contracts';
import { buildRepresentativeSurroundings, type ContextSection } from './representativeSurroundings';
import { buildRepresentativeHouseDetails } from './representativeHouseDetails';
import type { RepresentativeGableOptions } from './representativeGable';

/** House/ground display context follows the selected attachment, not a house authoring model. */
export function buildRepresentativeGableContext(assembly: Assembly3D, options: RepresentativeGableOptions & { elevated: boolean; soffitBracketCount: number }) {
  const away = options.orientation === 'away';
  const eaveBeam = assembly.members.find(m => m.id === 'house-beam')!;
  const topZ = eaveBeam.centerline.start.z + eaveBeam.profile.depthMm / 2;
  // A context-only attachment datum lets the existing landscape/terrace builder
  // serve both orientations. It is never added to the product assembly.
  const origin = { x: 0, y: away ? 45 : eaveBeam.centerline.start.y, z: topZ - 75 };
  const reference: AssemblyMember3D = { ...eaveBeam, role: 'ledger', profile: { ...eaveBeam.profile, widthMm: 50, depthMm: 150 },
    centerline: { start: origin, end: { ...origin, x: options.widthMm } },
    localFrame: { origin, xAxis: { x: 1, y: 0, z: 0 }, yAxis: { x: 0, y: 1, z: 0 }, zAxis: { x: 0, y: 0, z: 1 } } };
  const context = buildRepresentativeSurroundings({ ...assembly, members: [reference, ...assembly.members.filter(m => m.role !== 'ledger')] },
    { connection: away ? 'fascia' : options.connection, elevated: options.elevated, soffitBracketCount: options.soffitBracketCount });
  if (!context) return context;
  if (!away) {
    // The gable carries its own gutter behind the ledger. Leave room for that
    // gutter beside the house eave; the bracket upright still meets the actual
    // ledger underside and its horizontal arm reaches back to the house.
    const clearance = 105;
    context.wall.min.y -= clearance; context.wall.max.y -= clearance;
    context.fascia.min.y -= clearance; context.fascia.max.y -= clearance;
    context.patio.min.y -= clearance; context.ground.min.y -= clearance;
    for (const shape of [context.roof, context.roofEnclosure, context.gutter])
      shape.section = shape.section.map(p => ({ ...p, y: p.y - clearance }));
    for (const bracket of context.brackets) {
      bracket.section[0].y -= clearance;
      bracket.section[bracket.section.length - 1].y -= clearance;
    }
    context.architecture = buildRepresentativeHouseDetails(context.wall, context.patio, options.elevated, context.postFeet);
    return context;
  }
  const roofPoints = assembly.roofPlanes.flatMap(p => p.boundary);
  const peak = Math.max(...roofPoints.map(p => p.z)) + 35;
  const centre = options.widthMm / 2;
  const left = context.wall.min.x, right = context.wall.max.x;
  const eave = peak - (centre - left) * Math.tan(25 * Math.PI / 180);
  const back = context.wall.min.y, face = -25;
  // For a Y extrusion, section.y is the horizontal X coordinate. Closed
  // end faces show the Dutch-gable fascia the rafters and ridge connect into.
  const section = (id: string, points: { y: number; z: number }[], start = back, end = face): ContextSection =>
    ({ id, extrusionAxis: 'y', startX: start, endX: end, section: points });
  context.roof = section('dutch-gable-roof', [
    { y: left, z: eave }, { y: centre, z: peak }, { y: right, z: eave },
    { y: right, z: eave + 45 }, { y: centre, z: peak + 45 }, { y: left, z: eave + 45 },
  ]);
  context.roofEnclosure = section('dutch-gable-roof-enclosure', [
    { y: left, z: eave - 180 }, { y: right, z: eave - 180 }, { y: right, z: eave }, { y: centre, z: peak }, { y: left, z: eave },
  ]);
  context.gutter = section('dutch-gable-fascia', [
    { y: left, z: eave - 160 }, { y: centre, z: peak - 160 }, { y: right, z: eave - 160 },
    { y: right, z: eave + 5 }, { y: centre, z: peak + 5 }, { y: left, z: eave + 5 },
  ], face, face + 25);
  context.wall.max.z = eave - 180;
  context.architecture = buildRepresentativeHouseDetails(context.wall, context.patio, options.elevated, context.postFeet);
  return context;
}
