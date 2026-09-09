import { describe, expect, it } from 'vitest';
import { solveSimpleCoverPreview, solveSimpleCoverSurroundings } from './solvePreview';
import { INITIAL_INPUT } from './model';

describe('representative house connections', () => {
  const solve = (connection: 'soffit' | 'fascia' | 'facade', elevated = false, widthMm = 6000) => {
    const input = { ...INITIAL_INPUT, connection, widthMm, level: elevated ? 'elevated' as const : 'ground' as const };
    const artifact = solveSimpleCoverPreview(input);
    if (!('geometry' in artifact)) throw new Error('Missing solved geometry');
    const before = JSON.stringify(artifact.geometry.assembly);
    const context = solveSimpleCoverSurroundings(input, artifact.geometry.assembly)!;
    expect(JSON.stringify(artifact.geometry.assembly)).toBe(before);
    return { context, assembly: artifact.geometry.assembly };
  };
  it.each([1500, 6000, 10000])('keeps decorative trees outside the patio at width %i', (widthMm) => {
    const { context: c } = solve('fascia', true, widthMm);
    expect(c.trees).toHaveLength(2);
    c.trees.forEach(tree => {
      expect(tree.position.z).toBe(c.ground.max.z);
      expect(tree.position.x).toBeGreaterThan(c.ground.min.x);
      expect(tree.position.x).toBeLessThan(c.ground.max.x);
      tree.specimen.leaves.forEach(leaf => {
        const minX = tree.position.x + leaf.center.x - leaf.size;
        const maxX = tree.position.x + leaf.center.x + leaf.size;
        expect(maxX < c.patio.min.x || minX > c.patio.max.x).toBe(true);
      });
    });
  });
  it.each(['soffit', 'fascia', 'facade'] as const)('keeps the %s slider below the connection and first-floor deck supported down to ground', (connection) => {
    for (const widthMm of [1500, 6000, 10000]) {
      const { context: c } = solve(connection, true, widthMm);
      const { opening, terrace, supports } = c.architecture;
      expect(opening.min.z).toBe(c.patio.max.z);
      expect(opening.max.z).toBeLessThan(c.ledger.bottomZ);
      expect(opening.min.x).toBeGreaterThan(c.wall.min.x);
      expect(opening.max.x).toBeLessThan(c.wall.max.x);
      expect(opening.max.z).toBeLessThan(c.wall.max.z);
      expect(terrace.max.z).toBe(c.patio.max.z);
      expect(terrace.max.z - terrace.min.z).toBe(160);
      expect(supports).toHaveLength(c.postFeet.length);
      for (const support of supports) {
        expect(support.min.z).toBe(c.ground.max.z);
        expect(support.max.z).toBe(terrace.min.z);
        expect(c.postFeet.some(p => (support.min.x + support.max.x) / 2 === p.x && (support.min.y + support.max.y) / 2 === p.y)).toBe(true);
      }
    }
    expect(solve(connection).context.architecture.supports).toEqual([]);
  });
  it.each(['soffit', 'fascia', 'facade'] as const)('closes %s roof edges between wall and roof without a gap', (connection) => {
    const { context: c } = solve(connection);
    expect(c.roofEnclosure.startX).toBe(c.roof.startX);
    expect(c.roofEnclosure.endX).toBe(c.roof.endX);
    expect(c.roofEnclosure.section[0]!.z).toBe(c.wall.max.z);
    expect(c.roofEnclosure.section[1]!.z).toBe(c.wall.max.z);
    expect(c.roofEnclosure.section[2]).toEqual(c.roof.section[1]);
    expect(c.roofEnclosure.section[3]).toEqual(c.roof.section[0]);
  });
  it.each([[1500, 2], [1600, 3], [3000, 3], [3100, 4], [6000, 5], [6100, 6], [7500, 6], [7600, 7], [10000, 8]])('supports the soffit ledger at width %i with %i brackets', (widthMm, count) => {
    const { context: c } = solve('soffit', false, widthMm);
    expect(Math.max(...c.gutter.section.map(p => p.z))).toBe(c.ledger.topZ);
    expect(c.ledger.backY - Math.max(...c.gutter.section.map(p => p.y))).toBe(5);
    expect(c.fascia.max.y - c.wall.max.y).toBe(500);
    expect(c.brackets).toHaveLength(count);
    expect(c.brackets[0]!.startX).toBe(0);
    expect(c.brackets.at(-1)!.endX).toBe(widthMm);
    c.brackets.slice(1).forEach((bracket, index) => {
      expect(bracket.startX - c.brackets[index]!.startX).toBeLessThanOrEqual(1500);
    });
    for (const bracket of c.brackets) {
      expect(bracket.endX - bracket.startX).toBeCloseTo(40, 6);
      expect(Math.max(...bracket.section.map(p => p.z))).toBe(c.ledger.bottomZ);
      const bearing = bracket.section.filter(p => p.z === c.ledger.bottomZ);
      expect(bearing.map(p => p.y).sort((a,b) => a-b)).toEqual([c.ledger.backY, c.ledger.backY + 40]);
      expect(Math.min(...bracket.section.map(p => p.y))).toBe(c.wall.max.y);
    }
  });
  it('places the fascia ledger against fascia and below the gutter', () => {
    const { context: c } = solve('fascia');
    expect(c.fascia.max.y).toBe(c.ledger.backY);
    expect(Math.min(...c.gutter.section.map(p => p.z))).toBeGreaterThan(c.ledger.topZ);
    expect(c.brackets).toHaveLength(0);
  });
  it('places facade against a taller wall without raising the platform', () => {
    const { context: c } = solve('facade');
    expect(c.wall.max.y).toBe(c.ledger.backY);
    expect(c.wall.max.z - c.ledger.topZ).toBeGreaterThan(2400);
    expect(c.patio.max.z).toBe(0);
    expect(c.elevated).toBe(false);
  });
  it.each(['soffit', 'fascia', 'facade'] as const)('keeps %s ground choice independent and post feet on the platform', (connection) => {
    const { context: low } = solve(connection);
    const { context: high, assembly } = solve(connection, true);
    expect(high.patio.max.z).toBe(low.patio.max.z);
    expect(high.patio.max.z - high.ground.max.z).toBe(2700);
    for (const post of assembly.members.filter(m => m.role === 'post')) expect(post.centerline.start.z).toBe(high.patio.max.z);
    expect(high.ledger).toEqual(low.ledger);
  });
});
