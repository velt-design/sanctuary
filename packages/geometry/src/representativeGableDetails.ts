import type { Assembly3D, Point3, RoofCladdingPanel3D } from './contracts';

import { parseAssemblyMemberProfile } from './profiles';
import type { RepresentativeGableRules } from './representativeGableRules';

/** Owner-selected display detail. Dimensions are mm; no engineering/takeoff claim. */
export function addRepresentativeGableEndDetails(assembly: Assembly3D, infills: boolean, rules: RepresentativeGableRules) {
  const members = assembly.members;
  const ties = members.filter(m => m.metadata?.frameRole === 'tie_beam');
  const panels: RoofCladdingPanel3D[] = [];
  for (const tie of ties) {
    const { start, end } = tie.centerline;
    const king = members.find(m => m.metadata?.frameRole === 'king_post_strut' && m.metadata.position === tie.metadata?.position)!;
    // Top-flush L: 150 high x 50 wide upright, plus a span-sized, 50 high
    // inward flange. The upright is the front face; both tops remain flush.
    const outward = tie.metadata?.position === 'inner-end' ? -1 : 1;
    const flangeStart = { ...start, x: start.x - outward * (25 + rules.inwardTieWidth / 2), z: start.z + 50 };
    members.push({ ...tie, id: `${tie.id}-inside`, profile: { ...parseAssemblyMemberProfile(`${rules.inwardTieWidth}x50`)!, widthMm: rules.inwardTieWidth, depthMm: 50, sectionOutline: undefined, sectionVoids: undefined },
      centerline: { start: flangeStart, end: { ...end, x: flangeStart.x, z: flangeStart.z } },
      localFrame: { ...tie.localFrame, origin: flangeStart }, metadata: { ...tie.metadata, frameRole: 'tie_beam_inside' } });
    const baseZ = start.z + tie.profile.depthMm / 2;
    king.profile = parseAssemblyMemberProfile(`${rules.kingDepth}x50`)!;
    king.role = rules.kingIsPost ? 'post' : 'brace';
    king.metadata = { ...king.metadata, supportMode: rules.kingIsPost ? 'ground_post' : 'strut' };
    king.centerline.start.z = rules.kingIsPost ? 0 : baseZ;
    king.localFrame.origin = { ...king.centerline.start };
    // Quarter turn about the vertical run axis, before the whole gable rotates.
    king.localFrame.yAxis = { x: 0, y: 1, z: 0 };
    king.localFrame.zAxis = { x: -1, y: 0, z: 0 };
    if (!infills) continue;
    // Use the actual solved end-rafter underside as the infill's sloping edge.
    const endRafters = members.filter(m => m.role === 'rafter' && Math.abs(m.centerline.start.x - start.x) < 1);
    const roofZ = (y: number) => {
      const rafter = endRafters.find(m => y >= Math.min(m.centerline.start.y, m.centerline.end.y) - 1 && y <= Math.max(m.centerline.start.y, m.centerline.end.y) + 1);
      if (!rafter) return baseZ;
      const a = rafter.centerline.start, b = rafter.centerline.end;
      return a.z + (b.z - a.z) * (y - a.y) / (b.y - a.y) - rafter.profile.depthMm / (2 * Math.cos(25 * Math.PI / 180));
    };
    const ridgeY = king.centerline.start.y;
    // Clip the sheets where the rising roof clears the upright tie's top.
    // Otherwise the first bay would protrude through the end rafter near the eave.
    const roofEnds = endRafters.flatMap(m => {
      const a = m.centerline.start, b = m.centerline.end;
      const offset = m.profile.depthMm / (2 * Math.cos(25 * Math.PI / 180));
      const az = a.z - offset, bz = b.z - offset, floor = baseZ + 4;
      if (Math.max(az, bz) <= floor) return [];
      const crossing = a.y + (b.y - a.y) * (floor - az) / (bz - az);
      return [az < floor ? crossing : a.y, bz < floor ? crossing : b.y];
    });
    const lowY = Math.min(...roofEnds), highY = Math.max(...roofEnds);
    const kingHalfWidth = king.profile.widthMm / 2;
    for (const [side, a, b] of [['left', lowY, ridgeY - kingHalfWidth], ['right', ridgeY + kingHalfWidth, highY]] as const) {
      const bayCount = Math.max(1, Math.ceil((b - a) / 700));
      const centres = Array.from({ length: bayCount + 1 }, (_, i) => a + (b - a) * i / bayCount);
      for (let i = 1; i < centres.length - 1; i++) {
        const y = centres[i], z = roofZ(y);
        if (z <= baseZ) continue;
        const origin = { x: start.x, y, z: baseZ };
        members.push({ ...king, role: 'brace', id: `${tie.id}-${side}-infill-support-${i}`, centerline: { start: origin, end: { ...origin, z } },
          profile: parseAssemblyMemberProfile('50x50')!, localFrame: { ...king.localFrame, origin },
          metadata: { frameRole: 'infill_support', position: tie.metadata?.position ?? '' } });
      }
      for (let i = 0; i < centres.length - 1; i++) {
        const y1 = centres[i] + (i ? 26 : 2), y2 = centres[i + 1] - (i < centres.length - 2 ? 26 : 2);
        const z1 = Math.max(baseZ + 2, roofZ(y1) - 2), z2 = Math.max(baseZ + 2, roofZ(y2) - 2);
        const x = start.x;
        const boundary: Point3[] = [{ x, y: y1, z: baseZ + 2 }, { x, y: y2, z: baseZ + 2 }, { x, y: y2, z: z2 }, { x, y: y1, z: z1 }];
        panels.push({ id: `${tie.id}-${side}-infill-${i}`, material: 'acrylic', thicknessMm: 4, boundary,
          plane: { origin: boundary[0], normal: { x: 1, y: 0, z: 0 }, xAxis: { x: 0, y: 1, z: 0 }, yAxis: { x: 0, y: 0, z: 1 } }, metadata: { representativeGableInfill: true } });
      }
    }
  }
  assembly.roofCladdingPanels.push(...panels);
}
