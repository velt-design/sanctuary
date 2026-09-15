import { describe, expect, it } from 'vitest';
import { calculateCostV1 } from '@sp/costing';
import { buildReviewSiteInputs, calculateReviewPrice } from './configuratorReviewPrice';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';
const make = (family: 'mono'|'gable'|'box' = 'mono'): PreviewDraft => ({
  version: 1, input: { widthMm: 5000, projectionMm: 3000, connection: 'facade', level: 'ground' },
  roof: { family, orientation: 'parallel', infills: false },
});
describe('local price review', () => {
  it.each(['mono', 'gable', 'box'] as const)('uses 1.5m piles for every freestanding %s post', family => {
    const draft = make(family);
    const attached = buildReviewSiteInputs(draft).pergolas[0].modules[0];
    draft.roof.attachmentIntent = 'freestanding';
    const free = buildReviewSiteInputs(draft).pergolas[0].modules[0];
    expect(free.post_connection_type).toBe('pile_1_5m');
    expect(free.post_cut_height_m).toBe(attached.post_cut_height_m);
    const result = calculateCostV1(free);
    expect(result.install.actions.find(action => action.id === 'posts.pile_1_5m_per_post')?.qty).toBe(free.post_count);
    expect(result.install.actions.some(action => action.id === 'posts.deck_bracket_per_post')).toBe(false);
    draft.roof.attachmentIntent = undefined;
    expect(buildReviewSiteInputs(draft).pergolas[0].modules[0].post_connection_type).toBe('deck_bracket');
  });
  it.each(['mono','gable','box'] as const)('prices all roof materials for %s', family => {
    for (const material of ['acrylic','solid','combination'] as const) {
      const draft = make(family);
      draft.roof.finish = { material, layout: 'central', acrylicBays: 2, profile: 'corrugated', trayWidth: 400, ceiling: 'thermopine-100' };
      const price = calculateReviewPrice(draft);
      expect(price.status).toBe('priced');
      if(price.status==='priced') expect(price.amount).toBeGreaterThan(0);
    }
  });
  it.each([['ground',6000,5000],['elevated',5000,4000]] as const)('includes the exact %s limit and blocks above it', (level,widthMm,projectionMm) => {
    for(const family of ['mono','gable','box'] as const) {
      const draft=make(family); draft.input={...draft.input,level,widthMm,projectionMm};
      expect(calculateReviewPrice(draft).status).toBe('priced');
      draft.input.widthMm+=100;
      const result=calculateReviewPrice(draft);
      expect(result.status).toBe('custom');
      expect(result).not.toHaveProperty('amount');
    }
  });
  it('updates price for ceiling selection and reverses dimensions for away gables', () => {
    const draft=make('gable');draft.roof.orientation='away';
    expect(buildReviewSiteInputs(draft).pergolas[0].modules[0]).toMatchObject({ length_m:3,roof_span_m:5 });
    draft.roof.finish={material:'solid',layout:'central',acrylicBays:2,profile:'tray',trayWidth:400,ceiling:'thermopine-100'};
    const first=calculateReviewPrice(draft);
    draft.roof.finish.ceiling='cedar-100';
    expect(calculateReviewPrice(draft)).not.toEqual(first);
  });
  it('adds gable infills as a visible provisional allowance', () => {
    const draft=make('gable');draft.roof.infills=true;
    expect(calculateReviewPrice(draft)).toMatchObject({status:'priced',excluded:[],breakdown:expect.arrayContaining([expect.objectContaining({label:'Acrylic panels & infills',provisional:true,amount:expect.any(Number)})])});
  });
});
