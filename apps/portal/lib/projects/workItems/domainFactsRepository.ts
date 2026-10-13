import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { isRecord } from '@/lib/supabase/mappers';

const FACTS_RPC = 'staff_project_work_domain_facts_v1';
const BATCH_SIZE = 500;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CHILD_ROWS = 50_000;
const MAX_REQUESTS = 128;
const MAX_SPLIT_DEPTH = 9;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Row = Record<string, unknown>;
export type ProjectWorkDomainFacts = { projects: Row[]; confirmations: Row[] };

function incomplete(): Error & { code: string } {
  return Object.assign(new Error('Project Work source facts are unavailable or incomplete'), {
    code: 'PROJECT_WORK_INVENTORY_INCOMPLETE',
  });
}

function requireFact(condition: unknown): asserts condition {
  if (!condition) throw incomplete();
}

function records(value: unknown): Row[] {
  requireFact(Array.isArray(value) && value.every(isRecord));
  return value;
}

function stringFields(row: Row, required: string[], nullable: string[] = []): void {
  for (const key of required) requireFact(typeof row[key] === 'string');
  for (const key of nullable) requireFact(row[key] === null || typeof row[key] === 'string');
}

function numberFields(row: Row, keys: string[]): void {
  for (const key of keys) requireFact(row[key] === null || (typeof row[key] === 'number' && Number.isSafeInteger(row[key])));
}

function identity(value: unknown, seen: Set<string>): string {
  requireFact(typeof value === 'string' && UUID.test(value) && !seen.has(value));
  seen.add(value);
  return value;
}

/** Validate transport completeness, not commercial policy. Unknown statuses and
 * nullable business fields still belong to the canonical TS normalizers. */
function parseFacts(value: unknown, requested: readonly string[]): ProjectWorkDomainFacts {
  requireFact(isRecord(value) && value.version === 1 && value.requestedCount === requested.length);
  requireFact(Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_BYTES);
  const rows = records(value.rows);
  requireFact(rows.length === requested.length);
  const pending = new Set(requested);
  const seen = new Set<string>();
  const estimateIds = new Set<string>();
  const quoteIds = new Set<string>();
  const versionIds = new Set<string>();
  const confirmationIds = new Set<string>();
  const out: ProjectWorkDomainFacts = { projects: [], confirmations: [] };
  let childCount = 0;
  for (const row of rows) {
    const projectId = identity(row.projectId, seen);
    requireFact(pending.delete(projectId) && typeof row.eligible === 'boolean' && isRecord(row.counts));
    const counts = { estimates: 0, quotes: 0, quoteVersions: 0, sendLogs: 0, confirmations: 0 };
    const confirmations = records(row.confirmations);
    if (!row.eligible) {
      requireFact(row.project === null && confirmations.length === 0);
    } else {
      requireFact(isRecord(row.project) && row.project.id === projectId);
      const project = row.project;
      stringFields(project, ['id', 'name', 'pipeline_stage']);
      const owners = records(project.ownerAssignment);
      requireFact(owners.length <= 1);
      for (const owner of owners) stringFields(owner, [], ['owner_key']);
      const estimates = records(project.estimates);
      const quotes = records(project.quotes);
      for (const estimate of estimates) {
        identity(estimate.id, estimateIds);
        requireFact(estimate.project_id === projectId);
        stringFields(estimate, [], ['commercial_scope_id', 'created_at', 'status']);
        numberFields(estimate, ['version']);
      }
      for (const quote of quotes) {
        const quoteId = identity(quote.id, quoteIds);
        stringFields(quote, [], ['quote_ref', 'commercial_scope_id']);
        const versions = records(quote.quoteVersions);
        counts.quoteVersions += versions.length;
        for (const version of versions) {
          identity(version.id, versionIds);
          requireFact(version.quote_id === quoteId);
          stringFields(version, [], ['status', 'source_estimate_version_id', 'created_at', 'sent_at', 'accepted_at']);
          numberFields(version, ['version_number', 'total_inc_gst_cents']);
          const logs = records(version.sendLogs);
          counts.sendLogs += logs.length;
          for (const log of logs) stringFields(log, [], ['status', 'created_at', 'sent_at']);
        }
      }
      for (const confirmation of confirmations) {
        identity(confirmation.id, confirmationIds);
        requireFact(confirmation.project_id === projectId && confirmation.confirmation_type === 'SITE_VISIT_COMPLETED');
        stringFields(confirmation, ['event_kind'], ['retracts_event_id']);
      }
      counts.estimates = estimates.length;
      counts.quotes = quotes.length;
      counts.confirmations = confirmations.length;
      out.projects.push(project);
      out.confirmations.push(...confirmations);
    }
    for (const key of Object.keys(counts) as (keyof typeof counts)[]) {
      requireFact(row.counts[key] === counts[key]);
      childCount += counts[key];
    }
  }
  requireFact(pending.size === 0 && childCount <= MAX_CHILD_ROWS);
  return out;
}

function isMissingFactsFunction(error: { code: string; message: string }): boolean {
  return (error.code === 'PGRST202' || error.code === '42883')
    && /\bstaff_project_work_domain_facts_v1\b/.test(error.message);
}

/** One request-local, sequential budget, including rejected parent batches.
 * Overflow splits IDs only; no history rows or global queue candidates are cut. */
export async function loadProjectWorkDomainFacts(
  supabase: SupabaseClient,
  projectIds: readonly string[],
): Promise<ProjectWorkDomainFacts> {
  const ids = [...new Set(projectIds)].sort();
  requireFact(ids.length < 5000 && ids.every((id) => UUID.test(id)));
  const out: ProjectWorkDomainFacts = { projects: [], confirmations: [] };
  let requests = 0;
  async function readBatch(batch: string[], depth: number): Promise<void> {
    requireFact(++requests <= MAX_REQUESTS);
    const { data, error } = await supabase.rpc(FACTS_RPC, { p_project_ids: batch });
    if (error) {
      if (error.code === 'P0001' && error.message === 'PROJECT_WORK_FACTS_BATCH_TOO_LARGE') {
        requireFact(batch.length > 1 && depth < MAX_SPLIT_DEPTH);
        const middle = Math.floor(batch.length / 2);
        await readBatch(batch.slice(0, middle), depth + 1);
        await readBatch(batch.slice(middle), depth + 1);
        return;
      }
      if (isMissingFactsFunction(error) || error.message === 'PROJECT_WORK_INVENTORY_INCOMPLETE') throw incomplete();
      // Preserve access, cancellation and transport errors. Never retry through a
      // less complete legacy reader or turn a failed page into an empty queue.
      throw Object.assign(new Error(error.message || 'Project Work source facts could not be read'), error);
    }
    const facts = parseFacts(data, batch);
    out.projects.push(...facts.projects);
    out.confirmations.push(...facts.confirmations);
  }
  for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
    await readBatch(ids.slice(offset, offset + BATCH_SIZE), 0);
  }
  return out;
}
