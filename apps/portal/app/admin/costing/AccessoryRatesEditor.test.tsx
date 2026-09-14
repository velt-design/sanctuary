import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { ACCESSORY_REVIEW_RATES, loadCostingConfigV1, snapshotCostingControlConfigV1 } from '@sp/costing';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import AccessoryRatesEditor from './AccessoryRatesEditor';

it('adds a proposal only on explicit draft action and protects read-only versions', async () => {
  const config = snapshotCostingControlConfigV1(loadCostingConfigV1());
  const update = vi.fn(mutate => mutate(config));
  const rendered = renderIntoDocument(<AccessoryRatesEditor config={config} baseline={config} readOnly={false} showChangedOnly={false} issues={[]} updateConfig={update} />);
  expect(config.accessoryRates).toBeUndefined();
  await act(async () => { rendered.container.querySelector('button')!.click(); });
  expect(config.accessoryRates).toEqual(ACCESSORY_REVIEW_RATES);
  expect(update).toHaveBeenCalledOnce(); rendered.unmount();
  const readOnly = renderIntoDocument(<AccessoryRatesEditor config={config} baseline={config} readOnly showChangedOnly={false} issues={[]} updateConfig={update} />);
  expect(Array.from(readOnly.container.querySelectorAll('input')).every(input => input.disabled)).toBe(true);
  expect(readOnly.container.textContent).toContain('Money values exclude GST');
  readOnly.unmount();
});
