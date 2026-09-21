import { expect, it } from 'vitest';
import { enquiryDesignSummary } from './enquiryDesignSummary';
import { INITIAL_PRODUCT_SELECTION, productSelectionDraft } from '../../components/products/productSelection';

it('identifies the selected gable direction, pine ceiling and blind location', () => {
  const { draft } = productSelectionDraft({ ...INITIAL_PRODUCT_SELECTION, material: 'combination', sides: 'left', orientation: 'away' }, 'gable');
  const summary = Object.fromEntries(enquiryDesignSummary(draft).map(row => [row.label, row.value]));
  expect(summary.Direction).toBe('Ridge away from house');
  expect(summary['Roof & ceiling']).toContain('ThermoPine');
  expect(summary['Roof & ceiling']).toContain('equal thirds');
  expect(summary.Sides).toContain('Ziptrak Left');
  expect(summary.Sides).not.toContain('Ziptrak Right');
  expect(summary['House connection']).toBe('Dutch-gable fascia attachment');
});

it('describes an open pitched design without inventing extras or gable settings', () => {
  const { draft } = productSelectionDraft(INITIAL_PRODUCT_SELECTION, 'pitched');
  const summary = Object.fromEntries(enquiryDesignSummary(draft).map(row => [row.label, row.value]));
  expect(summary.Size).toBe('6.0 × 3.0 m');
  expect(summary.Sides).toBe('Open sides');
  expect(summary.Lighting).toBe('None selected');
  expect(summary.Direction).toBeUndefined();
});
