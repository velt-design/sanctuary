import 'server-only';
import { PraxisConnectorError, withPraxisReadTransaction, type ConnectorConfig, type PraxisServerDependencies } from './server';

const TEST_PROJECT = '10c5db1a-602c-4f0c-8193-855b186215bb';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unavailable = () => new PraxisConnectorError(503, 'PROJECTION_NOT_READY', 'Complete business overview evidence is unavailable.', true);
export function parseOverviewLimit(url: URL): number {
  const values = url.searchParams.getAll('limit');
  if ([...url.searchParams.keys()].some(key => key !== 'limit') || values.length > 1
    || (values.length === 1 && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(values[0]))) {
    throw new PraxisConnectorError(400, 'INVALID_QUERY', 'Choose an overview limit from 1 to 50.');
  }
  return values.length ? Number(values[0]) : 20;
}
type AttentionItem = {
  projectId: string; projectName: string; contactId: string; customerName: string; email: string | null;
  stage: string | null; recordedAt: string; quoteId: string; quoteVersionId: string; quoteRef: string | null;
  status: 'SENT'; sentAt: string; expiresAt: string | null; totalIncGstCents: number;
  reason: 'sent_unaccepted' | 'sent_expired';
};
type Aggregate = {
  total: string; archived: string; attention_total: string; excluded: string; incomplete: boolean;
  stages: Array<{ stage: string | null; count: number }>; items: AttentionItem[];
};
function count(value: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw unavailable();
  return Number(value);
}
function timestamp(value: string, asOf?: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
    || (asOf !== undefined && Date.parse(value) > Date.parse(asOf))) throw unavailable();
  return new Date(value).toISOString();
}
const boundedText = (value: unknown, max = 1024, min = 0): value is string => typeof value === 'string' && value.length >= min && value.length <= max;

export async function readPraxisOverview(limit: number, config: ConnectorConfig, requestId: string, dependencies?: PraxisServerDependencies) {
  limit = parseOverviewLimit(new URL(`https://validation.invalid/?limit=${limit}`));
  const result = await withPraxisReadTransaction(config, async transaction => {
    const times = await transaction<{ as_of: Date | string }[]>`select transaction_timestamp() as as_of`;
    // All aggregates precede the only LIMIT. Reading existing sanitised views
    // retains the reporting role boundary and never transfers whole portfolios.
    const rows = await transaction<Aggregate[]>`
      with projects as materialized (
        select * from praxis_reporting.projects_v1 where id <> ${TEST_PROJECT}::uuid
      ), contacts as materialized (select * from praxis_reporting.contacts_v1),
      quotes as materialized (select * from praxis_reporting.quotes_v1 where project_id <> ${TEST_PROJECT}::uuid or project_id is null),
      versions as materialized (select * from praxis_reporting.quote_versions_v1 where project_id <> ${TEST_PROJECT}::uuid or project_id is null),
      attention as materialized (
        select distinct on (q.id) p.id as project_id, c.id as contact_id, q.id as quote_id, v.id as version_id,
          p.payload as project, c.payload as contact, q.payload as quote, v.payload as version,
          greatest(p.recorded_at,c.recorded_at,q.recorded_at,v.recorded_at) as recorded_at
        from quotes q join projects p on p.id=q.project_id
        join contacts c on c.id=p.parent_id join versions v on v.parent_id=q.id
        where p.payload->>'archivedAt' is null and v.payload->>'status'='SENT'
          and v.payload->>'supersededAt' is null and v.payload->>'acceptedAt' is null
          and not exists (select 1 from versions accepted where accepted.parent_id=q.id
            and (accepted.payload->>'acceptedAt' is not null or accepted.payload->>'status'='ACCEPTED'))
        order by q.id, (v.payload->>'versionNumber')::integer desc, v.id
      ), limited as (
        select * from attention order by (version->>'sentAt')::timestamptz, quote_id limit ${limit}
      )
      select (select count(*)::text from projects) as total,
        (select count(*)::text from projects where payload->>'archivedAt' is not null) as archived,
        (select count(*)::text from attention) as attention_total,
        (select count(*)::text from praxis_reporting.projects_v1 where id=${TEST_PROJECT}::uuid) as excluded,
        (exists (select 1 from projects p where omission_count<>0 or not (payload ?& array['name','pipelineStage','archivedAt','contactId'])
          or jsonb_typeof(payload->'name') is distinct from 'string' or length(payload->>'name') not between 1 and 1024
          or (payload->'pipelineStage' <> 'null'::jsonb and (jsonb_typeof(payload->'pipelineStage') <> 'string' or length(payload->>'pipelineStage') > 100))
          or not exists(select 1 from contacts c where c.id=p.parent_id and c.id::text=p.payload->>'contactId' and c.omission_count=0
            and jsonb_typeof(c.payload->'name')='string' and length(c.payload->>'name') between 1 and 1024
            and (c.payload->>'email' is null or (jsonb_typeof(c.payload->'email')='string' and length(c.payload->>'email')<=254))))
        or exists (select 1 from quotes q where omission_count<>0 or not exists(select 1 from projects p where p.id=q.project_id))
        or exists (select 1 from versions v where omission_count<>0 or not (payload ?& array['status','acceptedAt','supersededAt','sentAt','versionNumber'])
          or not exists(select 1 from quotes q where q.id=v.parent_id and q.project_id=v.project_id))
        or exists (select 1 from attention where version->>'sentAt' is null or version->>'totalIncGstCents' is null
          or (quote->>'quoteRef' is not null and (jsonb_typeof(quote->'quoteRef') <> 'string' or length(quote->>'quoteRef') > 100))
          or recorded_at is null or not isfinite(recorded_at) or recorded_at > transaction_timestamp()
          or case when jsonb_typeof(version->'sentAt')='string' and pg_input_is_valid(version->>'sentAt','timestamp with time zone')
            then not isfinite((version->>'sentAt')::timestamptz) or (version->>'sentAt')::timestamptz > transaction_timestamp() else true end
          or case when version->>'expiresAt' is null then false
            when jsonb_typeof(version->'expiresAt')='string' and pg_input_is_valid(version->>'expiresAt','timestamp with time zone')
            then not isfinite((version->>'expiresAt')::timestamptz) else true end
          or jsonb_typeof(version->'totalIncGstCents') <> 'number'
          or (version->>'totalIncGstCents')::numeric < 0 or (version->>'totalIncGstCents')::numeric > 9007199254740991
          or trunc((version->>'totalIncGstCents')::numeric) <> (version->>'totalIncGstCents')::numeric)) as incomplete,
        coalesce((select jsonb_agg(s order by stage nulls last) from (
          select payload->>'pipelineStage' as stage,count(*) as count from projects where payload->>'archivedAt' is null group by 1
        ) s),'[]'::jsonb) as stages,
        coalesce((select jsonb_agg(jsonb_build_object(
          'projectId',project_id,'projectName',project->>'name','contactId',contact_id,'customerName',contact->>'name',
          'email',contact->>'email','stage',project->>'pipelineStage','recordedAt',recorded_at,
          'quoteId',quote_id,'quoteVersionId',version_id,'quoteRef',quote->>'quoteRef','status','SENT',
          'sentAt',version->>'sentAt','expiresAt',version->>'expiresAt','totalIncGstCents',version->'totalIncGstCents',
          'reason',case when (version->>'expiresAt')::timestamptz < transaction_timestamp() then 'sent_expired' else 'sent_unaccepted' end
        ) order by (version->>'sentAt')::timestamptz,quote_id) from limited),'[]'::jsonb) as items
    `;
    return { asOf: new Date(times[0]!.as_of).toISOString(), rows };
  }, dependencies);
  const row = result.rows[0];
  if (result.rows.length !== 1 || !row || row.incomplete !== false || !Array.isArray(row.stages) || !Array.isArray(row.items)) throw unavailable();
  const totalProjects = count(row.total), archivedProjects = count(row.archived), total = count(row.attention_total);
  if (archivedProjects > totalProjects || row.items.length !== Math.min(total, limit)
    || row.stages.some(s => !(s.stage === null || boundedText(s.stage,100)) || !Number.isSafeInteger(s.count) || s.count < 0)
    || row.stages.reduce((sum,s) => sum+s.count,0) !== totalProjects-archivedProjects) throw unavailable();
  const items = row.items.map(item => {
    if (![item.projectId,item.contactId,item.quoteId,item.quoteVersionId].every(id => typeof id === 'string' && uuid.test(id))
      || !boundedText(item.projectName,1024,1) || !boundedText(item.customerName,1024,1)
      || !(item.email === null || boundedText(item.email,254)) || !(item.stage === null || boundedText(item.stage,100))
      || !(item.quoteRef === null || boundedText(item.quoteRef,100)) || item.status !== 'SENT'
      || !['sent_unaccepted','sent_expired'].includes(item.reason)
      || !Number.isSafeInteger(item.totalIncGstCents) || item.totalIncGstCents < 0) throw unavailable();
    return { ...item, recordedAt: timestamp(item.recordedAt,result.asOf), sentAt: timestamp(item.sentAt,result.asOf),
      expiresAt: item.expiresAt === null ? null : timestamp(item.expiresAt) };
  });
  return { schemaVersion: 'sanctuary.praxis.overview.v1' as const, requestId,
    source: { sourceKey: config.sourceKey, connectionId: config.connectionId, environment: config.environment,
      authority: 'canonical' as const, asOf: result.asOf, retrievedAt: new Date().toISOString() },
    coverage: 'complete_current_project_population' as const,
    pipeline: { totalProjects, archivedProjects, activeProjects: totalProjects-archivedProjects, stages: row.stages },
    quoteAttention: { total, returned: items.length, limit, truncated: total > items.length, items },
    excludedTestProjects: count(row.excluded), exclusion: 'labelled_measurement_test_20260916' as const,
    limitations: ['Active means not archived; the newer project work state is not available in this projection.',
      'Pipeline stages are workflow labels, not acceptance or payment evidence.',
      'Quote attention is source status, not evidence of unanswered correspondence. Archived projects and quotes with any accepted version are excluded.',
      'Cash, actual costs, profitability and staff workload are unavailable in this overview.'],
  };
}
