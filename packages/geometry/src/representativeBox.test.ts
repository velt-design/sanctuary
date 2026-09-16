import { expect,it } from 'vitest';
import { buildRepresentativeBox } from './representativeBox';
import { representativeBoxRules } from './representativeBoxRules';
import { buildRepresentativeBoxContext } from './representativeBoxContext';

for(const widthMm of [1500,3000,3100,3200,6000,10000]) for(const projectionMm of [1500,3000,4000,6000]) {
  it(`level box ${widthMm} × ${projectionMm} shares contained roof and members between views`,()=>{
    const {assembly,plan,viewerScene}=buildRepresentativeBox({widthMm,projectionMm,connection:'facade'});
    const rules=representativeBoxRules(widthMm,projectionMm);
    expect(plan.extents.lengthMm).toBe(widthMm);expect(plan.extents.projectionMm).toBe(projectionMm);
    expect(plan.members.posts.every(post => post.profile.widthMm === 150 && post.profile.depthMm === 150)).toBe(true);
    for (const post of assembly.members.filter(member => member.role === 'post')) {
      expect([post.profile.widthMm,post.profile.depthMm]).toEqual([150,150]);
      expect(post.centerline.start.x-75).toBeGreaterThanOrEqual(0);
      expect(post.centerline.start.x+75).toBeLessThanOrEqual(widthMm);
      expect(post.centerline.start.y+75).toBe(projectionMm);
    }
    const perimeter=assembly.members.filter(m=>m.profile.depthMm===300);
    expect(perimeter).toHaveLength(4);
    for(const beam of perimeter) {
      expect(beam.centerline.start.z+150).toBe(2700);
      expect(beam.centerline.end.z+150).toBe(2700);
    }
    const gutters=assembly.members.filter(m=>m.role==='gutter');
    expect(gutters).toHaveLength(rules.roofMode==='gable'?2:1);
    for(const gutter of gutters) expect(gutter.centerline.start.z-50).toBe(2400);
    expect(assembly.members.filter(m=>m.role==='rafter').every(m=>m.profile.depthMm===80&&m.profile.widthMm===50)).toBe(true);
    expect(assembly.roofPlanes).toHaveLength(rules.roofMode==='gable'?2:1);
    if(rules.roofMode==='pitched') expect(assembly.roofPlanes[0].boundary[0].y).toBe(50);
    expect(rules.pitchDeg).toBeGreaterThanOrEqual(3);
    for(const panel of assembly.roofCladdingPanels) for(const p of panel.boundary) {
      expect(p.x).toBeGreaterThan(50);expect(p.x).toBeLessThan(widthMm-50);
      expect(p.z+3).toBeLessThan(2700);expect(p.z).toBeGreaterThan(2400);
    }
    for(const flashing of assembly.roofFlashings??[]) for(const wing of flashing.wings) for(const p of wing.boundary)
      expect(p.z+1).toBeLessThan(2700);
    const ridge=assembly.members.find(m=>m.role==='ridge');
    if(ridge) {
      expect(ridge.profile.depthMm).toBe(widthMm-100<=3000?100:150);
      expect(ridge.centerline.start.y).toBe(projectionMm/2);
      expect(ridge.centerline.end.y).toBe(projectionMm/2);
    }
    const ids=new Set(viewerScene.layers.flatMap(l=>l.objects).map(o=>o.id));
    expect(assembly.members.every(m=>ids.has(m.id))).toBe(true);
    expect(assembly.members.every(m=>Object.values(m.localFrame).every(p=>Object.values(p).every(Number.isFinite)))).toBe(true);
    expect(assembly.quantityHooks).toEqual([]);
  });
}
it('switches only below 3 degrees and reverses without changing the perimeter',()=>{
  const fall=representativeBoxRules(6000,3000).fall;
  const boundary=200+fall/Math.tan(3*Math.PI/180);
  expect(representativeBoxRules(6000,boundary).roofMode).toBe('pitched');
  expect(representativeBoxRules(6000,boundary+.01).roofMode).toBe('gable');
  expect(representativeBoxRules(6000,boundary-.01).roofMode).toBe('pitched');
});
it('keeps soffit arms below the deeper box and rejects unsupported attachments',()=>{
  const {assembly}=buildRepresentativeBox({widthMm:6000,projectionMm:4000,connection:'soffit'});
  const context=buildRepresentativeBoxContext(assembly,{connection:'soffit',elevated:false,soffitBracketCount:7})!;
  expect(context.brackets).toHaveLength(7);
  for(const bracket of context.brackets) {
    expect(bracket.section[4].z).toBeLessThan(context.ledger.bottomZ);
    expect(bracket.section[2].z).toBe(context.ledger.bottomZ);
  }
  expect(()=>buildRepresentativeBox({widthMm:6000,projectionMm:4100,connection:'soffit'})).toThrow();
  // Deliberately exercise untyped caller validation.
  expect(()=>buildRepresentativeBox({widthMm:6000,projectionMm:3000,connection:'fascia' as 'facade'})).toThrow();
});
