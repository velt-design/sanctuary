import { describe, expect, it } from 'vitest';
import { centredTrayLayout, roofProfileSection } from './representativeRoofProfiles';
import { addRoofEdgeFlashings } from './representativeRoofEdgeFlashings';
import { roofMesh } from './representativeRoofFinishMesh';

describe('centred tray edge covers', () => {
  for (const pitch of [300, 400, 500] as const) for (const width of [800, 1730, 5900]) {
    it(`centres ${pitch}mm trays in a ${width}mm region and covers the first crowns`, () => {
      const start = 123, end = start + width;
      const layout = centredTrayLayout(start, end, pitch);
      expect(layout.firstSeam - start).toBeCloseTo(end - layout.lastSeam);
      const crowns = roofProfileSection('tray', start, end, pitch).filter(p => p.height === 39);
      expect(crowns.length).toBeGreaterThan(0);
      expect(start + layout.sideCover).toBeGreaterThan(crowns[1].across);
      expect(end - layout.sideCover).toBeLessThan(crowns.at(-2)!.across);
      const frame = { n: {x:0,y:0,z:1}, u:{x:1,y:0,z:0}, v:{x:0,y:1,z:0}, lo:start, hi:end, near:0, far:3000,
        point:(x:number,y:number,z=0)=>({x,y,z}) };
      const mesh = roofMesh('covers', 'flashing');
      addRoofEdgeFlashings(mesh, frame, {a:start,b:end,c:0,d:3000}, 'tray', pitch);
      expect(mesh.positions.every(Number.isFinite)).toBe(true);
      const topXs = mesh.positions.filter((_,i)=>i%3===0 && mesh.positions[i+2]===44);
      expect(topXs).toContain(start + layout.sideCover);
      expect(topXs).toContain(end - layout.sideCover);
    });
  }
});
