import {afterEach, expect, it, vi} from 'vitest';
import {buildStaffConfiguratorEditUrl, configuratorMarketingOrigin, configuratorRevisionRequestId} from '../apps/portal/lib/projects/configuratorRevisionNavigation';
import {staffRevisionReturnUrl} from '../apps/marketing/components/configurator-prototype/StaffRevisionReturn';
import {DEFAULT_PREVIEW_DRAFT} from '../apps/marketing/components/configurator-prototype/previewDraft';
import {parsePreviewShareHash} from '../apps/marketing/components/configurator-prototype/previewShare';
const project = '11111111-1111-4111-8111-111111111111', source = '22222222-2222-4222-8222-222222222222';
afterEach(() => vi.unstubAllEnvs());
it('opens the existing configurator parser and returns the revised design to the same project', () => {
  const edit = new URL(buildStaffConfiguratorEditUrl('http://localhost:3065', project, source, DEFAULT_PREVIEW_DRAFT, 'http://localhost:3066'));
  expect(parsePreviewShareHash(edit.hash)?.draft ?? parsePreviewShareHash(edit.hash)).toEqual(DEFAULT_PREVIEW_DRAFT);
  const revised = {...DEFAULT_PREVIEW_DRAFT, input:{...DEFAULT_PREVIEW_DRAFT.input,widthMm:7000}};
  const back = new URL(staffRevisionReturnUrl(edit.toString(), revised, true)!);
  expect(back.origin).toBe('http://localhost:3066');
  expect(back.pathname).toBe(`/staff/projects/${project}/configurator-revision`);
  expect(back.searchParams.get('sourceEstimateId')).toBe(source);
  expect(JSON.parse(new URLSearchParams(back.hash.slice(1)).get('revisionDraft')!)).toEqual(revised);
  expect(back.search).not.toContain('widthMm');
});
it('does not let incoming links send staff to an arbitrary return destination', () => {
  const edit = buildStaffConfiguratorEditUrl('https://www.sanctuarypergolas.co.nz',project,source,DEFAULT_PREVIEW_DRAFT,'https://attacker.invalid');
  expect(new URL(staffRevisionReturnUrl(edit,DEFAULT_PREVIEW_DRAFT,false)!).origin).toBe('https://portal.sanctuarypergolas.co.nz');
  expect(staffRevisionReturnUrl('https://www.sanctuarypergolas.co.nz/configurator-preview',DEFAULT_PREVIEW_DRAFT,false)).toBeNull();
});
it('reuses the same save identity after refresh but changes it for a different reviewed revision', () => {
  const hash = 'abcdef12'.repeat(8);
  expect(configuratorRevisionRequestId(hash)).toBe(configuratorRevisionRequestId(hash));
  expect(configuratorRevisionRequestId(hash)).not.toBe(configuratorRevisionRequestId('12345678'.repeat(8)));
  expect(() => configuratorRevisionRequestId('')).toThrow();
});
it('rejects insecure or credential-bearing server forwarding origins', () => {
  vi.stubEnv('NODE_ENV','production');
  vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL','http://example.com');
  expect(() => configuratorMarketingOrigin()).toThrow();
  vi.stubEnv('NEXT_PUBLIC_MARKETING_SITE_URL','https://user:password@example.com');
  expect(() => configuratorMarketingOrigin()).toThrow();
});
