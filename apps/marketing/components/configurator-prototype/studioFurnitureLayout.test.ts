import { describe, expect, it } from 'vitest';
import { studioFurnitureLayout } from './studioFurnitureLayout';
const area = (width: number, depth: number) => ({ minX: 0, minY: 0, maxX: width, maxY: depth });
describe('illustrative furniture fit', () => {
  it('omits settings that cannot fit at full size', () => {
    expect(studioFurnitureLayout(area(2000,2200))).toEqual([]);
    expect(studioFurnitureLayout(area(1500,6000))).toEqual([]);
  });
  it('chooses complete social settings at real sizes for shallow and small spaces', () => {
    for (const [width,depth,kind] of [[6000,3000,'small-lounge'],[3700,2700,'compact'],[3000,3000,'compact'],[2200,2800,'bistro']] as const) {
      const [setting]=studioFurnitureLayout(area(width,depth));
      expect(setting.kind).toBe(kind);
      expect(setting.bounds.minY).toBeGreaterThanOrEqual(750);
      expect(setting.bounds.maxY).toBeLessThanOrEqual(depth-250);
      expect(setting.bounds.minX).toBeGreaterThanOrEqual(250);
      expect(setting.bounds.maxX).toBeLessThanOrEqual(width-250);
    }
  });
  it('fits dining in medium spaces and two settings with circulation in large spaces', () => {
    expect(studioFurnitureLayout(area(4000,4000)).map(p=>p.kind)).toEqual(['lounge']);
    expect(studioFurnitureLayout(area(3500,4000)).map(p=>p.kind)).toEqual(['dining']);
    for (const [w,d] of [[7500,4000],[4000,7500]]) {
      const layout=studioFurnitureLayout(area(w,d));
      expect(layout.map(p=>p.kind)).toEqual(['lounge','dining']);
      const [a,b]=layout.map(p=>p.bounds);
      expect(Math.max(b.minX-a.maxX,b.minY-a.maxY)).toBeGreaterThanOrEqual(650);
      for (const item of layout) expect(item.bounds.minY).toBeGreaterThanOrEqual(750);
    }
  });
  it('rejects post collisions without shrinking the setting', () => {
    expect(studioFurnitureLayout(area(3000,3000),[{x:1500,y:2000,radius:75}])).toEqual([]);
  });
});
