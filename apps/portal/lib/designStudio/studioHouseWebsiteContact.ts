import type { Point3 } from '@sp/geometry';
import { houseWorld, solveStudioHouse, type StudioHouseGeometry, type StudioHouseTarget } from './studioHouseGeometry';
import type { StudioHouse, HouseSide } from './studioHouseScene';

function sideFrame(h: StudioHouse, side: HouseSide) {
  const axis = side === 'front' || side === 'rear' ? 'y' : 'x';
  const sign = side === 'front' || side === 'left' ? -1 : 1;
  const wall = side === 'front' || side === 'left' ? 0 : axis === 'x' ? Number(h.widthMm) : Number(h.depthMm);
  return { axis, sign, wall, fascia: wall + sign * Number(h.roof.overhangMm) } as const;
}

/** Actual canonical soffit surfaces, preserved even when wall and eave heights differ. */
export function boxedHouseSoffits(geometry:StudioHouseGeometry){const h=geometry.house;
 return (['front','rear','left','right'] as const).flatMap(side=>{const frame=sideFrame(h,side);
  const hasEdge=(p:Point3[],plane:number)=>p.some((v,i)=>Math.abs(v[frame.axis]-plane)<1e-5&&Math.abs(p[(i+1)%p.length][frame.axis]-plane)<1e-5);
  return (geometry.model.eave?.soffitPolygons??[]).filter(p=>hasEdge(p,frame.fascia)&&hasEdge(p,frame.wall)).map(local=>({side,local,world:local.map(p=>houseWorld(h,p))}));
 });
}

/** Explicit website soffit basis; old saved house attachment targets are unchanged. */
export function websiteSoffitTarget(h: StudioHouse, side: HouseSide): StudioHouseTarget {
  const geometry = solveStudioHouse(h), frame = sideFrame(h, side);
  if (!boxedHouseSoffits(geometry).some(s => s.side === side)) throw Error('This edge has no resolved canonical soffit for the website bracket detail.');
  const edges = (geometry.model.eave?.gutterBoundaries ?? []).flatMap(p => p.map((start, i) => ({ start, end: p[(i + 1) % p.length] })))
    .filter(e => Math.abs(e.start[frame.axis] - e.end[frame.axis]) < 1e-5 && frame.sign * (e.start[frame.axis] - frame.fascia) > 0 && Math.abs(e.start.z - e.end.z) < 1e-5);
  edges.sort((a, b) => frame.sign * (b.start[frame.axis] - a.start[frame.axis]));
  const edge = edges[0];
  if (!edge) throw Error('This edge has no supported level gutter top.');
  // Owner-confirmed website clearance: ledger back face 5 mm beyond gutter.
  // Brackets return to the actual wall, so corner mitres cannot extend the
  // usable connection beyond that wall's finite span.
  const tangent=frame.axis==='x'?'y':'x',span=frame.axis==='x'?Number(h.depthMm):Number(h.widthMm);
  const shift = (p: Point3) => houseWorld(h, { ...p, [tangent]:Math.max(0,Math.min(span,p[tangent])),[frame.axis]: p[frame.axis] + frame.sign * 5 });
  const start = shift(edge.start), end = shift(edge.end);
  return { houseId: h.id, side, kind: 'eave', label: `${h.label} · ${side} gutter / soffit`, start, end,
    centre: houseWorld(h, { x: Number(h.widthMm) / 2, y: Number(h.depthMm) / 2, z: 0 }), heightMm: start.z, error: null };
}
