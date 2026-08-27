import { describe, expect, it } from 'vitest';
import { importSimpleCoverHandoffV1 } from './simpleCoverImport';

const handoff = {
  schemaVersion: 'simple-cover-handoff.v1',
  status: 'priced',
  input: { widthMm: 6_000, projectionMm: 3_000, level: 'elevated', connection: 'facade' },
  calculationRef: 'opaque-price-authority',
  displayedPriceIncGst: 42_000,
  configurationVersion: 12,
};

describe('Simple cover configurator import', () => {
  it('imports design intent one way without price or calculation authority', () => {
    const result = importSimpleCoverHandoffV1(handoff, {
      configurationId: '6cf31a20-b9a2-4bb2-9fa0-52665367b42c',
      timestamp: '2026-08-25T02:00:00.000Z',
    });
    expect(result).toMatchObject({
      source: { kind: 'simple_cover_import', sourcePath: '/simple-cover-calculator' },
      intent: {
        pergola: {
          family: 'mono',
          dimensions: { lengthMm: 6_000, projectionMm: 3_000 },
          placement: { mode: 'attached', connectionIntent: 'wall' },
          roof: { system: 'acrylic', tint: 'clear' },
        },
        site: { level: 'elevated' },
      },
    });
    expect(JSON.stringify(result)).not.toContain('opaque-price-authority');
    expect(JSON.stringify(result)).not.toContain('42000');
  });

  it('fails closed for unknown or malformed handoff data', () => {
    expect(importSimpleCoverHandoffV1({ ...handoff, unknown: true }, {
      configurationId: '6cf31a20-b9a2-4bb2-9fa0-52665367b42c',
      timestamp: '2026-08-25T02:00:00.000Z',
    })).toBeNull();
  });
});
