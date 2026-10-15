import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';

const baselines = [
  ['20261008000001_marketing_google_ads_source', 'marketing_performance_read', 'date,date'],
  ['20261008000001_marketing_google_ads_source', 'marketing_sales_hub_read', 'date,date'],
  ['20261008000003_marketing_commercial_send_coverage', 'marketing_commercial_performance_read', 'date,date'],
  ['20261014000006_campaign_health', 'sanctuary_campaign_outcomes', 'uuid,text,text,text,uuid,text,uuid'],
] as const;

export const launchExclusionMigration = readFileSync('supabase/migrations/20261015000002_launch_verification_reporting_exclusion.sql', 'utf8');

// Disposable PGlite only. Missing read bodies have no fixture data until their owning test supplies it.
export async function prepareReportingExclusionBaselines(db: PGlite) {
  for (const [file, name, args] of baselines) {
    const { rows } = await db.query<{ present: boolean }>('select to_regprocedure($1) is not null as present', [`public.${name}(${args})`]);
    if (rows[0].present) continue;
    const source = readFileSync(`supabase/migrations/${file}.sql`, 'utf8');
    const definition = source.match(new RegExp(`create (?:or replace )?function public\\.${name}\\([\\s\\S]*?\\$\\$;`))?.[0];
    if (!definition) throw new Error(`Missing baseline ${name}`);
    await db.exec(definition);
  }
}

export async function reportingReaderMetadata(db: PGlite) {
  return (await db.query("select to_jsonb(p)-'prosrc' as metadata from pg_proc p where proname = any($1::text[]) order by proname", [baselines.map(([, name]) => name)])).rows;
}

export async function installReportingTestExclusions(db: PGlite) {
  await prepareReportingExclusionBaselines(db);
  const before = await reportingReaderMetadata(db);
  await db.exec(launchExclusionMigration);
  if (JSON.stringify(await reportingReaderMetadata(db)) !== JSON.stringify(before)) {
    throw new Error('Reporting migration changed function authority or metadata');
  }
}
