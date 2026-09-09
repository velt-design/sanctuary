import { describe, expect, it } from 'vitest';
import { buildRepresentativeGable } from './representativeGable';
import { buildRepresentativeGableContext } from './representativeGableContext';

describe('representative attached acrylic gables', () => {
  it.each(['parallel', 'away'] as const)('uses a top-flush inward L and quarter-turned king in %s', orientation => {
    const { assembly } = buildRepresentativeGable({ widthMm:6000, projectionMm:3000, orientation, infills:true, connection:'fascia' });
    for (const tie of assembly.members.filter(m => m.metadata?.frameRole === 'tie_beam')) {
      const flange = assembly.members.find(m => m.id === `${tie.id}-inside`)!;
      const king = assembly.members.find(m => m.metadata?.frameRole === 'king_post_strut' && m.metadata.position === tie.metadata?.position)!;
      expect([tie.profile.depthMm,tie.profile.widthMm]).toEqual([150,50]);
      const flangeWidth = orientation === 'parallel' ? 50 : 100;
      expect([flange.profile.depthMm,flange.profile.widthMm]).toEqual([50,flangeWidth]);
      const top = tie.centerline.start.z + 75;
      expect(flange.centerline.start.z + 25).toBe(top);
      expect(king.centerline.start.z).toBe(orientation === 'parallel' ? top : 0);
      const outsideOffset = orientation === 'parallel' ? flange.centerline.start.x-tie.centerline.start.x : flange.centerline.start.y-tie.centerline.start.y;
      expect(outsideOffset).toBeCloseTo((tie.metadata?.position === 'inner-end' ? 1 : -1) * (25 + flangeWidth / 2),6);
      // Keep the quarter-turn in the member frame, independent of screen view.
      const breadth = Math.abs(king.localFrame.zAxis.x*tie.localFrame.yAxis.x + king.localFrame.zAxis.y*tie.localFrame.yAxis.y);
      expect(breadth).toBeCloseTo(1,6);
    }
  });
  for (const orientation of ['parallel','away'] as const) it.each([[3999,90],[4000,90],[4001,150],[6000,150]])('%s mm projection applies the strict 20m² post threshold ('+orientation+')',(projectionMm,size) => {
    const {assembly,plan} = buildRepresentativeGable({widthMm:5000,projectionMm,orientation,infills:false,connection:'fascia'});
    const posts=assembly.members.filter(m=>m.role==='post' && m.metadata?.supportMode !== 'ground_post');
    expect(posts.every(m=>m.profile.widthMm===size && m.profile.depthMm===size)).toBe(true);
    expect(plan.members.posts.filter(m=>m.metadata?.supportMode !== 'ground_post').every(m=>m.profile.widthMm===size)).toBe(true);
    for (const post of posts) {
      expect(post.centerline.start.x-size/2).toBeGreaterThanOrEqual(-.001);
      expect(post.centerline.start.x+size/2).toBeLessThanOrEqual(5000.001);
      expect(post.centerline.start.y+size/2).toBeLessThanOrEqual(projectionMm+.001);
    }
  });
  for (const orientation of ['parallel', 'away'] as const) for (const [widthMm, projectionMm] of [[1500,1500],[6000,3000],[10000,6000],[1500,6000],[10000,1500]]) {
    it(`${orientation} ${widthMm} × ${projectionMm} shares one complete assembly between views`, () => {
      const options = { widthMm, projectionMm, orientation, infills: true, connection: 'fascia' as const };
      const result = buildRepresentativeGable(options);
      const { assembly, plan, viewerScene } = result;
      expect(plan.extents.lengthMm).toBe(widthMm);
      expect(plan.extents.projectionMm).toBe(projectionMm);
      const ridge = plan.members.ridge[0].centerline;
      expect(Math.abs(orientation === 'parallel' ? ridge.end.y-ridge.start.y : ridge.end.x-ridge.start.x)).toBeLessThan(.001);
      expect(assembly.roofPlanes).toHaveLength(2);
      expect(assembly.members.filter(m=>m.role==='gutter')).toHaveLength(2);
      const ends = orientation === 'parallel' ? 2 : 1;
      expect(assembly.members.filter(m=>m.metadata?.frameRole==='tie_beam')).toHaveLength(ends);
      expect(assembly.members.filter(m=>m.metadata?.frameRole==='tie_beam_inside')).toHaveLength(ends);
      const kings=assembly.members.filter(m=>m.metadata?.frameRole==='king_post_strut');
      expect(kings).toHaveLength(ends);
      const span = orientation === 'parallel' ? projectionMm : widthMm;
      expect(kings.every(m=>m.profile.depthMm===(span<4000?100:150) && m.profile.widthMm===50)).toBe(true);
      const sceneIds = new Set(viewerScene.layers.flatMap(l=>l.objects).map(o=>o.id));
      expect(assembly.members.every(m=>sceneIds.has(m.id))).toBe(true);
      expect(assembly.members.every(m=>Object.values(m.centerline.start).every(Number.isFinite))).toBe(true);
      expect(assembly.roofCladdingPanels.filter(p=>p.metadata?.representativeGableInfill).length).toBeGreaterThan(0);
      const context=buildRepresentativeGableContext(assembly,{...options,elevated:true,soffitBracketCount:5});
      expect(context).not.toBeNull();
      expect(context!.architecture.supports).toHaveLength(context!.postFeet.length);
      expect(context!.patio.max.z - context!.ground.max.z).toBe(2700);
      expect(context!.roof.extrusionAxis).toBe(orientation==='away'?'y':undefined);
    });
  }
  it('only adds infill acrylic and supporting uprights when selected', () => {
    const options={widthMm:6000,projectionMm:3000,orientation:'parallel' as const,connection:'soffit' as const};
    const open=buildRepresentativeGable({...options,infills:false});
    const filled=buildRepresentativeGable({...options,infills:true});
    expect(open.assembly.members.some(m=>m.metadata?.frameRole==='infill_support')).toBe(false);
    expect(filled.assembly.members.some(m=>m.metadata?.frameRole==='infill_support')).toBe(true);
    expect(open.assembly.roofCladdingPanels.some(p=>p.metadata?.representativeGableInfill)).toBe(false);
    expect(filled.plan.members.posts).toEqual(open.plan.members.posts);
    expect(filled.plan.members.rafters).toEqual(open.plan.members.rafters);
    expect(buildRepresentativeGableContext(open.assembly,{...options,infills:false,elevated:false,soffitBracketCount:5})!.brackets).toHaveLength(5);
  });
  it('adds rafter pairs along the ridge run in each orientation', () => {
    const solve=(widthMm:number,projectionMm:number,orientation:'parallel'|'away')=>buildRepresentativeGable({widthMm,projectionMm,orientation,infills:false,connection:'fascia'}).plan.members.rafters.length;
    expect(solve(9000,3000,'parallel')).toBeGreaterThan(solve(3000,3000,'parallel'));
    expect(solve(6000,6000,'away')).toBeGreaterThan(solve(6000,3000,'away'));
    expect(solve(9000,3000,'away')).toBe(solve(3000,3000,'away'));
  });
});
