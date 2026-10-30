import { expect, it } from 'vitest';
import { isProjectSiteAddress, parseSiteAddressRequest } from './siteAddressContract';
const sessionToken = '10000000-0000-4000-8000-000000000001';
const select = { action: 'select', requestId: sessionToken, placeId: 'ChIJ_test-place', address: '12 Example Road, Auckland', sessionToken, expectedUpdatedAt: '2026-10-28T01:00:00Z' };
it('accepts only a bounded search or selected reference with concurrency metadata', () => {
  expect(parseSiteAddressRequest({ action: 'search', query: ' 12 Example ', sessionToken })).toEqual({ action: 'search', query: '12 Example', sessionToken });
  expect(parseSiteAddressRequest(select)).toEqual(select);
});
it.each([
  { ...select, address: undefined }, { ...select, address: 'a'.repeat(281) }, { ...select, confirmed: true }, { ...select, placeId: '../../outside' },
  { ...select, requestId: 'not-uuid' }, { ...select, expectedUpdatedAt: 'never' },
  { action: 'search', query: '12', sessionToken }, { action: 'search', query: 'a'.repeat(201), sessionToken },
  { action: 'search', query: '12\nExample', sessionToken }, { action: 'search', query: '12 Example', sessionToken: 'fake' }, [], null,
])('rejects unsafe or ambiguous request fields: %j', value => { expect(parseSiteAddressRequest(value)).toBeNull(); });
it('accepts only the exact canonical project response without inventing persisted validation metadata', () => {
  const row = { projectId: 'project-one', address: 'Recorded text', updatedAt: '2026-10-28T01:00:00Z' };
  expect(isProjectSiteAddress(row, row.projectId)).toBe(true);
  expect(isProjectSiteAddress(row, 'project-two')).toBe(false);
  expect(isProjectSiteAddress({ ...row, updatedAt: 'never' }, row.projectId)).toBe(false);
});
