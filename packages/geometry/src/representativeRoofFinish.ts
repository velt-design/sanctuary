import { prepareBoxRoofFinish } from "./representativeRoofBoxFinish";
import { addRoofEdgeFlashings } from './representativeRoofEdgeFlashings';
import type { Assembly3D, RoofCladdingPanel3D } from './contracts';
import { boxMember } from './representativeBoxMembers';
import { buildPlanViewModel } from './plan';
import { buildViewerSceneModel } from './viewer';
import { parseAssemblyMemberProfile } from './profiles';
import { representativeRoofProfile } from './representativeRoofProfiles';
import { roofFinishBayLimit, type RepresentativeRoofFinish, type RoofFinishGeometry } from './representativeRoofFinishTypes';
import { addProfiledRoof, roofCoordinates, roofMesh, roofQuad, roofRectangleBoundary, roofSlab, type RoofRectangle } from './representativeRoofFinishMesh';

/** Marketing-only roof build-up, applied before both view derivations. Never a takeoff. */
export function buildRepresentativeRoofFinish(source: Assembly3D, finish: RepresentativeRoofFinish,
  options: { widthMm: number; projectionMm: number; family: string; orientation: string }) {
  if (finish.layout === 'house' && !(options.family === 'gable' && options.orientation === 'away')) throw new Error('House-side skylights require an away-running gable');
  const assembly = structuredClone(source);
  const box = options.family === 'box' ? prepareBoxRoofFinish(assembly, finish, options.projectionMm) : null;
  if (box?.gable) assembly.members.push(boxMember('solid-box-ridge', 'ridge', { x: 50, y: options.projectionMm / 2, z: box.peak - (options.widthMm > 3100 ? 75 : 50) }, { x: options.widthMm - 50, y: options.projectionMm / 2, z: box.peak - (options.widthMm > 3100 ? 75 : 50) }, options.widthMm > 3100 ? '150x50' : '100x50'));
  const maxAcrylicBays = roofFinishBayLimit(options.widthMm, options.projectionMm, options.family, options.orientation);
  const bays = Math.min(maxAcrylicBays, Math.max(1, finish.acrylicBays));
  const covering: RoofFinishGeometry = { meshes: [], regions: [], acrylicBays: bays, maxAcrylicBays };
  const acrylic: RoofCladdingPanel3D[] = assembly.roofCladdingPanels.filter(p => p.metadata?.representativeGableInfill);
  assembly.members = assembly.members.filter(m => m.role !== 'rafter' && m.role !== 'joiner');
  const profileHeight = representativeRoofProfile(finish.profile, finish.trayWidth).height;
  const joiner = parseAssemblyMemberProfile('sp_joiners')!;
  for (const [index, roof] of assembly.roofPlanes.entries()) {
    const frame = roofCoordinates(roof);
    const { lo, hi, near, far, point, n } = frame;
    const start = lo, end = hi;
    const bandWidth = Math.min(bays * 620, (end - start) - 200);
    const bandStart = finish.layout === 'house' ? start : (start + end - bandWidth) / 2;
    const bandEnd = bandStart + bandWidth;
    const whole: RoofRectangle = { a: lo, b: hi, c: near, d: far };
    const light: RoofRectangle = { ...whole, a: bandStart, b: bandEnd };
    const solid: RoofRectangle[] = finish.material === 'solid' ? [whole] : [{ ...whole, b: bandStart }, { ...whole, a: bandEnd }];
    const steel = roofMesh(`steel-${index}`, 'steel'), cedar = roofMesh(`cedar-${index}`, 'cedar'), edges = roofMesh(`roof-edges-${index}`, 'flashing');
    cedar.grainAcross = frame.u; cedar.grainAlong = frame.v;
    const isLight = (a: number, b: number) => finish.material === 'combination'
      && a >= light.a - .01 && a <= light.b + .01 && b >= light.c - .01 && b <= light.d + .01;
    // Rafter rows terminate on roof boundaries; rows at material changes are doubled.
    const cuts = [lo, hi, ...(finish.material === 'combination' ? [light.a, light.b] : [])]
      .filter((x, i, all) => all.indexOf(x) === i).sort((a, b) => a - b);
    const rows = new Set<number>();
    for (let i = 1; i < cuts.length; i++) {
      const count = Math.ceil((cuts[i] - cuts[i - 1]) / 620);
      for (let j = 0; j <= count; j++) rows.add(cuts[i - 1] + (cuts[i] - cuts[i - 1]) * j / count);
    }
    const xs = [...rows].sort((a, b) => a - b);
    const rowCentre = (x: number) => finish.material === 'combination' && x > lo + 1 && x < hi - 1
      ? Math.abs(x - light.a) < .01 ? x + 25 : Math.abs(x - light.b) < .01 ? x - 25 : x : x;
    for (const [i, x] of xs.entries()) {
      const centre = rowCentre(x);
      const glazing = isLight(x, (near + far) / 2);
      const deep = glazing || i === 0 || i === xs.length - 1;
      assembly.members.push(boxMember(`finish-rafter-${index}-${i}`, 'rafter', point(centre, near, deep ? -75 : -90), point(centre, far, deep ? -75 : -90), deep ? '150x50' : '80x50', n));
      if (glazing) {
        const a = near, b = far;
        assembly.members.push(boxMember(`finish-joiner-${index}-${i}`, 'joiner', point(centre, a, joiner.depthMm / 2), point(centre, b, joiner.depthMm / 2), joiner, n));
      }
    }
    if (finish.material === 'combination') {
      // Glazing is cut between joiner faces and never continues beneath the solid roof.
      const lightXs = xs.filter(x => x >= light.a - .01 && x <= light.b + .01);
      for (let i = 1; i < lightXs.length; i++) {
        const r = { ...light, a: rowCentre(lightXs[i - 1]) + 26, b: rowCentre(lightXs[i]) - 26 };
        if (r.b <= r.a) continue;
        const boundary = roofRectangleBoundary(frame, r, joiner.depthMm / 2);
        acrylic.push({ id: `finish-acrylic-${index}-${i}`, material: 'acrylic', thicknessMm: 6, boundary, plane: { ...roof.plane, origin: boundary[0] } });
      }
      covering.regions.push({ id: `skylight-${index}`, material: 'acrylic', boundary: roofRectangleBoundary(frame, light) });
      const transitions = [light.a, light.b].filter(x => x > lo + 1 && x < hi - 1);
      for (const [i, cut] of transitions.entries()) {
        const startPoint = point(cut + (cut === light.a ? -25 : 25), near, -75);
        const endPoint = point(cut + (cut === light.a ? -25 : 25), far, -75);
        assembly.members.push(boxMember(`finish-transition-${index}-${i}`, 'beam', startPoint, endPoint, '150x50', n));
      }
    }
    for (const [rIndex, r] of solid.entries()) {
      if (r.b - r.a < 1 || r.d - r.c < 1) continue;
      covering.regions.push({ id: `solid-${index}-${rIndex}`, material: 'solid', boundary: roofRectangleBoundary(frame, r) });
      addProfiledRoof(steel, frame, r, finish.profile, finish.trayWidth);
      const flashings = roofMesh(`edge-flashings-${index}-${rIndex}`, 'flashing');
      addRoofEdgeFlashings(flashings, frame, r, finish.profile, finish.trayWidth);
      covering.meshes.push(flashings);
      // A board module with a 6mm negative joint. Boards run in the roof fall direction.
      const ceilingFrame = box ? { ...frame, point: (a: number, b: number, offset = 0) => ({ ...point(a, b), z: box.ceilingZ + offset }) } : frame;
      for (let a = r.a; a < r.b; a += 135) roofSlab(cedar, ceilingFrame, { ...r, a, b: Math.min(a + 129, r.b) }, box ? 0 : -187, box ? 12 : -175);
      // Dark backing closes the negative joints without faking gaps through the roof.
      roofQuad(edges, roofRectangleBoundary(ceilingFrame, r, box ? 14 : -173));
      // Close the roof build-up at material boundaries and exposed roof edges.
      const lower = roofRectangleBoundary(ceilingFrame, r, box ? 0 : -187), upper = roofRectangleBoundary(frame, r, profileHeight + 2);
      for (let edge = 0; edge < 4; edge++) roofQuad(edges, [lower[edge], lower[(edge + 1) % 4], upper[(edge + 1) % 4], upper[edge]]);
      for (let v = r.c + 25, i = 0; v < r.d; v += 860, i++) assembly.members.push(boxMember(`finish-purlin-${index}-${rIndex}-${i}`, 'beam', point(r.a, v, -25), point(r.b, v, -25), '50x50', n));
    }
    if (box?.gable) {
      const offset = profileHeight + 3;
      const apex = (x: number) => ({ x, y: options.projectionMm / 2, z: box.peak + offset / n.z });
      roofQuad(edges, [apex(lo), apex(hi), point(hi, Math.min(near + 150, far), offset), point(lo, Math.min(near + 150, far), offset)]);
    }
    covering.meshes.push(steel, cedar, edges);
  }
  assembly.roofCladdingPanels = acrylic;
  // Lift the existing single-fold cap above the highest profile, preserving its 150mm wings.
  for (const flashing of assembly.roofFlashings ?? []) for (const wing of flashing.wings) {
    wing.boundary = wing.boundary.map(p => ({ ...p, z: p.z + profileHeight + 4 }));
    wing.plane.origin = { ...wing.plane.origin, z: wing.plane.origin.z + profileHeight + 4 };
  }
  assembly.quantityHooks = [];
  return { assembly, covering, plan: buildPlanViewModel(assembly), viewerScene: buildViewerSceneModel(assembly) };
}
