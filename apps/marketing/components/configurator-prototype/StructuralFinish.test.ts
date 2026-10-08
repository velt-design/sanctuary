import { expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { ViewerSceneObject } from '@sp/geometry';
import { applyStructuralFinish } from './StructuralFinish';

it('isolates structure finish from furniture and restores material on removal without changing geometry', () => {
  const group = new Group(), member = new Group();
  member.name = 'scene-object-post';
  const geometry = new BoxGeometry(100, 100, 2500), original = new MeshStandardMaterial();
  const structure = new Mesh(geometry, original), furniture = new Mesh(geometry, original);
  member.add(structure); group.add(member, furniture);
  const points = Array.from(geometry.attributes.position.array);
  const restore = applyStructuralFinish(group, [{ type: 'member_prism', id: 'post' } as ViewerSceneObject]);
  expect(structure.material).not.toBe(original);
  expect(furniture.material).toBe(original);
  expect(Array.from(geometry.attributes.position.array)).toEqual(points);
  const dispose = vi.spyOn(structure.material, 'dispose');
  restore();
  expect(structure.material).toBe(original);
  expect(dispose).toHaveBeenCalledOnce();
  geometry.dispose(); original.dispose();
});
