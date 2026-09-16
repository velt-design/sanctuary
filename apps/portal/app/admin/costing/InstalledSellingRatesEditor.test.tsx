import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { getDefaultInstalledSellingRates, loadCostingConfigV1, snapshotCostingControlConfigV1 } from '@sp/costing';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import InstalledSellingRatesEditor from './InstalledSellingRatesEditor';
import { formatSettingPath, formatSettingValue } from './costingControlModel';

it('shows saved cents as dollars and size bands as dimensions in the publication comparison', () => {
  expect(formatSettingValue('installedSellingRates.rafterLighting.lightIncCents', 21050)).toBe('$210.50');
  expect(formatSettingValue('installedSellingRates.blinds.ziptrakBaseExGst.2.2', 1000)).toBe('$1,000.00');
  expect(formatSettingPath('installedSellingRates.blinds.ziptrakBaseExGst.2.2', new Map(), new Map())).toContain('2000 mm wide × 2000 mm drop');
});

it('captures schedules explicitly, displays dollars, and protects published versions', async () => {
  const baseline = snapshotCostingControlConfigV1(loadCostingConfigV1()), config = structuredClone(baseline);
  const update = vi.fn(mutate => mutate(config));
  const props = { config, baseline, readOnly: false, showChangedOnly: false, issues: [], updateConfig: update };
  const start = renderIntoDocument(<InstalledSellingRatesEditor {...props} />);
  expect(config.installedSellingRates).toBeUndefined();
  await act(async () => { start.container.querySelector('button')!.click(); });
  expect(config.installedSellingRates).toEqual(getDefaultInstalledSellingRates());
  start.unmount();
  const editor = renderIntoDocument(<InstalledSellingRatesEditor {...props} />);
  const light = editor.container.querySelector<HTMLInputElement>('#costing-installedSellingRates-rafterLighting-lightIncCents')!;
  expect(light.value).toBe('190');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(light, '210.50');
    light.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(config.installedSellingRates!.rafterLighting.lightIncCents).toBe(21050);
  expect(editor.container.textContent).toContain('Installation is already included');
  editor.unmount();
  const published = renderIntoDocument(<InstalledSellingRatesEditor {...props} readOnly />);
  expect(Array.from(published.container.querySelectorAll('input')).every(input => input.disabled)).toBe(true);
  expect(published.container.querySelectorAll('input').length).toBeGreaterThan(90);
  published.unmount();
});
