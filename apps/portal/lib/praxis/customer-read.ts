import 'server-only';
import {
  PraxisConnectorError, withPraxisReadTransaction,
  type ConnectorConfig, type PraxisServerDependencies,
} from './server';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parameter(url: URL, name: string): string {
  if ([...url.searchParams.keys()].some(key => key !== name) || url.searchParams.getAll(name).length !== 1) {
    throw new PraxisConnectorError(400, 'INVALID_QUERY', 'Supply one supported search parameter.');
  }
  return url.searchParams.get(name)!;
}
export function parseCustomerSearch(url: URL): string {
  const value = parameter(url, 'q').trim();
  if (value.length < 2 || value.length > 100 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new PraxisConnectorError(400, 'INVALID_QUERY', 'Enter between 2 and 100 characters.');
  }
  return value;
}
export function parseReceiptProject(url: URL): string {
  const value = parameter(url, 'projectId');
  if (!uuid.test(value)) throw new PraxisConnectorError(400, 'INVALID_QUERY', 'A canonical project ID is required.');
  return value.toLowerCase();
}
function source(config: ConnectorConfig, asOf: string) {
  return { sourceKey: config.sourceKey, connectionId: config.connectionId, environment: config.environment,
    authority: 'canonical' as const, asOf, retrievedAt: new Date().toISOString() };
}
type CustomerRow = {
  project_id: string; contact_id: string; project_name: string; customer_name: string;
  email: string | null; stage: string | null; archived: boolean; recorded_at: Date | string;
};
export async function searchPraxisCustomers(q: string, config: ConnectorConfig, requestId: string, dependencies?: PraxisServerDependencies) {
  // Revalidate internal callers as well as the HTTP route. SQL parameters are
  // literal substring matches: wildcard characters do not broaden the query.
  q = parseCustomerSearch(new URL(`https://validation.invalid/?${new URLSearchParams({ q })}`));
  const result = await withPraxisReadTransaction(config, async transaction => {
    const times = await transaction<{ as_of: Date | string }[]>`select transaction_timestamp() as as_of`;
    const rows = await transaction<CustomerRow[]>`
      select project.id as project_id, contact.id as contact_id,
        project.payload->>'name' as project_name, contact.payload->>'name' as customer_name,
        contact.payload->>'email' as email, project.payload->>'pipelineStage' as stage,
        (project.payload->>'archivedAt' is not null) as archived,
        greatest(project.recorded_at, contact.recorded_at) as recorded_at
      from praxis_reporting.projects_v1 project
      join praxis_reporting.contacts_v1 contact on contact.id::text = project.payload->>'contactId'
      where project.omission_count = 0 and contact.omission_count = 0
        and (strpos(lower(project.payload->>'name'), lower(${q})) > 0
          or strpos(lower(contact.payload->>'name'), lower(${q})) > 0
          or strpos(lower(contact.payload->>'email'), lower(${q})) > 0)
      order by (project.payload->>'archivedAt' is not null), lower(project.payload->>'name'), project.id
      limit 21
    `;
    return { asOf: new Date(times[0]!.as_of).toISOString(), rows };
  }, dependencies);
  return {
    schemaVersion: 'sanctuary.praxis.customers.v1' as const, requestId,
    source: source(config, result.asOf), hasMore: result.rows.length > 20,
    customers: result.rows.slice(0, 20).map(row => {
      if (!uuid.test(row.project_id) || !uuid.test(row.contact_id)
        || typeof row.project_name !== 'string' || row.project_name.length > 1024
        || typeof row.customer_name !== 'string' || row.customer_name.length > 1024
        || (row.email !== null && (typeof row.email !== 'string' || row.email.length > 254))) {
        throw new PraxisConnectorError(503, 'PROJECTION_NOT_READY', 'Customer identity evidence is unavailable.', true);
      }
      return { projectId: row.project_id, contactId: row.contact_id, projectName: row.project_name,
        customerName: row.customer_name, email: row.email, stage: row.stage, archived: row.archived,
        recordedAt: new Date(row.recorded_at).toISOString() };
    }),
  };
}

type ReceiptRow = {
  id: string; project_id: string; invoice_id: string; payment_entry_id: string;
  receipt_id: string; tenant_id: string; amount_inc_gst_cents: number;
  receipt_date: string; approved_at: Date | string;
  source_kind: 'BANK_TRANSACTION' | 'INVOICE_PAYMENT'; recording_method: 'MANUAL' | 'AUTOMATIC';
  evidence_fingerprint: string; currency: string;
};
export async function readPraxisVerifiedReceipts(projectId: string, config: ConnectorConfig, requestId: string, dependencies?: PraxisServerDependencies) {
  projectId = parseReceiptProject(new URL(`https://validation.invalid/?${new URLSearchParams({ projectId })}`));
  const result = await withPraxisReadTransaction(config, async transaction => {
    const times = await transaction<{ as_of: Date | string }[]>`select transaction_timestamp() as as_of`;
    const projects = await transaction<{ id: string }[]>`select id from praxis_reporting.projects_v1 where id = ${projectId}::uuid limit 1`;
    if (projects.length !== 1) throw new PraxisConnectorError(400, 'INVALID_QUERY', 'The project is unavailable.');
    const rows = await transaction<ReceiptRow[]>`
      select id, project_id, invoice_id, payment_entry_id, receipt_id, tenant_id,
        amount_inc_gst_cents, receipt_date::text, approved_at, source_kind, recording_method, evidence_fingerprint, currency
      from praxis_reporting.verified_receipts_v1 where project_id = ${projectId}::uuid
      order by receipt_date, id limit 101
    `;
    return { asOf: new Date(times[0]!.as_of).toISOString(), rows };
  }, dependencies);
  if (result.rows.length > 100) throw new PraxisConnectorError(400, 'SNAPSHOT_TOO_LARGE', 'The receipt snapshot exceeds its limit.');
  const receipts = result.rows.map(row => {
    if (row.project_id !== projectId || ![row.id, row.invoice_id, row.payment_entry_id, row.receipt_id, row.tenant_id].every(id => uuid.test(id))
      || !Number.isSafeInteger(row.amount_inc_gst_cents) || row.amount_inc_gst_cents <= 0
      || !['BANK_TRANSACTION', 'INVOICE_PAYMENT'].includes(row.source_kind)
      || !['MANUAL', 'AUTOMATIC'].includes(row.recording_method)
      || !/^[a-f0-9]{64}$/.test(row.evidence_fingerprint) || !/^[A-Z]{3}$/.test(row.currency)
      || !/^\d{4}-\d{2}-\d{2}$/.test(row.receipt_date)) {
      throw new PraxisConnectorError(503, 'PROJECTION_NOT_READY', 'Payment evidence is inconsistent.', true);
    }
    return { matchId: row.id, projectId, invoiceId: row.invoice_id, paymentEntryId: row.payment_entry_id,
      receiptId: row.receipt_id, tenantId: row.tenant_id, amountIncGstCents: row.amount_inc_gst_cents, currency: row.currency,
      receivedDate: row.receipt_date, verifiedAt: new Date(row.approved_at).toISOString(),
      sourceKind: row.source_kind, recordingMethod: row.recording_method, evidenceFingerprint: row.evidence_fingerprint };
  });
  return { schemaVersion: 'sanctuary.praxis.receipts.v1' as const, requestId, projectId,
    source: source(config, result.asOf), verification: 'portal_recorded_xero_match' as const,
    coverage: 'complete_active_recorded_matches' as const, receipts,
    limitation: 'This is portal-recorded Xero verification, not a fresh bank read. No matching receipt does not prove that the customer has never paid.' };
}
