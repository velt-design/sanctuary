type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
export type FurniturePlacement = { kind: 'lounge' | 'dining' | 'small-lounge' | 'compact' | 'bistro'; x: number; y: number; rotation: number; bounds: Bounds };
type Post = { x: number; y: number; radius: number };

/** Display-only millimetres. Zones include chair pullback; never scale furniture to fit. */
export function studioFurnitureLayout(extents: Bounds, posts: Post[] = []): FurniturePlacement[] {
  const inner = { minX: extents.minX + 250, maxX: extents.maxX - 250, minY: extents.minY + 750, maxY: extents.maxY - 250 };
  const w = inner.maxX - inner.minX, d = inner.maxY - inner.minY;
  const cx = (inner.minX + inner.maxX) / 2, cy = (inner.minY + inner.maxY) / 2;
  const make = (kind: FurniturePlacement['kind'], x: number, y: number, rotated = false): FurniturePlacement => {
    const sizes = { lounge:[3400,2700], dining:[2900,2700], 'small-lounge':[3500,1800], compact:[2400,1700], bistro:[1700,1600] };
    const [a, b] = sizes[kind];
    const width = rotated ? b : a, depth = rotated ? a : b;
    return { kind, x, y, rotation: rotated ? Math.PI / 2 : 0, bounds: { minX: x - width / 2, maxX: x + width / 2, minY: y - depth / 2, maxY: y + depth / 2 } };
  };
  const fits = ({ bounds: b }: FurniturePlacement) => b.minX >= inner.minX && b.maxX <= inner.maxX && b.minY >= inner.minY && b.maxY <= inner.maxY && !posts.some(p => p.x + p.radius + 100 > b.minX && p.x - p.radius - 100 < b.maxX && p.y + p.radius + 100 > b.minY && p.y - p.radius - 100 < b.maxY);
  const candidates: FurniturePlacement[][] = [];
  // Two complete settings separated by a 650 mm route, in either footprint direction.
  if (w >= 6950 && d >= 2700) candidates.push([make('lounge', cx - 1775, cy), make('dining', cx + 2025, cy)]);
  if (w >= 3400 && d >= 6050) candidates.push([make('lounge', cx, cy - 1675), make('dining', cx, cy + 1675)]);
  for (const kind of ['lounge', 'dining', 'small-lounge', 'compact', 'bistro'] as const) for (const rotated of [false, true]) {
    for (const offset of [0, -.25, .25]) candidates.push([make(kind, cx + w * offset, cy, rotated)]);
  }
  return candidates.find(candidate => candidate.every(fits)) ?? [];
}
