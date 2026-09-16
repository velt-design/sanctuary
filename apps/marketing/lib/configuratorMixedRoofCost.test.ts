import { expect, it } from 'vitest';
import { calculateSiteCostV1, loadCostingConfigV1 } from '@sp/costing';
import { buildReviewSiteInputs } from './configuratorReviewPrice';
import { solvePergolaPreview } from '../components/configurator-prototype/solvePreview';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';

for (const family of ['mono', 'gable', 'box'] as const) for (const orientation of ['parallel', 'away'] as const) {
  it(`prices every acrylic slope and its installation: ${family} ${orientation}`, () => {
    const draft: PreviewDraft = { version: 1, input: { widthMm: 6000, projectionMm: 3000, connection: 'facade', level: 'ground' },
      roof: { family, orientation, infills: false, finish: { material: 'combination', profile: 'corrugated', trayWidth: 400, layout: 'central', acrylicBays: 2, ceiling: 'thermopine-150' } } };
    const geometry = solvePergolaPreview(draft.input, draft.roof).geometry!;
    const site = buildReviewSiteInputs(draft);
    expect(site.pergolas[0].modules[0].mixed_roof?.mode).toBe('acrylic_bays');
    const result = calculateSiteCostV1(site, loadCostingConfigV1());
    const module = result.pergolas[0].modules[0];
    expect(module.derived.acrylic_bays_total).toBe(geometry.assembly.roofCladdingPanels.filter(p => p.id.startsWith('finish-acrylic-')).length);
    expect(module.derived.acrylic_plane_count_used).toBe(geometry.assembly.roofPlanes.length);
    for (const suffix of ['install_acrylic_panels_m2', 'fix_joiner_bottom_each', 'install_joiner_bottom_m', 'install_joiner_top_m']) {
      const action = result.install.actions.find(a => a.id.endsWith(suffix));
      expect(action?.qty).toBeGreaterThan(0);
      expect(action?.cost_ex_gst).toBeGreaterThan(0);
    }
    expect(result.totals.warnings.some(w => w.message.includes('excluded from acrylic split labour'))).toBe(false);
  });
}
