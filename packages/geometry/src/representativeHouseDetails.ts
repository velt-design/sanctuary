import type { Point3 } from './contracts';
import type { ContextBox } from './representativeSurroundings';

/** Illustrative architecture only; never enters authored house geometry or takeoff. */
export function buildRepresentativeHouseDetails(wall: ContextBox, patio: ContextBox, elevated: boolean, feet: Point3[]) {
  const box = (id: string, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): ContextBox =>
    ({ id, min: { x: x1, y: y1, z: z1 }, max: { x: x2, y: y2, z: z2 } });
  const centre = (wall.min.x + wall.max.x) / 2;
  const width = Math.min(3000, (wall.max.x - wall.min.x) * .6);
  const floor = patio.max.z, face = wall.max.y;
  const left = centre - width / 2, right = centre + width / 2;
  const top = Math.min(floor + 2150, wall.max.z - 180);
  const opening = box('slider-opening', left, face - 120, floor, right, face, top);
  const frame = [
    box('slider-left', left, face - 45, floor, left + 45, face + 12, top),
    box('slider-right', right - 45, face - 45, floor, right, face + 12, top),
    box('slider-head', left + 45, face - 45, top - 45, right - 45, face + 12, top),
    box('slider-sill', left + 45, face - 65, floor, right - 45, face + 30, floor + 35),
    box('slider-meeting-stile', centre - 25, face - 30, floor + 35, centre + 25, face + 14, top - 45),
    box('slider-handle', centre - 72, face + 15, floor + 960, centre - 62, face + 35, floor + 1160),
  ];
  const glazing = [
    box('slider-pane-left', left + 45, face - 32, floor + 35, centre - 25, face - 26, top - 45),
    box('slider-pane-right', centre + 25, face - 48, floor + 35, right - 45, face - 42, top - 45),
  ];
  const terrace = { ...patio, min: { ...patio.min, z: elevated ? floor - 160 : patio.min.z } };
  const base = elevated ? box('terrace-recessed-base', patio.min.x + 65, patio.min.y, patio.min.z,
    patio.max.x - 65, patio.max.y - 65, floor - 160) : null;
  const posts = [...feet].sort((a, b) => a.x - b.x);
  const bayLeft = posts[0]?.x ?? patio.min.x + 300;
  const bayRight = posts[1]?.x ?? patio.max.x - 300;
  const stairWidth = Math.min(1600, bayRight - bayLeft - 220);
  const stairCentre = (bayLeft + bayRight) / 2;
  const rise = (floor - patio.min.z) / 4;
  const steps = elevated ? [1, 2, 3].map(i => box(`terrace-step-${i}`, stairCentre - stairWidth / 2,
    patio.max.y + (3 - i) * 300, patio.min.z, stairCentre + stairWidth / 2, patio.max.y + (4 - i) * 300, patio.min.z + rise * i)) : [];
  return { opening, frame, glazing, terrace, base, steps };
}
