import { expect, it } from 'vitest';
import { buildRepresentativeGable } from './representativeGable';

for (const orientation of ['parallel', 'away'] as const) {
  const solve = (span: number, run: number, infills = false) => buildRepresentativeGable({
    widthMm: orientation === 'parallel' ? run : span, projectionMm: orientation === 'parallel' ? span : run,
    orientation, infills, connection: 'fascia' });
  it.each([[3999,50,100,'brace'],[4000,100,150,'brace'],[4999,100,150,'brace'],[5000,100,150,'post']] as const)(
    `${orientation}: gutter span %s sizes the end detail`, (span, flangeWidth, kingDepth, role) => {
      const { assembly, plan } = solve(span, 3000, true);
      const ridge = assembly.members.find(m => m.role === 'ridge')!;
      for (const king of assembly.members.filter(m => m.metadata?.frameRole === 'king_post_strut')) {
        const tie = assembly.members.find(m => m.metadata?.frameRole === 'tie_beam' && m.metadata.position === king.metadata?.position)!;
        const flange = assembly.members.find(m => m.id === `${tie.id}-inside`)!;
        expect(flange.profile.widthMm).toBe(flangeWidth);
        expect(king.profile.depthMm).toBe(kingDepth);
        expect(king.profile.widthMm).toBe(50);
        expect(king.role).toBe(role);
        expect(king.centerline.start.z).toBe(role === 'post' ? 0 : tie.centerline.start.z + 75);
        expect(king.centerline.end.z).toBeCloseTo(ridge.centerline.start.z - ridge.profile.depthMm / 2, 5);
        expect(plan.members.posts.some(m => m.id === king.id)).toBe(role === 'post');
      }
      expect(assembly.members.filter(m => m.metadata?.frameRole === 'infill_support').every(m => m.role === 'brace')).toBe(true);
    });
  it.each([[3999,1],[4000,1],[4001,2]])(`${orientation}: ridge run %s controls side-post bays`, (run, bays) => {
    const { assembly } = solve(3000, run);
    expect(assembly.members.filter(m => m.role === 'post')).toHaveLength(orientation === 'away' ? bays * 2 : bays + 1);
  });
  it.each([[3000,150],[4000,150],[4001,150],[6000,150]])(`${orientation}: flashing at 5m × %s has true slope wings`, (run, wingLength) => {
    const { assembly, viewerScene } = solve(5000, run);
    expect(assembly.roofFlashings).toHaveLength(1);
    const flashing = assembly.roofFlashings![0];
    expect(flashing.wings).toHaveLength(2);
    expect(flashing.metadata?.wingLengthMm).toBe(wingLength);
    const apexZ = Math.max(...flashing.wings.flatMap(w => w.boundary.map(p => p.z)));
    const apexes = flashing.wings.map(w => w.boundary.filter(p => Math.abs(p.z - apexZ) < .001));
    expect(apexes[0]).toHaveLength(2);
    expect(apexes[1]).toEqual(expect.arrayContaining(apexes[0]));
    for (const wing of flashing.wings) for (const point of wing.boundary.filter(p => p.z < apexZ - .001)) {
      const distances = apexes[0].map(p => Math.hypot(p.x-point.x,p.y-point.y,p.z-point.z));
      expect(Math.min(...distances)).toBeCloseTo(wingLength,5);
    }
    for (const wing of flashing.wings) {
      const sign = wing.plane.normal.z < 0 ? -1 : 1;
      const dot = (p: {x:number;y:number;z:number}) => sign * (p.x*wing.plane.normal.x+p.y*wing.plane.normal.y+p.z*wing.plane.normal.z);
      const joiners = assembly.members.filter(m => m.role === 'joiner' && dot(m.localFrame.zAxis) > .999);
      expect(joiners.length).toBeGreaterThan(0);
      for (const joiner of joiners) for (const point of wing.boundary) {
        expect(dot(point)-dot(joiner.centerline.start)-joiner.profile.depthMm/2-flashing.thicknessMm/2).toBeCloseTo(2,5);
        expect(dot(point)-dot(wing.plane.origin)).toBeCloseTo(0,5);
      }
    }
    for (const king of assembly.members.filter(m => m.metadata?.supportMode === 'ground_post')) {
      expect([king.profile.depthMm,king.profile.widthMm]).toEqual([150,50]);
      expect([king.metadata?.footprintWidthMm,king.metadata?.footprintProjectionMm]).toEqual(orientation === 'parallel' ? [150,50] : [50,150]);
    }
    const rendered = viewerScene.layers.flatMap(l => l.objects).find(o => o.id === flashing.id)!;
    expect(rendered.type).toBe('roof_flashing');
    expect(rendered.metadata?.representativeGableRidge).toBe(true);
  });
}
