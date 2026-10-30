import { describe, expect, it } from 'vitest';
import { solvePergolaPreview } from './solvePreview';
import { INITIAL_ROOF } from './choices';
import { representativeBlindOpenings, pergolaLightSites } from '@sp/geometry';
import { previewBlindOpenings } from './blindSelection';
import { defaultBlind } from '../../website/options/blindCatalog';
import { parseWebsiteSubmittedDesign } from '../../website/parser';

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

describe('Studio four-side availability', () => {
  for (const family of ['mono', 'gable', 'box'] as const) for (const orientation of ['parallel', 'away'] as const) {
    it(`${family}/${orientation} uses actual support bays at minimum and maximum dimensions without increasing retained limits`, () => {
      for (const [widthMm, projectionMm] of [[1500, 1500], [10000, family === 'gable' ? 10000 : 6000]]) {
        const input = { widthMm, projectionMm, connection: 'facade' as const, level: 'ground' as const };
        const roof = { ...INITIAL_ROOF, family, orientation, attachmentIntent: 'freestanding' as const };
        const options = { rearOpenings: true, supportDatumMm: 2700 };
        const openings = previewBlindOpenings(input, roof, options);
        expect(new Set(openings.map(o => o.side))).toEqual(new Set(['front', 'left', 'right', 'rear']));
        expect(openings.length).toBeLessThanOrEqual(16);
        if (family === 'gable' && widthMm === 10000) expect(openings).toHaveLength(10);
        expect(openings.every(o => o.width >= 650 && o.top > 1500 && [...o.roofLine, o.start, o.end].every(p => [p.x,p.y,p.z].every(Number.isFinite)))).toBe(true);
        const original = previewBlindOpenings(input, roof, { supportDatumMm: 2700 });
        expect(openings.filter(o => o.side !== 'rear')).toEqual(original);
        expect(parseWebsiteSubmittedDesign({ version: 1, input, roof: { ...roof, blinds: openings.map(o => defaultBlind(o.id)) } }).ok).toBe(true);
        expect(previewBlindOpenings(input, { ...roof, attachmentIntent: undefined }, options).some(o => o.side === 'rear')).toBe(false);
      }
    });
    it(`${family}/${orientation} fits adjoining rear pelmets through the existing post owner`, () => {
      const input = { widthMm: 3900, projectionMm: 3000, connection: 'facade' as const, level: 'ground' as const };
      const roof = { ...INITIAL_ROOF, family, orientation, attachmentIntent: 'freestanding' as const };
      const options = { rearOpenings: true };
      const openings = previewBlindOpenings(input, roof, options);
      const blinds = openings.map(o => ({ ...defaultBlind(o.id), cover: 'PELMET' as const }));
      const fitted = solvePergolaPreview(input, { ...roof, blinds }, options).geometry!;
      expect(fitted).toBeDefined();
      expect(representativeBlindOpenings(fitted.assembly, options).map(o => o.id)).toEqual(openings.map(o => o.id));
      expect(fitted.assembly.members.filter(m => m.role === 'post' && m.profile.widthMm === m.profile.depthMm).every(m => m.profile.widthMm >= 150)).toBe(true);
    });
  }
});
