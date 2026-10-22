import { expect, it, vi } from 'vitest';
import { prepareProjectFileBindings } from './import';
import type { SharePointConfig } from './config';
const cfg = { hostname: 'fixture.sharepoint.com', siteUrl: 'https://fixture.sharepoint.com/sites/Jobs', binding: 'a'.repeat(64) } as SharePointConfig;
const row = { projectId: '11111111-1111-4111-8111-111111111111', relativePath: '01 Current projects/Fixture', label: 'Fixture', evidence: 'Synthetic verified identity' };
const manifest = (rows = [row]) => ({ formatVersion: 1, siteUrl: 'https://fixture.sharepoint.com/sites/Jobs', libraryName: 'Documents', status: 'prepared', rows });
it('preflights explicit multiple roots for one project with stable evidence hashes', async () => {
  const source = manifest([row, { ...row, relativePath: '02 Enquiries and quotes/2026/Fixture' }]);
  const resolve = vi.fn(async (path: string) => ({ id: path.startsWith('01') ? 'active' : 'enquiry' }));
  const result = await prepareProjectFileBindings(source, cfg, async () => true, resolve);
  expect(result).toHaveLength(2); expect(result[0].projectId).toBe(result[1].projectId);
  expect(await prepareProjectFileBindings(source, cfg, async () => true, resolve)).toEqual(result);
});
it('rejects a missing Portal project before resolving any provider folder', async () => {
  const resolve = vi.fn();
  await expect(prepareProjectFileBindings(manifest(), cfg, async () => false, resolve)).rejects.toThrow('Project does not exist');
  expect(resolve).not.toHaveBeenCalled();
});
it('supports the named design and feasibility grouping', async () => {
  expect(await prepareProjectFileBindings(manifest([{ ...row, relativePath: '02 Enquiries and quotes/Design and feasibility/Fixture' }]), cfg, async () => true, async () => ({ id: 'design' }))).toHaveLength(1);
});
it('rejects another site in the same tenant', async () => {
  await expect(prepareProjectFileBindings({ ...manifest(), siteUrl: 'https://fixture.sharepoint.com/sites/Finance' }, cfg, async () => true, vi.fn())).rejects.toThrow('Wrong source');
});
it('rejects duplicate live folder IDs even if names or project IDs differ', async () => {
  await expect(prepareProjectFileBindings(manifest([row, { ...row, relativePath: '01 Current projects/Other' }]), cfg, async () => true, async () => ({ id: 'same' }))).rejects.toThrow('Duplicate');
});
it.each(['Finance/Private', '01 Current projects', '02 Enquiries and quotes/2026', '90 Completed projects/2025/Fixture/Nested'])('rejects non-project root %s', async relativePath => {
  await expect(prepareProjectFileBindings(manifest([{ ...row, relativePath }]), cfg, async () => true, vi.fn())).rejects.toThrow('not a project root');
});
