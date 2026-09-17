import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createResendSentEmailReader } from '@sp/email-provider';
import { z } from 'zod';
import type { ProjectMessageAnchor } from './messageAssociation';
import { readEnquirySendEvidence } from './enquirySendEvidence';
import { verifiedSendIdentityCache } from './verifiedSendIdentityCache';

const rowSchema = z.object({ project_id: z.uuid(), provider_message_id: z.uuid(), to_emails: z.array(z.email()).min(1).max(100), created_at: z.string() });
const MAX_LOOKUPS = 8;

/** Auth-bound reads only. No bodies, tokens, service-role queries, sends or persistence. */
export async function readProjectSendAnchors(supabase: SupabaseClient, projectId: string, signal: AbortSignal,
  dependencies: { apiKey?: string; fetcher?: typeof fetch; cacheSecret?: string; cache?: typeof verifiedSendIdentityCache } = {}): Promise<{ anchors: ProjectMessageAnchor[]; incomplete: boolean }> {
  z.uuid().parse(projectId);
  const apiKey = dependencies.apiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey) return { anchors: [], incomplete: true };
  const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(8_000)]);
  const results = await Promise.allSettled(['quote_send_logs', 'deposit_invoice_send_logs'].map(table =>
    supabase.from(table).select('project_id,provider_message_id,to_emails,created_at')
      .eq('project_id', projectId).eq('status', 'SENT').eq('provider', 'resend')
      .order('created_at', { ascending: false }).limit(MAX_LOOKUPS + 1).abortSignal(boundedSignal)));
  let incomplete = false;
  const candidates: z.infer<typeof rowSchema>[] = [];
  for (const result of results) {
    if (result.status === 'rejected' || result.value.error) { incomplete = true; continue; }
    for (const value of result.value.data ?? []) {
      const row = rowSchema.safeParse(value);
      if (!row.success || row.data.project_id !== projectId) { incomplete = true; continue; }
      candidates.push(row.data);
    }
  }
  const enquiry = await readEnquirySendEvidence(supabase, projectId, boundedSignal);
  candidates.push(...enquiry.candidates);
  incomplete ||= enquiry.incomplete;
  const seen = new Map<string, z.infer<typeof rowSchema>>();
  for (const row of candidates.sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const prior = seen.get(row.provider_message_id);
    if (prior && JSON.stringify([...prior.to_emails].map(value => value.toLowerCase()).sort()) !== JSON.stringify([...row.to_emails].map(value => value.toLowerCase()).sort())) {
      // Conflicting canonical send evidence must not become an anchor.
      return { anchors: [], incomplete: true };
    }
    seen.set(row.provider_message_id, row);
  }
  if (seen.size > MAX_LOOKUPS) incomplete = true;
  const pending = [...seen.values()].slice(0, MAX_LOOKUPS);
  const read = createResendSentEmailReader({ apiKey, fetch: dependencies.fetcher, timeoutMs: 3_000 });
  const anchors: ProjectMessageAnchor[] = [];
  const counts = { cacheHits: 0, providerReads: 0, verified: 0, unavailable: 0 };
  const failures: Record<string, number> = {};
  let cursor = 0;
  await Promise.all([0, 1].map(async () => {
    while (cursor < pending.length) {
      if (boundedSignal.aborted) { incomplete = true; break; }
      const row = pending[cursor++];
      // Canonical auth-bound rows above are re-read even on a cache hit. Changed
      // project/recipient/provider credentials cannot reuse the previous proof.
      const cache = dependencies.cache ?? verifiedSendIdentityCache;
      const binding = { projectId, providerMessageId: row.provider_message_id, recipients: row.to_emails,
        providerKey: apiKey, secret: dependencies.cacheSecret ?? process.env.PORTAL_VELT_CORRESPONDENCE_SECRET ?? '' };
      const saved = cache.get(binding);
      if (saved) { counts.cacheHits += 1; anchors.push({ projectId, internetMessageId: saved }); continue; }
      counts.providerReads += 1;
      const result = await read({ providerMessageId: row.provider_message_id, expectedRecipients: row.to_emails }, boundedSignal);
      if (result.state === 'verified') {
        counts.verified += 1;
        cache.set(binding, result.internetMessageId);
        anchors.push({ projectId, internetMessageId: result.internetMessageId });
      }
      else {
        incomplete = true;
        counts.unavailable += 1;
        failures[result.reason] = (failures[result.reason] ?? 0) + 1;
      }
    }
  }));
  signal.throwIfAborted();
  if (process.env.PORTAL_CORRESPONDENCE_TIMING_LOGS === 'true') {
    // Aggregate counts and fixed provider result codes only, never IDs or bodies.
    console.info(JSON.stringify({ event: 'portal.correspondence_matching', ...counts, failures }));
  }
  return { anchors, incomplete };
}
