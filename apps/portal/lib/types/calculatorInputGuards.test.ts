// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1 } from './calculatorInputGuards';

afterEach(() => {
  vi.doUnmock('./calculator');
  vi.resetModules();
});

it.each([null, undefined, false, 3, 'v2', [], {}])('rejects unsupported shapes: %j', (value) => {
  expect(isCalculatorInputsV2(value)).toBe(false);
  expect(isLegacyCalculatorInputsV1(value)).toBe(false);
});

it('retains the distinct V2 and legacy shape classifications', () => {
  const v2 = { schemaVersion: 'v2', modules: [], projectName: 'Design', pergolaStyle: 'pitched' };
  const legacy = { projectName: 'Design', pergolaStyle: 'pitched' };
  expect(isCalculatorInputsV2(v2)).toBe(true);
  expect(isLegacyCalculatorInputsV1(v2)).toBe(false);
  expect(isCalculatorInputsV2(legacy)).toBe(false);
  expect(isLegacyCalculatorInputsV1(legacy)).toBe(true);
  expect(isCalculatorInputsV2({ schemaVersion: 'v2', modules: {} })).toBe(false);
  expect(isLegacyCalculatorInputsV1({ projectName: 3, pergolaStyle: 'pitched' })).toBe(false);
});

it('preserves the mixed calculator entry exports as the same functions', async () => {
  const compatibility = await import('./calculator');
  const pure = await import('./calculatorInputGuards');
  expect(compatibility.isCalculatorInputsV2).toBe(pure.isCalculatorInputsV2);
  expect(compatibility.isLegacyCalculatorInputsV1).toBe(pure.isLegacyCalculatorInputsV1);
});

it('loads the pure guards without evaluating the mixed calculator owner', async () => {
  vi.resetModules();
  const mixedLoad = vi.fn(() => { throw new Error('Mixed calculator owner must not load'); });
  vi.doMock('./calculator', mixedLoad);
  const pure = await import('./calculatorInputGuards');
  expect(pure.isCalculatorInputsV2({ schemaVersion: 'v2', modules: [] })).toBe(true);
  expect(mixedLoad).not.toHaveBeenCalled();
});
