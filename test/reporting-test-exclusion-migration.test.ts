// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { installReportingTestExclusions, launchExclusionMigration, prepareReportingExclusionBaselines, reportingReaderMetadata } from './fixtures/reporting-test-exclusion-db';

it('changes only read bodies and preserves every function authority attribute', async () => {
  const db = new PGlite();
  try {
    await prepareReportingExclusionBaselines(db);
    const before = await reportingReaderMetadata(db);
    await installReportingTestExclusions(db);
    expect(await reportingReaderMetadata(db)).toEqual(before);
    expect(before).toHaveLength(4);
  } finally { await db.close(); }
});

it('fails closed before replacing any reader when a baseline differs', async () => {
  const db = new PGlite();
  try {
    await prepareReportingExclusionBaselines(db);
    await db.exec("create or replace function public.sanctuary_campaign_outcomes(p_actor uuid,p_account text,p_binding text,p_source text,p_connection uuid,p_environment text,p_operation uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin return '{}'::jsonb; end $$");
    const before = (await db.query('select proname,prosrc from pg_proc where proname like $1 order by proname', ['marketing_%'])).rows;
    await expect(db.exec(launchExclusionMigration)).rejects.toThrow('baseline changed: sanctuary_campaign_outcomes');
    await db.exec('rollback');
    expect((await db.query('select proname,prosrc from pg_proc where proname like $1 order by proname', ['marketing_%'])).rows).toEqual(before);
  } finally { await db.close(); }
});
