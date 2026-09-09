import { expect, it } from 'vitest';
import type { AssemblyMember3D } from './contracts';
import { buildRepresentativeGable } from './representativeGable';

function bounds(member: AssemblyMember3D, axis: 'x' | 'y') {
  const half = Math.abs(member.localFrame.yAxis[axis]) * member.profile.widthMm / 2
    + Math.abs(member.localFrame.zAxis[axis]) * member.profile.depthMm / 2;
  return [Math.min(member.centerline.start[axis], member.centerline.end[axis]) - half,
    Math.max(member.centerline.start[axis], member.centerline.end[axis]) + half];
}

for (const orientation of ['parallel', 'away'] as const) for (const [widthMm, projectionMm] of [[5000,4000],[5000,4100],[1500,1500],[10000,6000]]) {
  it(`aligns finished faces in ${orientation} ${widthMm} × ${projectionMm}`, () => {
    const { assembly, plan, viewerScene } = buildRepresentativeGable({ widthMm, projectionMm, orientation, infills:true, connection:'fascia' });
    const axis = orientation === 'parallel' ? 'x' : 'y';
    const length = orientation === 'parallel' ? widthMm : projectionMm;
    for (const member of assembly.members.filter(m=>m.role==='ridge' || m.role==='gutter' || m.id==='house-beam' || m.id==='outer-beam')) {
      const [lo,hi]=bounds(member,axis);
      expect(lo,member.id).toBeCloseTo(0,6);
      expect(hi,member.id).toBeCloseTo(length,6);
    }
    const rafters=assembly.members.filter(m=>m.role==='rafter');
    expect(Math.min(...rafters.map(m=>bounds(m,axis)[0]))).toBeCloseTo(0,6);
    expect(Math.max(...rafters.map(m=>bounds(m,axis)[1]))).toBeCloseTo(length,6);
    const posts=assembly.members.filter(m=>m.role==='post');
    const crossAxis=orientation==='parallel'?'y':'x';
    const gutters=assembly.members.filter(m=>m.role==='gutter');
    for(const post of posts) {
      const gutter=gutters.reduce((a,b)=>Math.abs(a.centerline.start[crossAxis]-post.centerline.start[crossAxis])<Math.abs(b.centerline.start[crossAxis]-post.centerline.start[crossAxis])?a:b);
      const ridge=assembly.members.find(m=>m.role==='ridge')!;
      const top=post.metadata?.supportMode==='ground_post' ? ridge.centerline.start.z-ridge.profile.depthMm/2 : gutter.centerline.start.z+gutter.profile.depthMm/2;
      expect(post.centerline.end.z).toBeCloseTo(top,5);
      const scenePost=viewerScene.layers.flatMap(l=>l.objects).find(o=>o.id===post.id)!;
      if(scenePost.type==='member_prism') expect(scenePost.centerline.end.z).toBeCloseTo(top,5);
    }
    expect(Math.max(...posts.map(m=>bounds(m,axis)[1]))).toBeCloseTo(length,6);
    if(orientation==='parallel') expect(Math.min(...posts.map(m=>bounds(m,axis)[0]))).toBeCloseTo(0,6);
    for (const tie of assembly.members.filter(m=>m.metadata?.frameRole==='tie_beam')) {
      const inner=tie.metadata?.position==='inner-end';
      const face=inner?0:length;
      expect(bounds(tie,axis)[inner?0:1]).toBeCloseTo(face,6);
      const flange=assembly.members.find(m=>m.id===`${tie.id}-inside`)!;
      // The flange starts at the upright's inside face and extends into the roof.
      expect(bounds(flange,axis)[inner?0:1]).toBeCloseTo(bounds(tie,axis)[inner?1:0],6);
      const king=assembly.members.find(m=>m.metadata?.frameRole==='king_post_strut' && m.metadata.position===tie.metadata?.position)!;
      expect(bounds(king,axis)[inner?0:1]).toBeCloseTo(face,6);
    }
    const ridge=assembly.members.find(m=>m.role==='ridge')!;
    expect(plan.members.ridge[0].centerline.start[axis]).toBeCloseTo(ridge.centerline.start[axis],6);
    const sceneRidge=viewerScene.layers.flatMap(l=>l.objects).find(o=>o.id===ridge.id)!;
    expect(sceneRidge.type).toBe('member_prism');
    if(sceneRidge.type==='member_prism') expect(sceneRidge.centerline).toEqual(ridge.centerline);
  });
}
