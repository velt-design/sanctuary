import { describe, expect, it } from 'vitest';
import { buildRepresentativeBox } from './representativeBox';
import { buildRepresentativeGable } from './representativeGable';
import { representativeBlindOpenings } from './representativeBlindOpenings';
import { buildRepresentativeBlind } from './representativeBlind';
import { buildRepresentativeSidePanel } from './representativeSidePanel';

describe('supported rear accessory openings', () => {
  it.each(['box', 'gable'] as const)('uses the actual independent %s rear posts while retaining default openings', family => {
    const assembly = family === 'box'
      ? buildRepresentativeBox({ widthMm: 6000, projectionMm: 3000, connection: 'facade', freestanding: true }).assembly
      : buildRepresentativeGable({ widthMm: 6000, projectionMm: 3000, connection: 'facade', freestanding: true, orientation: 'parallel', infills: false }).assembly;
    const legacy = representativeBlindOpenings(assembly);
    const all = representativeBlindOpenings(assembly, { rearOpenings: true });
    expect(all.filter(o => o.side !== 'rear')).toEqual(legacy);
    const rear = all.filter(o => o.side === 'rear');
    expect(rear.map(o => o.id)).toEqual(['rear-1of2', 'rear-2of2']);
    expect(rear.every(o => o.needsJamb === false && o.width > 650)).toBe(true);
    const face = Math.min(...assembly.members.filter(m => m.role === 'post').map(m => m.centerline.start.y - Number(m.metadata?.footprintProjectionMm ?? Math.max(m.profile.widthMm, m.profile.depthMm)) / 2));
    const opening = rear[0];
    const blind = buildRepresentativeBlind(opening, { cover: 'FLASHING', lowered: 100, infill: false });
    expect(Math.min(...blind.flatMap(m => m.positions.filter((_, i) => i % 3 === 1)))).toBeCloseTo(face + 5);
    const panel = buildRepresentativeSidePanel(opening, { kind: 'acrylic', profile: '65x39', edge: true, gap: 100, frame: 50, battens: false }, [0, opening.width]);
    expect(panel.flatMap(m => m.positions).every(Number.isFinite)).toBe(true);
    expect(Math.max(...panel.flatMap(m => m.positions.filter((_, i) => i % 3 === 0)))).toBeLessThanOrEqual(opening.end.x);
  });

  it('does not manufacture rear support on an attached or incomplete frame', () => {
    const attached = buildRepresentativeBox({ widthMm: 6000, projectionMm: 3000, connection: 'facade' }).assembly;
    expect(representativeBlindOpenings(attached, { rearOpenings: true }).some(o => o.side === 'rear')).toBe(false);
    const independent = buildRepresentativeBox({ widthMm: 6000, projectionMm: 3000, connection: 'facade', freestanding: true }).assembly;
    independent.members = independent.members.filter(m => !m.id.startsWith('box-rear-post'));
    expect(representativeBlindOpenings(independent, { rearOpenings: true }).some(o => o.side === 'rear')).toBe(false);
  });
});
