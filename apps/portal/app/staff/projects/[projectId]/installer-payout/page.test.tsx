import { afterEach, expect, it, vi } from 'vitest';
import Page from './page';

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('not found'); } }));
vi.mock('@/components/installerPayouts/InstallerPayoutPage', () => ({ default: () => null }));
afterEach(() => vi.unstubAllEnvs());

it('keeps the separate unreleased payout page unavailable by default', async () => {
  vi.stubEnv('NEXT_PUBLIC_INSTALLER_PAYOUT_ENABLED', '');
  await expect(Page({ params: Promise.resolve({ projectId: 'project-a' }) })).rejects.toThrow('not found');
});

it('preserves the project handoff for an explicitly enabled environment', async () => {
  vi.stubEnv('NEXT_PUBLIC_INSTALLER_PAYOUT_ENABLED', 'true');
  const page = await Page({ params: Promise.resolve({ projectId: 'project-a' }) });
  expect(page.props.projectId).toBe('project-a');
});
