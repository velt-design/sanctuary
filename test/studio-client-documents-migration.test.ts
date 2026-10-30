// @vitest-environment node
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
const domain=readFileSync(new URL('../supabase/migrations/20261028090403_studio_client_documents.sql',import.meta.url),'utf8'),claim=readFileSync(new URL('../supabase/migrations/20261028090414_background_jobs_scoped_claim.sql',import.meta.url),'utf8');
it('keeps new producers default dark and lease-owned page/final writes cancellation-fenced',()=>{
 expect(domain).toContain('enabled boolean not null default false');expect(domain).not.toContain('9b323ce7');
 const owned=domain.slice(domain.indexOf('create function private.studio_client_document_owned'),domain.indexOf('create function public.studio_client_document_worker_read'));
 expect(owned.indexOf('background_job_lock_owned')).toBeLessThan(owned.indexOf('cancellation_requested_at is not null'));expect(owned.indexOf('cancellation_requested_at is not null')).toBeLessThan(owned.indexOf('select * into d'));
 for(const name of ['page_stage','finish']){const body=domain.slice(domain.indexOf(`create function public.studio_client_document_${name}`));expect(body.indexOf('studio_client_document_owned')).toBeLessThan(body.indexOf(name==='finish'?'insert into public.file_artifacts':'insert into private.studio_client_document_pages'));}
});
it('serialises new same-project commits before delegated quote/address locks and preserves quote intent across enqueue failure',()=>{
 const commit=domain.slice(domain.indexOf('create function public.studio_client_quote_commit'),domain.indexOf('create function private.studio_client_document_owned'));
 expect(commit.indexOf("'studio-client-quote-project:'")).toBeLessThan(commit.indexOf('studio_website_quote_commit_address'));
 expect(commit).toContain('insert into private.studio_client_documents');expect(commit).toContain('studio_client_document_enqueue(s.id)');expect(domain).toContain('exception when others then');expect(domain).toContain('set enqueue_failed=true');
});
it('scopes the queue read before visibility mutation and leaves the canonical claim state machine otherwise exact',()=>{
 const original=readFileSync(new URL('../supabase/migrations/20260720_000007_background_job_provider_reconciliation.sql',import.meta.url),'utf8');
 const start='create or replace function public.background_jobs_claim(',a=original.indexOf(start),b=original.indexOf('$$;',a)+3,originalBody=original.slice(a,b);
 const c=claim.indexOf(start),d=claim.indexOf('$$;',c)+3,updated=claim.slice(c,d);
 expect(updated.replace('private.background_job_read_claim_queue(p_visibility_timeout_seconds, p_batch_size)',"pgmq.read('portal_background_jobs', p_visibility_timeout_seconds, p_batch_size)")).toBe(originalBody);
 const reader=claim.slice(0,c);expect(reader.indexOf("'studio_design_booklet_v1'")).toBeLessThan(reader.indexOf('update pgmq.q_portal_background_jobs'));expect(reader).toContain('for update of q skip locked');expect(reader).toContain('p_project_ids');
});
