import type { Assembly3D, Point3 } from './contracts';
import { buildRepresentativeLandscape, type RepresentativeTree } from './representativeLandscape';
import { buildRepresentativeHouseDetails } from './representativeHouseDetails';

export type ContextBox = { id: string; min: Point3; max: Point3 };
export type ContextSection = { id: string; startX: number; endX: number; section: { y: number; z: number }[]; extrusionAxis?: 'y' };
export type RepresentativeSurroundings = {
  connection: 'soffit' | 'fascia' | 'facade';
  elevated: boolean;
  wall: ContextBox;
  patio: ContextBox;
  ground: ContextBox;
  fascia: ContextBox;
  roof: ContextSection;
  roofEnclosure: ContextSection;
  gutter: ContextSection;
  brackets: ContextSection[];
  postFeet: Point3[];
  trees: RepresentativeTree[];
  architecture: ReturnType<typeof buildRepresentativeHouseDetails>;
  ledger: { backY: number; bottomZ: number; topZ: number };
};

/** Representative context for an untransformed, +Y-projecting mono assembly.
 * This is a visual reference, not an authored HouseForm, fixing schedule or takeoff.
 * Positions follow the solved ledger; no pergola members are moved or re-solved.
 */
export function buildRepresentativeSurroundings(
  assembly: Assembly3D,
  options: { connection: RepresentativeSurroundings['connection']; elevated: boolean; soffitBracketCount: number },
): RepresentativeSurroundings | null {
  const ledger = assembly.members.find((member) => member.role === 'ledger');
  const posts = assembly.members.filter((member) => member.role === 'post');
  if (!ledger || !posts.length || Math.abs(ledger.localFrame.xAxis.x - 1) > .001) return null;
  if (options.connection === 'soffit' && (!Number.isInteger(options.soffitBracketCount) || options.soffitBracketCount < 2)) return null;
  const backY = ledger.centerline.start.y - ledger.profile.widthMm / 2;
  const bottomZ = ledger.centerline.start.z - ledger.profile.depthMm / 2;
  const topZ = ledger.centerline.start.z + ledger.profile.depthMm / 2;
  const minX = Math.min(ledger.centerline.start.x, ledger.centerline.end.x) - 600;
  const maxX = Math.max(ledger.centerline.start.x, ledger.centerline.end.x) + 600;
  const floorZ = Math.min(...posts.map((post) => post.centerline.start.z));
  const frontY = Math.max(...assembly.outline.map((point) => point.y)) + 450;
  const { connection, elevated } = options;
  // Owner-confirmed: 500mm eave; soffit ledger 5mm beyond the gutter,
  // its top level with gutter top. Other context sizes are illustrative.
  const gutterWidth = 140;
  const fasciaY = connection === 'soffit' ? backY - 5 - gutterWidth : connection === 'fascia' ? backY : backY + 500;
  const wallY = connection === 'facade' ? backY : fasciaY - 500;
  const gutterTop = connection === 'soffit' ? topZ : connection === 'fascia' ? topZ + 135 : topZ + 3200;
  const eaveZ = gutterTop - 40;
  const fasciaBottom = connection === 'soffit' ? gutterTop - 240 : connection === 'fascia' ? bottomZ - 50 : eaveZ - 200;
  const groundZ = floorZ - (elevated ? 2700 : 120);
  const box = (id: string, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): ContextBox =>
    ({ id, min: { x: x1, y: y1, z: z1 }, max: { x: x2, y: y2, z: z2 } });
  const roofBackY = wallY - 1400;
  const roofBackZ = eaveZ + (fasciaY - roofBackY) * .22;
  const roof: ContextSection = { id: 'house-roof', startX: minX, endX: maxX, section: [
    { y: roofBackY, z: roofBackZ }, { y: fasciaY, z: eaveZ },
    { y: fasciaY, z: eaveZ + 45 }, { y: roofBackY, z: roofBackZ + 45 },
  ] };
  // Closed roof volume: end faces, back and soffit meet the roof underside.
  // Its bottom meets the wall top, avoiding overlapping coplanar side faces.
  const roofEnclosure: ContextSection = { id: 'house-roof-enclosure', startX: minX, endX: maxX, section: [
    { y: roofBackY, z: fasciaBottom }, { y: fasciaY, z: fasciaBottom },
    { y: fasciaY, z: eaveZ }, { y: roofBackY, z: roofBackZ },
  ] };
  const gutterBottom = gutterTop - 120;
  const gutter: ContextSection = { id: 'house-gutter', startX: minX, endX: maxX, section: [
    { y: fasciaY, z: gutterTop }, { y: fasciaY, z: gutterBottom },
    { y: fasciaY + gutterWidth, z: gutterBottom }, { y: fasciaY + gutterWidth, z: gutterTop },
    { y: fasciaY + gutterWidth - 6, z: gutterTop }, { y: fasciaY + gutterWidth - 6, z: gutterBottom + 6 },
    { y: fasciaY + 6, z: gutterBottom + 6 }, { y: fasciaY + 6, z: gutterTop },
  ] };
  // One continuous L silhouette preserves the 40mm mitred outer envelope.
  // Quantity is supplied by the product rule owner. Equal centres keep the
  // 40mm end brackets inside the solved ledger's outside faces.
  const bracketStart = Math.min(ledger.centerline.start.x, ledger.centerline.end.x);
  const bracketSpan = Math.abs(ledger.centerline.end.x - ledger.centerline.start.x) - 40;
  const brackets: ContextSection[] = connection !== 'soffit' ? [] : Array.from({ length: options.soffitBracketCount }, (_, index) => ({
    id: `soffit-bracket-${index + 1}`,
    startX: bracketStart + bracketSpan * index / (options.soffitBracketCount - 1),
    endX: bracketStart + bracketSpan * index / (options.soffitBracketCount - 1) + 40,
    section: [
      { y: wallY, z: fasciaBottom - 40 }, { y: backY + 40, z: fasciaBottom - 40 },
      { y: backY + 40, z: bottomZ }, { y: backY, z: bottomZ },
      { y: backY, z: fasciaBottom }, { y: wallY, z: fasciaBottom },
    ],
  }));
  const patio = box('patio', minX, wallY, groundZ, maxX, frontY, floorZ);
  const wall = box('house-wall', minX, roofBackY, groundZ, maxX, wallY, fasciaBottom);
  const postFeet = posts.map((post) => ({ ...post.centerline.start }));
  return {
    connection, elevated, ledger: { backY, bottomZ, topZ }, roof, roofEnclosure, gutter, brackets,
    postFeet,
    architecture: buildRepresentativeHouseDetails(wall, patio, elevated, postFeet),
    trees: buildRepresentativeLandscape(patio, groundZ),
    wall,
    fascia: box('house-fascia', minX, fasciaY - 25, fasciaBottom, maxX, fasciaY, eaveZ),
    patio,
    ground: box('ground', minX - 2400, roofBackY, groundZ - 60, maxX + 2400, frontY + 1200, groundZ),
  };
}
