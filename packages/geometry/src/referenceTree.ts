import type { Point3 } from './contracts';

type Branch = { start: Point3; end: Point3; radius: number; tipRadius: number };
type Leaf = { center: Point3; rotation: Point3; size: number; tone: number };

/** A deterministic, millimetre-scale reference specimen, independent of pergola sizing. */
export function buildReferenceTree(habit: 'upright' | 'spreading' = 'upright') {
  let seed = habit === 'upright' ? 81427 : 29413;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const branches: Branch[] = [];
  const leaves: Leaf[] = [];
  const point = (x: number, y: number, z: number): Point3 => ({ x, y, z });
  const mix = (a: Point3, b: Point3, t: number) => point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  const limb = (start: Point3, end: Point3, radius: number, tipRadius: number) => branches.push({ start, end, radius, tipRadius });
  let previous = point(0, 0, 0);
  for (let i = 1; i <= 8; i++) {
    const end = point(Math.sin(i * .7) * 35, i * 6, i * 270);
    limb(previous, end, 48 - i * 5, Math.max(4, 43 - i * 5));
    previous = end;
  }
  for (let i = 0; i < 13; i++) {
    const angle = i * 2.399 + random() * .4;
    const radial = i > 9 ? 80 + random() * 200 : 480 + random() * 220;
    const start = point(15, 20, (habit === 'upright' ? 850 : 460) + i * 78);
    const end = point(Math.cos(angle) * radial, Math.sin(angle) * radial, i > 9 ? 2500 + random() * 150 : 1750 + random() * 650 + i * 18);
    const bend = mix(start, end, .5); bend.z -= 90;
    limb(start, bend, 20 - i * .7, 11); limb(bend, end, 11, 4);
    for (let j = 0; j < 5; j++) {
      const theta = angle + (j - 2) * .7;
      const base = mix(bend, end, .35 + j * .13);
      const tip = point(end.x + Math.cos(theta) * (110 + random() * 180), end.y + Math.sin(theta) * (110 + random() * 180), end.z + (random() - .2) * 320);
      limb(base, tip, 5, 1.5);
      for (let k = 0; k < 88; k++) {
        const azimuth = random() * Math.PI * 2;
        const vertical = random() * 2 - 1;
        const spread = Math.cbrt(random());
        const horizontal = Math.sqrt(1 - vertical * vertical);
        leaves.push({
          center: point(tip.x + Math.cos(azimuth) * horizontal * spread * 225, tip.y + Math.sin(azimuth) * horizontal * spread * 225, tip.z + vertical * spread * 245),
          rotation: point(random() * Math.PI, random() * Math.PI, random() * Math.PI * 2),
          size: 29 + random() * 24, tone: random(),
        });
      }
    }
  }
  if (habit === 'spreading') {
    const shape = (p: Point3) => point(p.x * .88, p.y * .88, p.z * .72);
    return {
      branches: branches.map(branch => ({ ...branch, start: shape(branch.start), end: shape(branch.end), radius: branch.radius * .8, tipRadius: branch.tipRadius * .8 })),
      leaves: leaves.map(leaf => ({ ...leaf, center: shape(leaf.center), size: leaf.size * .85 })),
    };
  }
  return { branches, leaves };
}
