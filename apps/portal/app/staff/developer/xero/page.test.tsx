import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ developer: vi.fn(), status: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('@/lib/xero/http', () => ({ developer: mocks.developer }));
vi.mock('@/lib/xero/store', () => ({ status: mocks.status }));
vi.mock('@/lib/xero/discovery', () => ({ discoveredOrganisations: async () => [] }));
vi.mock('@/lib/xero/pilotAccess', () => ({ getPaymentPilotSession: async () => ({ user: { id: 'owner' } }) }));
vi.mock('./PaymentSuggestions', () => ({ default: () => <div>Developer payment inspection</div> }));
vi.mock('./Review', () => ({ default: () => <div>Developer record inspection</div> }));
import Page from './page';
beforeEach(() => {
  mocks.developer.mockResolvedValue({ user: { id: 'owner' } });
  mocks.status.mockResolvedValue({ connected: true, organisation: 'Example organisation', lastVerifiedAt: null, error: null });
});
const page = async () => renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
it('keeps diagnostics secondary and explains what connected means', async () => {
  const html = await page();
  expect(html).toContain('Go to Finance');
  expect(html).toContain('does not mean every invoice or payment is up to date');
  expect(html).toContain('<details><summary>Developer connection checks');
  expect(html.indexOf('Developer record inspection')).toBeGreaterThan(html.indexOf('<details>'));
});
it('does not present an error as a healthy connection', async () => {
  mocks.status.mockResolvedValue({ connected: true, organisation: 'Example', error: 'RECONNECT_REQUIRED' });
  expect(await page()).toContain('Connection needs attention');
});
it('preserves the developer-only boundary', async () => {
  mocks.developer.mockResolvedValue(null);
  await expect(page()).rejects.toThrow('NOT_FOUND');
});
