import { expect, it } from 'vitest';
import { projectedFinishFaces } from './PlanFinishes';

it('projects sloping roof faces but omits vertical faces with no plan area', () => {
  const faces = projectedFinishFaces({ id: 'test', kind: 'cedar',
    positions: [0,0,0, 100,0,0, 100,100,20, 0,0,50], indices: [0,1,2, 0,1,3] });
  expect(faces).toHaveLength(1);
  expect(faces[0].points).toBe('0,0 100,0 100,100');
  expect(faces[0].shade).toBeGreaterThan(0);
  expect(faces[0].shade).toBeLessThan(1);
});
