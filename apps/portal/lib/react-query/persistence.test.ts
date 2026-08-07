import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dashboardDataQueryOptions } from '@/lib/queries/dashboard';
import { contactDetailQueryOptions } from '@/lib/queries/contacts';
import { estimateDetailQueryOptions, estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { projectPageSnapshotQueryOptions } from '@/lib/queries/projects';
import { quoteVersionDetailQueryOptions, quoteVersionsByProjectQueryOptions } from '@/lib/queries/quotes';
import { portalQueryStorageKey } from './persistence';

describe('portal query persistence boundary', () => {
  it('does not mark server query responses for durable browser persistence', () => {
    const options = [
      estimateMetasByProjectQueryOptions('host', 'proj_1'),
      estimateDetailQueryOptions('host', 'est_1'),
      quoteVersionsByProjectQueryOptions('host', 'proj_1'),
      quoteVersionDetailQueryOptions('host', 'qv_1'),
      dashboardDataQueryOptions('today'),
      contactDetailQueryOptions('host', 'ct_1'),
      projectPageSnapshotQueryOptions('host', 'proj_1'),
    ];

    for (const option of options) expect(option.meta).toBeUndefined();
  });

  it('uses an in-memory QueryClient provider without a durable persister', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'apps/portal/app/providers.tsx'),
      'utf8',
    );

    expect(source).toContain('QueryClientProvider');
    expect(source).not.toContain('PersistQueryClientProvider');
    expect(source).not.toContain('createIDBPersister');
    expect(source).toContain("const ownerId = status === 'authenticated'");
    expect(source.indexOf('<PortalThemeRuntime')).toBeLessThan(source.indexOf('<PortalDataBoundary'));
  });

  it('retains the retired owner key only for logout and access-loss cleanup', () => {
    expect(portalQueryStorageKey('user-a')).toBe('sanctuary-portal-react-query:v4:user-a');
    expect(portalQueryStorageKey('user-b')).not.toBe(portalQueryStorageKey('user-a'));
    expect(() => portalQueryStorageKey('  ')).toThrow(/user id/i);
  });
});
