import { describe, expect, it } from 'vitest';
import { calculateCostV1, loadCostingConfigV1 } from '@sp/costing';
import { buildReviewSiteInputs } from './configuratorReviewPrice';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';

describe('customer gable ridge direction', () => {
  it.each(['parallel', 'away'] as const)('prices the ridge along the %s direction', orientation => {
    const draft: PreviewDraft = {
      version: 1, input: { widthMm: 7000, projectionMm: 3000, connection: 'facade', level: 'ground' },
      roof: { family: 'gable', orientation, infills: false },
    };
    const module = buildReviewSiteInputs(draft).pergolas[0].modules[0];
    const result = calculateCostV1(module, { ...loadCostingConfigV1(), appliedControlManifestVersion: 'v2.9' });
    expect(result.derived.ridge_length_m).toBe(orientation === 'parallel' ? 7 : 3);
    expect(result.derived.ridge_beam_profile_used).toBe(orientation === 'parallel' ? 'RHS 150x50x3' : null);
  });
});
