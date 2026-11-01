import type { RoofPlane3D } from './contracts';
import type { RepresentativeRoofFinish } from './representativeRoofFinishTypes';
import { roofCoordinates } from './representativeRoofFinishMesh';

export const STUDIO_PANEL_SIDES = ['front', 'back', 'left', 'right'] as const;
const sideAxis = (side:typeof STUDIO_PANEL_SIDES[number]) => side === 'left' || side === 'right' ? 'x' : 'y';
// Match representativeBlindOpenings: Front is the outer +Y edge, Rear/Back -Y.
const sideSign = (side:typeof STUDIO_PANEL_SIDES[number]) => side === 'left' || side === 'back' ? 1 : -1;
/** Full fall-length sheets, in fixed 620mm structural bays. Side names are
 * product-local, never camera/world directions. At least one solid bay remains. */
export function studioRoofPanelOptions(planes: RoofPlane3D[]) {
  const rows = planes.map((plane, index) => {
    const frame = roofCoordinates(plane);
    const centre = frame.point((frame.lo + frame.hi) / 2, (frame.near + frame.far) / 2);
    return { index, frame, centre, capacity: Math.max(0, Math.floor((frame.hi - frame.lo) / 620) - 1) };
  });
  const sides = STUDIO_PANEL_SIDES.filter(side => {
    const axis = sideAxis(side);
    return rows.some(row => Math.abs(row.frame.u[axis]) > .9)
      || rows.some(row => Math.abs(row.centre[axis] - rows[0].centre[axis]) > 1);
  });
  const limits = Object.fromEntries(STUDIO_PANEL_SIDES.map(side => {
    const axis = sideAxis(side), sign = sideSign(side);
    const nearest = Math.min(...rows.map(row=>row.centre[axis]*sign));
    const eligible = rows.filter(row=>Math.abs(row.frame.u[axis])>.9 || Math.abs(row.centre[axis]*sign-nearest)<1);
    return [side, sides.includes(side) ? eligible.reduce((sum,row)=>sum+row.capacity,0) : 0];
  })) as Record<typeof STUDIO_PANEL_SIDES[number],number>;
  return { rows, sides, limits, max: rows.reduce((sum, row) => sum + row.capacity, 0) };
}
export function studioRoofPanelLayout(planes: RoofPlane3D[], selection: NonNullable<RepresentativeRoofFinish['studioPanels']>) {
  const options = studioRoofPanelOptions(planes);
  if (!options.sides.includes(selection.side))
    throw Error('Full-length panels run from front to back on this roof. Choose Left or Right.');
  const max = options.limits[selection.side];
  if (selection.version !== 1 || !Number.isSafeInteger(selection.count) || selection.count < 1 || selection.count > max)
    throw Error(`Choose between 1 and ${max} acrylic panels in total for ${selection.side}. Your selection is kept.`);
  const axis = sideAxis(selection.side), sign = sideSign(selection.side);
  const nearest = Math.min(...options.rows.map(row=>row.centre[axis]*sign));
  const eligible = options.rows.filter(row=>Math.abs(row.frame.u[axis])>.9 || Math.abs(row.centre[axis]*sign-nearest)<1);
  const ranked = eligible.flatMap(row => Array.from({length:row.capacity}, (_, slot) => {
    const along = row.frame.u[axis] * sign;
    const across = along > .9 ? row.frame.lo + (slot + .5) * 620 : along < -.9 ? row.frame.hi - (slot + .5) * 620 : (row.frame.lo + row.frame.hi) / 2;
    const point = row.frame.point(across, (row.frame.near + row.frame.far) / 2);
    return {index:row.index,slot,score:point[axis]*sign};
  })).sort((a,b)=>a.score-b.score || a.slot-b.slot || a.index-b.index);
  const counts = new Map<number,number>();
  for (const panel of ranked.slice(0,selection.count)) counts.set(panel.index,(counts.get(panel.index)??0)+1);
  const result = new Map<number, { count: number; start: number; end: number }>();
  for (const row of options.rows) {
    const count = counts.get(row.index)??0, width = count * 620;
    const fromLow = row.frame.u[axis] * sign > .9, fromHigh = row.frame.u[axis] * sign < -.9;
    const start = fromLow ? row.frame.lo : fromHigh ? row.frame.hi - width : (row.frame.lo + row.frame.hi - width) / 2;
    result.set(row.index, { count, start, end: start + width });
  }
  return { planes: result, max };
}
