import { describe, expect, it } from 'vitest';
import { solvePergolaPreview, solveSimpleCoverPreview } from './solvePreview';
import { INITIAL_ROOF } from './choices';
const input = { widthMm: 4825, projectionMm: 3125, level: 'ground' as const, connection: 'facade' as const };
describe('shared actual website geometry', () => {
 it('retains exact staff millimetres through the existing mono path', () => {
  const result = solveSimpleCoverPreview(input);
  if (!('geometry' in result)) throw Error(JSON.stringify(result.messages));
  expect(result.configuration.intent.pergola.dimensions.lengthMm).toBe(4825);
  expect(result.configuration.intent.pergola.dimensions.projectionMm).toBe(3125);
 });
 it.each(['mono','gable','box'] as const)('retains the actual %s website solve', family => {
  expect(solvePergolaPreview(input, { ...INITIAL_ROOF, family }).geometry).toBeDefined();
 });
});
