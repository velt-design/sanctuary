// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { approvedDrawingSource } from './fixtures/studio-approved-drawings';
import { approvedStudioDocumentPages, parseStudioClientDocumentSource, studioDocumentPages, type StudioClientDocumentSource } from '../packages/studio-documents/src/contract';
import { packStudioDrawing, unpackStudioDrawing } from '../packages/studio-documents/src/transport';
import { renderStudioDocumentPage, assembleStudioDocumentPages } from '../packages/studio-documents/src/render';

function drawingOnly(): StudioClientDocumentSource {
  const source = { ...approvedDrawingSource(), layoutVersion: 'studio-booklet-layout.v4' as const };
  source.pageManifest = approvedStudioDocumentPages(source);
  return source;
}
const migration = readFileSync(new URL('../supabase/migrations/20261029223138_studio_booklet_drawing_only_inventory.sql', import.meta.url), 'utf8');
const previous = readFileSync(new URL('../supabase/migrations/20261029042636_studio_booklet_approved_inventory.sql', import.meta.url), 'utf8');
function functionBlock(sql: string, name: string) {
  const start = sql.search(new RegExp(`create (?:or replace )?function ${name.replaceAll('.', '\\.')}\\(`));
  if (start < 0) throw Error(`Missing migration owner ${name}`);
  const end = sql.indexOf('end $$;', start);
  return sql.slice(start, end + 7);
}

it('freezes thirteen real sheets beginning with P01 Plan, preserves v3 fourteen-sheet inventories and verifies packed identities', async () => {
  const old = approvedDrawingSource(), source = drawingOnly();
  expect(studioDocumentPages(old)).toHaveLength(14);
  expect(studioDocumentPages(old)[0]).toMatchObject({ index: 0, kind: 'cover', code: 'A00' });
  expect(source.pageManifest).toHaveLength(13);
  expect(source.pageManifest![0]).toMatchObject({ index: 0, kind: 'plan', objectId: source.products[0].id, code: 'A01' });
  expect(source.pageManifest!.at(-1)).toMatchObject({ index: 12, code: 'A13' });
  expect(source.pageManifest!.some(page => page.kind === 'cover')).toBe(false);
  expect(parseStudioClientDocumentSource(source)).toEqual(source);
  for (const value of [old, source]) expect(await unpackStudioDrawing(await packStudioDrawing(value))).toEqual(value);
  const packed = await packStudioDrawing(source);
  expect(packed.schemaVersion).toBe('studio_client_document_archive.v1');
  await expect(unpackStudioDrawing({ ...packed, layoutVersion: 'studio-booklet-layout.v3' })).rejects.toThrow();
  expect(() => parseStudioClientDocumentSource({ ...source, pageManifest: old.pageManifest })).toThrow('inventory');
  const financialOnly = { ...source, products: [], pageManifest: [] };
  expect(parseStudioClientDocumentSource(financialOnly)).toEqual(financialOnly);
  expect(studioDocumentPages(financialOnly)).toEqual([]);
  await expect(renderStudioDocumentPage(financialOnly, 0)).rejects.toThrow('Invalid document page');
  await expect(assembleStudioDocumentPages([])).rejects.toThrow('No pergola drawings');
});

it('retains all192 conditional sheets at capacity with contiguous real-sheet ordinals and no phantom opening', () => {
  const source = drawingOnly();
  source.products = Array.from({ length: 32 }, (_, i) => ({ ...structuredClone(source.products[0]), id: `p${i + 1}`, code: `P${i + 1}` }));
  source.pageManifest = approvedStudioDocumentPages(source);
  expect(source.pageManifest).toHaveLength(192);
  expect(source.pageManifest!.at(-1)).toMatchObject({ index: 191, code: 'A192' });
  expect(source.pageManifest!.map(page => page.index)).toEqual(Array.from({ length: 192 }, (_, i) => i));
  expect(parseStudioClientDocumentSource(source)).toEqual(source);
  const old = { ...source, layoutVersion: 'studio-booklet-layout.v3' as const };
  old.pageManifest = approvedStudioDocumentPages(old);
  expect(parseStudioClientDocumentSource(old).pageManifest).toHaveLength(193);
});

it('renders the first approved annotated plan with the Sanctuary title bar and01/13, without an opening or false A00 reference', async () => {
  const source = drawingOnly();
  source.projectName = 'Long project name '.repeat(14).slice(0, 280);
  const bytes = await renderStudioDocumentPage(source, 0);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const content = await (await document.getPage(1)).getTextContent();
  const text = content.items.map(item => 'str' in item ? item.str : '').join(' ');
  await document.destroy();
  expect(text).toContain('SANCTUARY PERGOLAS');
  expect(text).toContain('P01');
  expect(text).toContain('A01');
  expect(text).toContain('01 / 13');
  expect(text).toContain('HEAD HEIGHTS');
  expect(text).not.toContain('DRAWING REGISTER');
  expect(text).not.toContain('Project details: A00');
}, 15000);

it('rehearses the forward SQL inventory and pre-claim capability fence without changing historical counts or queue visibility', async () => {
  const db = new PGlite();
  try {
    await db.exec('create schema private; create schema pgmq;');
    for (const name of ['private.studio_document_manifest_valid', 'private.studio_document_total_pages']) await db.exec(functionBlock(migration, name));
    for (const source of [approvedDrawingSource(), drawingOnly()]) {
      const result = await db.query<{ valid: boolean; pages: number }>('select private.studio_document_manifest_valid($1::jsonb) valid,private.studio_document_total_pages($1::jsonb) pages', [JSON.stringify(source)]);
      expect(result.rows[0]).toEqual({ valid: true, pages: source.pageManifest!.length });
    }
    const empty = { ...drawingOnly(), products: [], pageManifest: [] };
    expect((await db.query<{ valid: boolean; pages: number }>('select private.studio_document_manifest_valid($1::jsonb) valid,private.studio_document_total_pages($1::jsonb) pages', [JSON.stringify(empty)])).rows[0]).toEqual({ valid: true, pages: 0 });
    const archiveSql = readFileSync(new URL('../supabase/migrations/20261028132459_studio_client_document_archives.sql', import.meta.url), 'utf8');
    await db.exec(functionBlock(archiveSql, 'private.studio_json_archive_valid'));
    await db.exec(functionBlock(previous, 'private.studio_drawing_archive_valid_pre_v3'));
    await db.exec(functionBlock(migration, 'private.studio_drawing_archive_valid'));
    for (const source of [approvedDrawingSource(), drawingOnly()]) {
      const packed = await packStudioDrawing(source);
      expect((await db.query<{ valid: boolean }>('select private.studio_drawing_archive_valid($1::jsonb) valid', [JSON.stringify(packed)])).rows[0].valid).toBe(true);
    }
    const malformed = drawingOnly(); malformed.pageManifest![0].code = 'A00';
    expect((await db.query<{ valid: boolean }>('select private.studio_document_manifest_valid($1::jsonb) valid', [JSON.stringify(malformed)])).rows[0].valid).toBe(false);
    await db.exec(`create table public.background_jobs(id uuid,kind text,subject_id text,subject_type text,project_id uuid,queue_message_id bigint);
      create table private.studio_client_document_sources(snapshot_id uuid,drawing_source jsonb);
      create table pgmq.q_portal_background_jobs(msg_id bigint,message jsonb,vt timestamptz,read_ct integer);`);
    await db.exec(functionBlock(migration, 'private.background_job_read_claim_queue'));
    const project = '10000000-0000-4000-8000-000000000001', job = '10000000-0000-4000-8000-000000000002', snapshot = '10000000-0000-4000-8000-000000000003';
    await db.query('insert into private.studio_client_document_sources values($1,$2)', [snapshot, JSON.stringify(drawingOnly())]);
    await db.query("insert into public.background_jobs values($1,'studio_design_booklet_v1',$2,'studio_snapshot',$3,1)", [job, snapshot, project]);
    await db.query("insert into pgmq.q_portal_background_jobs values(1,$1,now()-interval '1 minute',0)", [JSON.stringify({ jobId: job })]);
    await db.exec('begin');
    await db.query("select set_config('sanctuary.background_job_claim_kinds',$1,true),set_config('sanctuary.background_job_claim_projects',$2,true)", [JSON.stringify(['studio_design_booklet_v1']), JSON.stringify([project])]);
    expect((await db.query('select * from private.background_job_read_claim_queue(60,1)')).rows).toEqual([]);
    expect((await db.query<{ read_ct: number }>('select read_ct from pgmq.q_portal_background_jobs')).rows[0].read_ct).toBe(0);
    await db.query("select set_config('sanctuary.studio_document_manifest_versions',$1,true)", [JSON.stringify(['studio-booklet-layout.v4'])]);
    expect((await db.query('select * from private.background_job_read_claim_queue(60,1)')).rows).toHaveLength(1);
    expect((await db.query<{ read_ct: number }>('select read_ct from pgmq.q_portal_background_jobs')).rows[0].read_ct).toBe(1);
    await db.exec('rollback');
    // Existing v3 SQL remains preserved in its applied migration, never rewritten.
    expect(previous).toContain('jsonb_array_length(manifest) not between 1 and 193');
    expect(migration).toContain("coalesce(previous_versions,'')");
    expect(migration).toContain("from public,anon,authenticated;");
  } finally { await db.close(); }
}, 15000);

it('keeps the canonical financial commit and audit while suppressing empty document/job creation and exposing a staff-only unavailable state', async () => {
  const db = new PGlite();
  const project='10000000-0000-4000-8000-000000000001',snapshot='10000000-0000-4000-8000-000000000002',quote='10000000-0000-4000-8000-000000000003',actor='10000000-0000-4000-8000-000000000004';
  try {
    await db.exec(`create schema private;
      create table public.quote_versions(id uuid);
      create table public.background_jobs(id uuid,status text,attempt_count integer);
      create table public.projects(id uuid,pipeline_stage text);
      create table public.audit_events(project_id uuid,type text,idempotency_key text,payload jsonb);
      create table public.portal_users(user_id uuid,role text);
      create table public.file_artifacts(id uuid,project_id uuid,filename text,content_base64 text);
      create table private.studio_website_quote_snapshots(id uuid,content_hash text,customer_view jsonb,project_id uuid);
      create table private.studio_client_document_sources(snapshot_id uuid,drawing_source jsonb,renderer_version text);
      create table private.studio_client_document_control(singleton boolean,enabled boolean,project_ids uuid[]);
      create table private.studio_website_quote_bindings(quote_version_id uuid,snapshot_id uuid);
      create table private.studio_client_documents(snapshot_id uuid,project_id uuid,quote_version_id uuid,renderer_version text,total_pages integer check(total_pages between 1 and 193),job_id uuid,file_id uuid,enqueue_failed boolean);
      create table private.studio_client_document_pages(snapshot_id uuid);
      create table private.enqueue_probe(snapshot_id uuid);
      create function private.studio_client_document_enqueue(p uuid) returns void language sql as 'insert into private.enqueue_probe values(p)';
      create function public.studio_website_quote_commit_address(text,uuid,text,jsonb) returns public.quote_versions language sql as 'select * from public.quote_versions limit 1';`);
    for(const name of ['private.studio_document_manifest_valid','private.studio_document_total_pages','public.studio_client_quote_commit','public.studio_client_document_status'])await db.exec(functionBlock(migration,name));
    const empty={...drawingOnly(),products:[],pageManifest:[]};
    await db.query('insert into public.quote_versions values($1)',[quote]);
    await db.query("insert into public.projects values($1,'DESIGNING')",[project]);
    await db.query("insert into public.portal_users values($1,'staff')",[actor]);
    await db.query("insert into private.studio_website_quote_snapshots values($1,$2,$3,$4)",[snapshot,'a'.repeat(64),JSON.stringify({schemaVersion:'studio_quote_snapshot.v2'}),project]);
    await db.query("insert into private.studio_client_document_sources values($1,$2,'studio-booklet.v1')",[snapshot,JSON.stringify(empty)]);
    await db.query('insert into private.studio_client_document_control values(true,true,$1)',[[project]]);
    await db.query('insert into private.studio_website_quote_bindings values($1,$2)',[quote,snapshot]);
    expect((await db.query<{ id: string }>("select (public.studio_client_quote_commit('create',$1,$2,'{}')).id",[snapshot,'a'.repeat(64)])).rows[0].id).toBe(quote);
    expect((await db.query('select * from private.studio_client_documents')).rows).toEqual([]);
    expect((await db.query('select * from private.enqueue_probe')).rows).toEqual([]);
    expect((await db.query('select * from public.audit_events')).rows).toHaveLength(2);
    const state=await db.query<{ result: { state: string; totalPages: number; canRetry: boolean } }>('select public.studio_client_document_status($1,$2,false) result',[quote,actor]);
    expect(state.rows[0].result).toMatchObject({state:'unavailable',totalPages:0,canRetry:false});
    await expect(db.query('select public.studio_client_document_status($1,$2,false)',[quote,quote])).rejects.toThrow('studio_staff_required');
    await expect(db.query('insert into private.studio_client_documents(total_pages) values(0)')).rejects.toThrow();
    await db.query('update private.studio_client_document_sources set drawing_source=$1',[JSON.stringify(drawingOnly())]);
    await db.query("select public.studio_client_quote_commit('update',$1,$2,'{}')",[snapshot,'a'.repeat(64)]);
    expect((await db.query<{ total_pages: number }>('select total_pages from private.studio_client_documents')).rows[0].total_pages).toBe(13);
    expect((await db.query('select * from private.enqueue_probe')).rows).toHaveLength(1);
  } finally { await db.close(); }
},15000);
