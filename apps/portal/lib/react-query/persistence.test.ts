import { describe, expect, it } from 'vitest';
import { dashboardDataQueryOptions } from '@/lib/queries/dashboard';
import { contactDetailQueryOptions } from '@/lib/queries/contacts';
import { estimateDetailQueryOptions, estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { projectPageSnapshotQueryOptions } from '@/lib/queries/projects';
import { quoteVersionDetailQueryOptions, quoteVersionsByProjectQueryOptions } from '@/lib/queries/quotes';
import {
  PORTAL_QUERY_CACHE_FALLBACK_BUSTER,
  portalEditorPersistMeta,
  resolvePortalQueryCacheBuster,
  shouldDehydratePortalQuery,
} from './persistence';

describe('portal query persistence', () => {
  it('persists only successful editor-tagged queries', () => {
    expect(
      shouldDehydratePortalQuery({
        state: { status: 'success' },
        meta: portalEditorPersistMeta,
      } as never),
    ).toBe(true);

    expect(
      shouldDehydratePortalQuery({
        state: { status: 'success' },
        meta: undefined,
      } as never),
    ).toBe(false);

    expect(
      shouldDehydratePortalQuery({
        state: { status: 'pending' },
        meta: portalEditorPersistMeta,
      } as never),
    ).toBe(false);
  });

  it('marks only heavy editor queries as persistable', () => {
    expect(estimateMetasByProjectQueryOptions('host', 'proj_1').meta).toEqual(portalEditorPersistMeta);
    expect(estimateDetailQueryOptions('host', 'est_1').meta).toEqual(portalEditorPersistMeta);
    expect(quoteVersionsByProjectQueryOptions('host', 'proj_1').meta).toEqual(portalEditorPersistMeta);
    expect(quoteVersionDetailQueryOptions('host', 'qv_1').meta).toEqual(portalEditorPersistMeta);

    expect(dashboardDataQueryOptions('today').meta).toBeUndefined();
    expect(contactDetailQueryOptions('host', 'ct_1').meta).toBeUndefined();
    expect(projectPageSnapshotQueryOptions('host', 'proj_1').meta).toBeUndefined();
  });

  it('uses the v3 fallback buster so old broad caches are discarded', () => {
    expect(PORTAL_QUERY_CACHE_FALLBACK_BUSTER).toBe('v3');
    expect(resolvePortalQueryCacheBuster(undefined)).toBe('v3');
    expect(resolvePortalQueryCacheBuster('custom-v5')).toBe('custom-v5');
  });
});
