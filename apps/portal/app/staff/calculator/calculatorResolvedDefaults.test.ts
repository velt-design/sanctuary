import type { CostOutputV1 } from '@sp/costing';
import { describe, expect, it } from 'vitest';

import { makeDefaultModule } from './calculatorInputs';
import {
  buildCalculatorResolvedDefaults,
  type CalculatorResolvedDefaultTexts,
} from './calculatorResolvedDefaults';
import type { CalculatorResultFreshness } from './calculatorResultFreshness';

function buildDefaults({
  roofPitchDeg = '',
  downpipeCount = '0',
  boxPerimeterEnabled = false,
  hasOurGutter = true,
  resultFreshness = 'current',
  pitchUsed = 5,
  normalizedDownpipes = 1,
  hasResult = true,
}: {
  roofPitchDeg?: string;
  downpipeCount?: string;
  boxPerimeterEnabled?: boolean;
  hasOurGutter?: boolean;
  resultFreshness?: CalculatorResultFreshness;
  pitchUsed?: number | undefined;
  normalizedDownpipes?: number | undefined;
  hasResult?: boolean;
} = {}): CalculatorResolvedDefaultTexts {
  const activeModule = {
    ...makeDefaultModule('pergola-1'),
    roofPitchDeg,
    downpipeCount,
    boxPerimeterEnabled,
  };
  const moduleResult = !hasResult
    ? null
    : {
        derived: { roof_pitch_deg_used: pitchUsed },
        inputs_normalized: { downpipe_count: normalizedDownpipes },
      } as Pick<CostOutputV1, 'derived' | 'inputs_normalized'>;

  return buildCalculatorResolvedDefaults({
    activeModule,
    moduleResult,
    hasOurGutter,
    resultFreshness,
  });
}

describe('calculator resolved automatic defaults', () => {
  it('reports current authoritative values without changing the raw automatic inputs', () => {
    expect(buildDefaults()).toEqual({
      roofPitchDeg: 'Auto - current result uses 5 deg',
      downpipeCount: 'Auto - current result uses 1 downpipe',
    });
  });

  it('does not label explicit values or a no-gutter downpipe as automatic', () => {
    expect(buildDefaults({ roofPitchDeg: '0', downpipeCount: '2' })).toEqual({});
    expect(buildDefaults({ hasOurGutter: false })).toEqual({
      roofPitchDeg: 'Auto - current result uses 5 deg',
    });
  });

  it('keeps box-perimeter pitch automatic even when a disabled raw value remains', () => {
    expect(buildDefaults({
      roofPitchDeg: '12',
      downpipeCount: '2',
      boxPerimeterEnabled: true,
      pitchUsed: 3.25,
    })).toEqual({
      roofPitchDeg: 'Auto - current result uses 3.25 deg',
    });
  });

  it.each<CalculatorResultFreshness>(['calculating', 'stale'])(
    'labels retained %s values as updating',
    (resultFreshness) => {
      expect(buildDefaults({ resultFreshness })).toEqual({
        roofPitchDeg: 'Auto - last valid result used 5 deg; updating',
        downpipeCount: 'Auto - last valid result used 1 downpipe; updating',
      });
    },
  );

  it.each<CalculatorResultFreshness>(['invalid', 'error'])(
    'labels retained %s values as requiring input repair',
    (resultFreshness) => {
      expect(buildDefaults({ resultFreshness })).toEqual({
        roofPitchDeg: 'Auto - last valid result used 5 deg; fix inputs to confirm',
        downpipeCount: 'Auto - last valid result used 1 downpipe; fix inputs to confirm',
      });
    },
  );

  it('uses neutral copy while waiting or when authoritative values are absent', () => {
    expect(buildDefaults({ resultFreshness: 'waiting' })).toEqual({
      roofPitchDeg: 'Auto - confirmed after a valid calculation',
      downpipeCount: 'Auto - confirmed after a valid calculation',
    });
    expect(buildDefaults({ hasResult: false })).toEqual({
      roofPitchDeg: 'Auto - confirmed after a valid calculation',
      downpipeCount: 'Auto - confirmed after a valid calculation',
    });
  });

  it('treats blank and numeric zero downpipes as automatic but not invalid text', () => {
    expect(buildDefaults({ downpipeCount: '  ' }).downpipeCount).toContain('current result');
    expect(buildDefaults({ downpipeCount: '0.0' }).downpipeCount).toContain('current result');
    expect(buildDefaults({ downpipeCount: '0x' }).downpipeCount).toContain('current result');
    expect(buildDefaults({ downpipeCount: 'invalid' }).downpipeCount).toBeUndefined();
  });
});
