// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { prepareStudioCreation } from './createPreparation';

const original=readFileSync(new URL('../../../../supabase/migrations/20261020080002_studio_authored_create.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const forward=readFileSync(new URL('../../../../supabase/migrations/20261101210344_studio_base_creation_seed.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const block=(source:string)=>{const a=source.indexOf('function public.studio_authored_create('),b=source.indexOf('$$;',a);return source.slice(a,b+3);};
const oldPredicate=block(original).match(/ {6}or v_spatial is distinct from '[^']+'::jsonb\n {6}or \(v_authored - 'designId'\) is distinct from '[^']+'::jsonb then/)![0];
it('changes only the exact paired blank predicate and retains the original signature, security, receipt/lock and clone/import body',()=>{
 expect(block(forward).replace(/ {6}or not \([\s\S]+? {6}\) then/,oldPredicate)).toBe(block(original));
 expect(forward.match(/create or replace function/g)).toHaveLength(1);
 expect(forward).not.toMatch(/alter table|grant |revoke |create table|drop /i);
});
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function prepared(scope:string|null=null,designId='seed-design') {
 const value=prepareStudioCreation({mode:'blank',projectId:id(1),designId,commercialScopeId:scope});if(!value.ok)throw Error(value.message);return value.prepared.row;
}
function historicalEmpty() {
 const row=prepared(null,'old-empty');(row.outputs.studio_authored as any).objectOptions=[];(row.outputs.drawing_object_first as any).pergolas=[];return row;
}
it('executes original refusal then the forward command, preserving old replay, exact seed, add-on, clone, denial atomicity and ACL',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create schema private;create role anon;create role authenticated;create role service_role;
   create table public.portal_users(user_id uuid primary key,role text);
   create table public.projects(id uuid primary key,archived_at timestamptz);
   create table public.estimates(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),commercial_scope_id uuid,status text,version integer,created_by text,inputs jsonb,outputs jsonb,internal_name text,updated_at timestamptz default now());
   create table public.quotes(id uuid primary key,project_id uuid,commercial_scope_id uuid);
   insert into public.projects values('${id(1)}',null),('${id(8)}',null);
   insert into public.portal_users values('${id(2)}','staff'),('${id(9)}','installer'),('${id(15)}','staff');`);
  const tableStart=original.indexOf('create table private.studio_authored_create_receipts');
  await db.exec(original.slice(tableStart,original.indexOf('create function public.studio_authored_create')));
  await db.exec('create '+block(original));
  await db.exec('revoke all on function public.studio_authored_create(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;grant execute on function public.studio_authored_create(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb) to service_role;');
  const request=(n:number,scope='base')=>({schemaVersion:'studio_create.v1',requestId:id(n),mode:'blank',scope});
  const call=(client:unknown,row:unknown,options:{actor?:string;project?:string;source?:string;proof?:unknown}={})=>db.query<any>('select * from public.studio_authored_create($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::jsonb,$6::jsonb,$7::jsonb)',[options.project??id(1),options.actor??id(2),(client as any).requestId,options.source??null,JSON.stringify(client),row===null?null:JSON.stringify(row),options.proof?JSON.stringify(options.proof):null]);
  const snapshot=async()=> (await db.query(`select (select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]') from public.estimates e) estimates,(select coalesce(jsonb_agg(to_jsonb(r) order by request_id),'[]') from private.studio_authored_create_receipts r) receipts`)).rows[0];
  const denied=async(client:unknown,row:unknown,options:Parameters<typeof call>[2]={})=>{const before=await snapshot();await expect(call(client,row,options)).rejects.toThrow();expect(await snapshot()).toEqual(before);};
  await denied(request(3),prepared()); // Actual old function rejects the new starter.
  const oldRow=historicalEmpty(),oldClient=request(4),oldReceipt=(await call(oldClient,oldRow)).rows[0];
  const catalogue=async()=> (await db.query(`select oid::text,proowner::text,proacl::text,proconfig::text,prosecdef from pg_proc where oid='public.studio_authored_create(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure`)).rows[0];
  const beforeCatalogue=await catalogue();await db.exec(forward);expect(await catalogue()).toEqual(beforeCatalogue);
  const replay=(await call(oldClient,prepared(null,'different-server-id'))).rows[0];expect(replay).toEqual({...oldReceipt,already_existed:true});
  expect((await db.query<any>('select outputs from public.estimates where id=$1',[oldReceipt.estimate_id])).rows[0].outputs).toEqual(oldRow.outputs);
  const seed=prepared(),seedClient=request(5),receipt=(await call(seedClient,seed)).rows[0];
  expect(receipt).toMatchObject({design_id:'seed-design',revision:1,already_existed:false});
  expect((await db.query<any>('select outputs from public.estimates where id=$1',[receipt.estimate_id])).rows[0].outputs).toEqual(seed.outputs);
  expect((await call(seedClient,null)).rows[0]).toEqual({...receipt,already_existed:true});
  await denied({...seedClient,internalName:'Different request'},seed);
  await denied(seedClient,seed,{actor:id(9)});
  await denied(seedClient,seed,{actor:id(15)}); // Another current staff actor cannot replay this receipt.
  await denied(request(6),seed,{project:id(8)});await denied(request(6),seed,{project:id(99)});
  const addon=prepared(id(20),'add-on');expect((await call(request(7,'add_on'),addon)).rows[0].already_existed).toBe(false);
  await denied(request(10,'add_on'),{...prepared(),commercial_scope_id:id(21)});
  const mutations:Array<(row:any)=>void>=[r=>r.outputs.drawing_object_first.pergolas[0].position.originXMm='1',r=>r.outputs.studio_authored.objectOptions[0].options.values.websiteDesign.rawDimensions.widthMm='6100',r=>r.outputs.studio_authored.objectOptions[0].options.values.websiteDesign.selection.input.widthMm=6100,r=>r.outputs.studio_authored.objectOptions[0].options.values.price=1,r=>r.inputs.privatePrice=1,r=>r.outputs.studio_authored.site.values.extrasAllowanceExGst='1',r=>r.outputs.drawing_object_first=null,r=>r.outputs.extra=true,r=>r.extra=true,r=>r.outputs.studio_authored.objectOptions.push(structuredClone(r.outputs.studio_authored.objectOptions[0]))];
  for(const mutate of mutations){const row=prepared();mutate(row);await denied(request(11),row);}
  const source=(await db.query<any>('select to_jsonb(e) value from public.estimates e where id=$1',[receipt.estimate_id])).rows[0].value;
  const clone=prepareStudioCreation({mode:'clone',projectId:id(1),designId:'new-revision',source});if(!clone.ok)throw Error(clone.message);
  const cloneClient={schemaVersion:'studio_create.v1',requestId:id(12),mode:'clone',sourceEstimateId:`est_${receipt.estimate_id}`,expectedUpdatedAt:source.updated_at,expectedRevision:1};
  const copy=(await call(cloneClient,clone.prepared.row,{source:receipt.estimate_id,proof:source})).rows[0];expect(copy.estimate_id).not.toBe(receipt.estimate_id);
  expect((await db.query<any>('select outputs from public.estimates where id=$1',[receipt.estimate_id])).rows[0].outputs).toEqual(seed.outputs);
  await denied({...cloneClient,requestId:id(13)},clone.prepared.row,{source:receipt.estimate_id,proof:{...source,internal_name:'stale'}});
  const emptySource=(await db.query<any>('select to_jsonb(e) value from public.estimates e where id=$1',[oldReceipt.estimate_id])).rows[0].value;
  const emptyClone=prepareStudioCreation({mode:'clone',projectId:id(1),designId:'empty-revision',source:emptySource});if(!emptyClone.ok)throw Error(emptyClone.message);
  const emptyCopy=(await call({...cloneClient,requestId:id(16),sourceEstimateId:`est_${oldReceipt.estimate_id}`,expectedUpdatedAt:emptySource.updated_at},emptyClone.prepared.row,{source:oldReceipt.estimate_id,proof:emptySource})).rows[0];
  expect((await db.query<any>('select outputs from public.estimates where id=$1',[emptyCopy.estimate_id])).rows[0].outputs.drawing_object_first.pergolas).toEqual([]);
  const beforeRollback=await snapshot();await db.exec('begin');await call(request(14),prepared());await db.exec('rollback');expect(await snapshot()).toEqual(beforeRollback);
  await db.exec(`update public.portal_users set role='installer' where user_id='${id(2)}'`);await denied(oldClient,oldRow);
 } finally {await db.close();}
},30000);
