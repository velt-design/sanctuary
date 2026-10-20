import { describe, expect, it } from 'vitest';
import { solvePergolaPreview } from './solvePreview';
import { INITIAL_ROOF } from './choices';
import { representativeBlindOpenings, pergolaLightSites } from '@sp/geometry';

describe('optional staff support datum', () => {
  for (const family of ['mono', 'gable', 'box'] as const) for (const orientation of ['parallel', 'away'] as const) {
    it(`${family}/${orientation} preserves defaults and rebuilds grounded posts and accessory sites`, () => {
      const input = {widthMm: 6000, projectionMm: 3000, connection: 'facade' as const, level: 'ground' as const};
      const roof = {...INITIAL_ROOF, family, orientation};
      const original = solvePergolaPreview(input, roof);
      expect(solvePergolaPreview(input, roof, {supportDatumMm: 2400})).toEqual(original);
      const low = original.geometry!, high = solvePergolaPreview(input, roof, {supportDatumMm: 2700}).geometry!;
      expect(high).toBeDefined();
      const posts = low.assembly.members.filter(m => m.role === 'post');
      expect(posts.length).toBeGreaterThan(0);
      for (const post of posts) {
        const changed = high.assembly.members.find(m => m.id === post.id)!;
        expect(Math.min(changed.centerline.start.z, changed.centerline.end.z)).toBe(0);
        expect(Math.max(changed.centerline.start.z, changed.centerline.end.z) - Math.max(post.centerline.start.z, post.centerline.end.z)).toBeCloseTo(300, 5);
      }
      const a = representativeBlindOpenings(low.assembly), b = representativeBlindOpenings(high.assembly);
      expect(b.map(o => o.id)).toEqual(a.map(o => o.id));
      for(let i=0;i<a.length;i++) expect(b[i].top-a[i].top).toBeCloseTo(300,5);
      expect(pergolaLightSites(high.assembly, high.covering).rafters.length).toBe(pergolaLightSites(low.assembly, low.covering).rafters.length);
    });
  }
});
