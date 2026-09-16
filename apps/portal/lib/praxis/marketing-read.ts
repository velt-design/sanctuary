import 'server-only';
import { PraxisConnectorError, withPraxisReadTransaction, type ConnectorConfig, type PraxisServerDependencies } from './server';

type Period = { start: string; end: string };
export type MarketingQuery = { period: Period; comparison: Period | null };
const TEST_ENQUIRY = 'f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70';
const TEST_PROJECT = '10c5db1a-602c-4f0c-8193-855b186215bb';
const labels = ['Enquiries received', 'Quotes created', 'Quotes sent', 'Quotes accepted'] as const;
const invalid = () => new PraxisConnectorError(400, 'INVALID_QUERY', 'Choose 1–90 completed days and an optional equal earlier comparison.');
function date(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString().slice(0, 10) !== value) throw invalid();
  return value;
}
export function parseMarketingQuery(url: URL, now = new Date()): MarketingQuery {
  const allowed = ['start', 'end', 'comparisonStart', 'comparisonEnd'];
  if ([...url.searchParams.keys()].some(key => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) throw invalid();
  const period = { start: date(url.searchParams.get('start')), end: date(url.searchParams.get('end')) };
  const duration = Date.parse(period.end) - Date.parse(period.start);
  if (duration < 0 || duration > 89 * 86400000 || period.end >= now.toISOString().slice(0, 10)) throw invalid();
  let comparison: Period | null = null;
  if (url.searchParams.has('comparisonStart') || url.searchParams.has('comparisonEnd')) {
    comparison = { start: date(url.searchParams.get('comparisonStart')), end: date(url.searchParams.get('comparisonEnd')) };
    if (Date.parse(comparison.end) - Date.parse(comparison.start) !== duration || comparison.end >= period.start) throw invalid();
  }
  return { period, comparison };
}
type Aggregate = { period: string; enquiries: string; quotes: string; sent: string; accepted: string; excluded: string; incomplete: boolean };
const count = (value: string) => {
  const result = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(result)) throw new PraxisConnectorError(503, 'PROJECTION_NOT_READY', 'Marketing counts are unavailable.', true);
  return result;
};

export async function readPraxisMarketing(query: MarketingQuery, config: ConnectorConfig, requestId: string, dependencies?: PraxisServerDependencies) {
  const params = new URLSearchParams({ start: query.period.start, end: query.period.end });
  if (query.comparison) { params.set('comparisonStart', query.comparison.start); params.set('comparisonEnd', query.comparison.end); }
  query = parseMarketingQuery(new URL(`https://validation.invalid/?${params}`));
  const result = await withPraxisReadTransaction(config, async transaction => {
    const times = await transaction<{ as_of: Date | string }[]>`select transaction_timestamp() as as_of`;
    // Aggregate inside the existing restricted, repeatable-read transaction. No
    // row-limit expansion, raw customer transfer or new database grants are needed.
    const rows = await transaction<Aggregate[]>`
      with periods(period, first_day, last_day) as (values
        ('period', ${query.period.start}::date, ${query.period.end}::date),
        ('comparison', ${query.comparison?.start ?? null}::date, ${query.comparison?.end ?? null}::date)
      ), records as materialized (
        select resource, id, project_id, parent_id, payload, omission_count from praxis_reporting.enquiry_requests_v1
        union all select resource, id, project_id, parent_id, payload, omission_count from praxis_reporting.quotes_v1
        union all select resource, id, project_id, parent_id, payload, omission_count from praxis_reporting.quote_versions_v1
      ), marked as materialized (
        select *, (id = ${TEST_ENQUIRY}::uuid or project_id = ${TEST_PROJECT}::uuid) is true as excluded,
          ((payload->>'createdAt')::timestamptz at time zone 'Pacific/Auckland')::date as created_day,
          ((payload->>'sentAt')::timestamptz at time zone 'Pacific/Auckland')::date as sent_day,
          ((payload->>'acceptedAt')::timestamptz at time zone 'Pacific/Auckland')::date as accepted_day
        from records
      )
      select p.period,
        count(distinct r.id) filter (where not excluded and resource='enquiry_request' and created_day between first_day and last_day)::text as enquiries,
        count(distinct r.id) filter (where not excluded and resource='quote' and created_day between first_day and last_day)::text as quotes,
        count(distinct r.parent_id) filter (where not excluded and resource='quote_version' and sent_day between first_day and last_day)::text as sent,
        count(distinct r.parent_id) filter (where not excluded and resource='quote_version' and accepted_day between first_day and last_day)::text as accepted,
        count(*) filter (where excluded and created_day between first_day and last_day)::text as excluded,
        coalesce(bool_or(r.omission_count > 0 or (r.resource in ('enquiry_request','quote') and r.created_day is null)
          or (r.resource='quote_version' and (r.parent_id is null or not exists
            (select 1 from records q where q.resource='quote' and q.id=r.parent_id and q.project_id is not distinct from r.project_id)))), false) as incomplete
      from periods p left join marked r on true where p.first_day is not null group by p.period
    `;
    return { asOf: new Date(times[0]!.as_of).toISOString(), rows };
  }, dependencies);
  const current = result.rows.find(row => row.period === 'period');
  const previous = result.rows.find(row => row.period === 'comparison');
  if (!current || result.rows.length !== (query.comparison ? 2 : 1) || (query.comparison && !previous)
    || result.rows.some(row => row.incomplete !== false)) throw new PraxisConnectorError(503, 'PROJECTION_NOT_READY', 'Complete marketing evidence is unavailable.', true);
  const fields = ['enquiries', 'quotes', 'sent', 'accepted'] as const;
  return { schemaVersion: 'sanctuary.praxis.marketing.v1' as const, requestId,
    source: { sourceKey: config.sourceKey, connectionId: config.connectionId, environment: config.environment,
      authority: 'canonical' as const, asOf: result.asOf, retrievedAt: new Date().toISOString() },
    coverage: 'complete_period_activity' as const, timezone: 'Pacific/Auckland' as const, query,
    counts: fields.map((field, index) => ({ label: labels[index], value: count(current[field]), previous: previous ? count(previous[field]) : null })),
    excludedTestRecords: count(current.excluded), exclusion: 'labelled_measurement_test_20260916' as const,
  };
}
