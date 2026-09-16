import { describe, expect, it } from 'vitest';
import { simpleCoverPostCount, simpleCoverRafterLayout } from '../../lib/simpleCoverCalculator';
import { INITIAL_INPUT } from './model';
import { solveSimpleCoverPreview } from './solvePreview';
import { solveCustomerConfigurationV1 } from '@sp/configurator/geometry';
import { configurationForSimpleCover } from './model';

describe('Simple preview framing regression', () => {
  it('preserves the existing solver datum for callers that do not opt in', () => {
    const artifact = solveCustomerConfigurationV1(configurationForSimpleCover(INITIAL_INPUT), { projectId: 'existing', estimateId: 'existing' });
    if (!('geometry' in artifact)) throw new Error(artifact.messages[0]?.message);
    expect(artifact.geometryInput.structural?.framing).toBeUndefined();
    expect(artifact.geometry.plan.members.rafters).toHaveLength(11);
    expect(artifact.geometry.plan.members.posts).toHaveLength(2);
    expect(artifact.geometry.plan.members.rafters[0]!.centerline.start.x).toBe(0);
    expect(artifact.geometry.plan.members.posts[0]!.centerline.start.x).toBe(0);
  });
  it.each([1500, 1900, 2000, 4000, 4100, 5100, 6000, 6900, 10000])('uses calculator counts and flush outside faces at %i mm', (widthMm) => {
    const artifact = solveSimpleCoverPreview({ ...INITIAL_INPUT, widthMm });
    if (!('geometry' in artifact)) throw new Error(artifact.messages[0]?.message);
    const { assembly, plan, viewerScene } = artifact.geometry;
    const rafters = assembly.members.filter((member) => member.role === 'rafter');
    const posts = assembly.members.filter((member) => member.role === 'post');
    const layout = simpleCoverRafterLayout(widthMm);
    expect(rafters).toHaveLength(layout.rafterCount);
    expect(posts).toHaveLength(simpleCoverPostCount(widthMm));
    for (const members of [rafters, posts]) {
      const left = Math.min(...members.map((member) => member.centerline.start.x - member.profile.widthMm / 2));
      const right = Math.max(...members.map((member) => member.centerline.start.x + member.profile.widthMm / 2));
      expect(left).toBeCloseTo(0, 6);
      expect(right).toBeCloseTo(widthMm, 6);
    }
    const ledger = assembly.members.find((member) => member.role === 'ledger')!;
    expect(ledger.centerline.start.x).toBe(0);
    expect(ledger.centerline.end.x).toBe(widthMm);
    rafters.forEach((member, index) => expect(member.centerline.start.x).toBeCloseTo(layout.positions[index]! * widthMm, 6));
    expect(plan.members.rafters).toHaveLength(rafters.length);
    expect(plan.members.posts).toHaveLength(posts.length);
    const sceneMembers = viewerScene.layers.flatMap((layer) => layer.objects).filter((object) => object.type === 'member_prism');
    for (const member of [...rafters, ...posts, ledger]) {
      const object = sceneMembers.find((object) => object.sourceId === member.id);
      expect(object?.centerline).toEqual(member.centerline);
    }
  });
});
