import type { Assembly3D, AssemblyMember3D } from './contracts';
import { solvePergolaGeometry } from './solvePergolaGeometry';
import { applyAssemblyPosition3D } from './applyAssemblyPosition';
import { buildPlanViewModel } from './plan';
import { buildViewerSceneModel } from './viewer';
import { addRepresentativeGableEndDetails } from './representativeGableDetails';
import { parseAssemblyMemberProfile, resolveAssemblyMemberProfileAnchors } from './profiles';
import { alignRepresentativeGableEndFaces, recordRepresentativeGablePostFootprints } from './representativeGableEnds';
import { representativeGableRules } from './representativeGableRules';
import { sizeRepresentativeGableFlashing } from './representativeGableFlashing';

export type RepresentativeGableOptions = {
  widthMm: number; projectionMm: number; orientation: 'parallel' | 'away'; infills: boolean;
  connection: 'fascia' | 'facade' | 'soffit';
};

/** A deliberately representative customer concept, reusing the canonical gable
 * roof chassis. End detail and attached supports are applied BEFORE deriving
 * either view. This artifact is not a validated engineering or costing solve.
 * Existing authored gables and their solver capabilities remain unchanged.
 */
export function buildRepresentativeGable(options: RepresentativeGableOptions) {
  const { widthMm, projectionMm, orientation, infills } = options;
  if (![widthMm, projectionMm].every(v => Number.isFinite(v) && v >= 1500 && v <= 10000)) throw new Error('Invalid gable dimensions');
  const away = orientation === 'away';
  const rules = representativeGableRules(widthMm, projectionMm, orientation);
  const { postSize, span } = rules;
  const postProfile = parseAssemblyMemberProfile(`${postSize}x${postSize}`)!;
  // Source rafters are 50mm wide. Their outside faces define the finished
  // run; every other profile is placed relative to those faces, not centres.
  const rafterWidth = 50;
  const postRunInset = (postSize - rafterWidth) / 2;
  const run = (away ? projectionMm : widthMm) - rafterWidth;
  const count = Math.ceil(run / 600) + 1;
  const source = solvePergolaGeometry({
    projectId: 'representative-gable', estimateId: 'representative-gable', family: 'gable',
    dimensions: { lengthM: run / 1000, projectionM: span / 1000 },
    roof: { material: 'acrylic', mode: 'symmetrical', pitchDeg: 25 },
    connection: { type: 'freestanding' }, supports: { postCount: 4, postCutHeightM: 2.4 },
    gable: { endFramesMode: 'both_ends', houseEaveGutterMode: 'our', outerEaveGutterMode: 'our' },
    structural: { profiles: { rafter: '150x50', tieBeam: '150x50', strut: '150x50' }, framing: { rafterCount: count, rafterSpacingMm: run / (count - 1) } },
  });
  if (!source.ok) throw new Error(source.error);
  let assembly: Assembly3D = source.assembly;
  // The canonical detailing panel reaches joiner centres. For this simplified
  // concept, expose only the clear sheet between the opaque joiner faces.
  // This avoids coplanar acrylic/aluminium faces without moving the frame.
  const sheetInset = (assembly.members.find(m => m.role === 'joiner')?.profile.widthMm ?? 50) / 2 + .5;
  for (const panel of assembly.roofCladdingPanels) {
    const lo = Math.min(...panel.boundary.map(p => p.x)), hi = Math.max(...panel.boundary.map(p => p.x));
    panel.boundary = panel.boundary.map(p => ({ ...p, x: p.x === lo ? lo + sheetInset : hi - sheetInset }));
  }
  // Freestanding is only the canonical two-gutter roof chassis. This explicit
  // attachment step supplies the concept's actual support topology.
  assembly.members = assembly.members.filter(m => m.role !== 'post' && !(away && m.metadata?.position === 'inner-end' && m.metadata?.frameRole));
  const addPost = (id: string, x: number, y: number) => {
    const origin = { x, y, z: 0 };
    const gutter = assembly.members.filter(member => member.role === 'gutter')
      .reduce((nearest, member) => Math.abs(member.centerline.start.y - y) < Math.abs(nearest.centerline.start.y - y) ? member : nearest);
    const topZ = gutter.centerline.start.z + resolveAssemblyMemberProfileAnchors(gutter.profile).topsideZ;
    const post: AssemblyMember3D = { id, role: 'post', centerline: { start: origin, end: { x, y, z: topZ } },
      profile: postProfile, localFrame: { origin, xAxis: { x: 0, y: 0, z: 1 }, yAxis: { x: 1, y: 0, z: 0 }, zAxis: { x: 0, y: 1, z: 0 } } };
    assembly.members.push(post);
  };
  if (away) {
    // Two support lines run away from the house. Intermediate posts on deep
    // projections are representative, with a maximum 4m unsupported run.
    const bays = rules.ridgeBays;
    for (let i = 1; i <= bays; i++) for (const [side, y] of [['left', Math.max(50, postSize / 2)], ['right', span - Math.max(50, postSize / 2)]] as const)
      addPost(`gable-${side}-post-${i}`, (run - postRunInset) * i / bays, y);
  } else {
    const posts = Math.max(2, rules.ridgeBays + 1);
    for (let i = 0; i < posts; i++) addPost(`gable-front-post-${i}`, postRunInset + (run - 2 * postRunInset) * i / (posts - 1), span - Math.max(50, postSize / 2));
    const ledger = assembly.members.find(m => m.id === 'house-beam')!;
    ledger.role = 'ledger';
  }
  addRepresentativeGableEndDetails(assembly, infills, rules);
  alignRepresentativeGableEndFaces(assembly);
  sizeRepresentativeGableFlashing(assembly, rules.flashingWingMm);
  assembly = applyAssemblyPosition3D(assembly, away ? { origin: { x: widthMm, y: rafterWidth / 2 }, rotationDeg: 90 } : { origin: { x: rafterWidth / 2, y: 0 }, rotationDeg: 0 });
  assembly.outline = [{ x: 0, y: 0, z: 0 }, { x: widthMm, y: 0, z: 0 }, { x: widthMm, y: projectionMm, z: 0 }, { x: 0, y: projectionMm, z: 0 }];
  recordRepresentativeGablePostFootprints(assembly);
  assembly.attachmentEdge = { start: assembly.outline[0], end: assembly.outline[1] };
  assembly.semantics.connectionType = away ? 'fascia' : options.connection === 'facade' ? 'wall' : options.connection;
  assembly.supportConditions = [];
  assembly.quantityHooks = []; // Never expose stale chassis quantities as a commercial result.
  return { assembly, plan: buildPlanViewModel(assembly), viewerScene: buildViewerSceneModel(assembly) };
}
