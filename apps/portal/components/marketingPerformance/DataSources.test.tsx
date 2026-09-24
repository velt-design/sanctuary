import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { sampleMetaReport } from '@/lib/marketingIntegrations/meta/report';
import type { MetaEvidence } from '@/lib/marketingPerformance/dataSources';
import DataSources from './DataSources';

function evidence(): MetaEvidence {
  const fetchedAt = new Date().toISOString();
  return { status: 'available', checkedAt: fetchedAt, accountId: '123', expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    report: { ...sampleMetaReport({ start: '2026-08-01', end: '2026-08-07' }), fetchedAt } };
}
it('shows a separate provider period, exact campaign figures and unmatched acquisition costs', async () => {
  const loader = vi.fn(async () => evidence());
  const view = renderIntoDocument(<DataSources hub={hubFixture} loader={loader} />);
  await act(async () => { await Promise.resolve(); });
  expect(view.container.textContent).toContain('2026-08-01 – 2026-08-07');
  expect(view.container.textContent).toContain('$480.00');
  expect(view.container.textContent).toContain('Not reported');
  expect(view.container.textContent).toContain('Spend is not matched to enquiry cohorts');
  expect(view.container.querySelectorAll('[data-campaign]').length).toBe(2);
  view.unmount();
});
it('clears stale figures during retry and shows failures without turning spend into zero', async () => {
  const loader = vi.fn(async () => evidence());
  const view = renderIntoDocument(<DataSources hub={hubFixture} loader={loader} />);
  await act(async () => { await Promise.resolve(); });
  loader.mockRejectedValueOnce(new Error('private details'));
  await act(async () => { view.container.querySelector('button')?.click(); });
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain('could not be verified');
  expect(view.container.textContent).not.toContain('$480.00');
  expect(view.container.textContent).not.toContain('private details');
  view.unmount();
});
it('does not treat missing reports or expired retained evidence as current figures', async () => {
  const value = evidence();
  if (value.status !== 'available') throw Error();
  value.expiresAt = new Date(Date.now() - 1).toISOString();
  const loader = vi.fn(async (): Promise<MetaEvidence> => value);
  const view = renderIntoDocument(<DataSources hub={hubFixture} loader={loader} />);
  await act(async () => { await Promise.resolve(); });
  expect(view.container.textContent).toContain('has expired');
  expect(view.container.querySelector('[data-campaign]')).toBeNull();
  loader.mockResolvedValueOnce({ status: 'missing', checkedAt: new Date().toISOString() });
  await act(async () => { view.container.querySelector('button')?.click(); });
  expect(view.container.textContent).toContain('does not mean zero spend');
  view.unmount();
});
