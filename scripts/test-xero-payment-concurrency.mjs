import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { prepareXeroPaymentDatabase } from './xero-payment-db-fixture.mjs';

// Docker-only, isolated database. There is deliberately no connection URL option.
const root=path.resolve(import.meta.dirname,'..');
const container=`xero-payment-race-${randomUUID()}`;
const image=process.env.BACKGROUND_JOBS_DB_IMAGE || 'postgres:17';
const id=n=>`33333333-3333-4333-8333-${String(n).padStart(12,'0')}`;
function docker(args,input) {
  const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  if(r.error || r.status!==0) throw new Error(r.error?.message || r.stderr || r.stdout);
  return r.stdout.trim();
}
const args=['exec','-i','--env','PGPASSWORD=disposable-test-only',container,'psql','-X','-h','127.0.0.1','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'];
const sql=q=>docker(args,q);
function client(q) {
  const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});
  let output='';
  child.stdout.on('data',v=>{output+=v;});child.stderr.on('data',v=>{output+=v;});
  const done=new Promise((resolve,reject)=>{
    child.on('error',reject);
    child.on('close',code=>code===0?resolve(output):reject(new Error(output)));
  });
  // Attach immediately so a SQL failure while the coordinator polls is handled.
  done.catch(()=>{});
  child.stdin.end(q);
  return done;
}
async function waitFor(check,label) {
  const deadline=Date.now()+60000;
  while(Date.now()<deadline) {if(check()) return;await delay(150);}
  throw new Error(`Timed out: ${label}`);
}
function fixture() {
  sql(`truncate private.xero_invoice_transfer_control,private.xero_invoice_transfers,private.xero_invoice_requests,
    public.xero_deposit_matches,public.xero_payment_approvers,auth.users,public.projects,public.quotes,public.quote_versions,
    public.deposit_invoices,public.project_payment_entries,public.project_payment_allocations,public.project_invoice_plan_items,public.audit_events cascade;
    insert into auth.users(id) values('${id(99)}');
    insert into public.xero_payment_approvers(user_id,granted_by) values('${id(99)}','Disposable test');
    insert into public.projects(id,name) values('${id(1)}','Synthetic concurrency');
    insert into public.quotes(id,project_id,quote_ref) values('${id(1)}','${id(1)}','QA');
    insert into public.quote_versions(id,quote_id,version_number,status,accepted_at,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_terms)
      values('${id(1)}','${id(1)}',1,'ACCEPTED',now(),20000,17391,2609,'[{"id":"deposit","resolvedAmountIncGstCents":10000}]');
    insert into public.deposit_invoices(id,project_id,quote_id,quote_version_id,quote_ref,quote_version_number,invoice_ref,status,
      quote_total_inc_gst_cents,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_term_id,payment_term_label)
      values('${id(1)}','${id(1)}','${id(1)}','${id(1)}','QA',1,'QA','OPEN',20000,10000,8696,1304,'deposit','Deposit');
    insert into private.xero_invoice_transfer_control(singleton,tenant_id,auto_record_payments_enabled) values(true,'${id(98)}',true);
    insert into private.xero_invoice_transfers values('${id(80)}','${id(1)}','${id(1)}','${id(98)}','${id(81)}');
    insert into private.xero_invoice_requests values('${id(80)}','{"Invoices":[{"Contact":{"ContactID":"${id(97)}"}}]}');`);
  return JSON.parse(sql(`select public.xero_deposit_review_context('${id(1)}');`));
}
function approve(context,approval,source,automatic=false) {
  for(const value of [context.invoiceFingerprint,context.ledgerFingerprint]) {
    if(!/^[a-f0-9]{64}$/.test(value)) throw new Error('Unexpected reviewed fingerprint');
  }
  const command=automatic?'xero_record_invoice_payment':'xero_approve_invoice_payment';
  const actor=automatic?'':`'${id(99)}',`;
  return `public.${command}('${id(approval)}',${actor}'${id(98)}','${id(source)}','${id(97)}',
    '${id(1)}','${id(1)}',4000,current_date,'${context.invoiceFingerprint}','${context.ledgerFingerprint}',repeat('a',64),'Synthetic race','${id(81)}')`;
}
async function race(name,approval,source,expected,firstAutomatic=false,secondAutomatic=firstAutomatic) {
  const context=fixture();
  const a=client(`set application_name='finance_race_a';begin;set local statement_timeout='70s';
    select ${approve(context,20,20,firstAutomatic)};
    do $$ declare deadline timestamptz:=clock_timestamp()+interval '60 seconds';begin
      loop
        perform pg_stat_clear_snapshot();
        exit when exists(select 1 from pg_stat_activity where application_name='finance_race_b'
          and pg_backend_pid()=any(pg_blocking_pids(pid)));
        if clock_timestamp()>deadline then raise exception 'Second approval never blocked on the first';end if;
        perform pg_sleep(0.05);
      end loop;
    end $$;commit;`);
  await waitFor(()=>sql("select exists(select 1 from pg_stat_activity where application_name='finance_race_a' and wait_event='PgSleep');")==='t','first approval holding locks');
  const invocation=approve(context,approval,source,secondAutomatic);
  const assertion=expected==='replay'
    ? `if not (${invocation}->>'replayed')::boolean then raise exception 'Expected committed replay';end if;`
    : `begin perform ${invocation};raise exception 'Concurrent invalid approval succeeded';
       exception when sqlstate '55000' then if position('${expected}' in sqlerrm)=0 then raise;end if;end;`;
  const b=client(`set application_name='finance_race_b';set statement_timeout='70s';do $$ begin ${assertion} end $$;`);
  await Promise.all([a,b]);
  sql(`do $$ begin
    if (select count(*) from public.xero_deposit_matches)<>1
      or (select count(*) from public.project_payment_entries)<>1
      or (select sum(amount_inc_gst_cents) from public.project_payment_entries)<>4000
      or (select count(*) from public.audit_events where type='${firstAutomatic?'payment.xero_match_recorded':'payment.xero_match_approved'}')<>1
      or (select recording_method from public.xero_deposit_matches)<>'${firstAutomatic?'AUTOMATIC':'MANUAL'}'
      or (select status from public.deposit_invoices where id='${id(1)}')<>'OPEN'
      then raise exception 'Concurrent approval changed money or history more than once';end if;
    end $$;`);
  process.stdout.write(`Payment concurrency passed: ${name}\n`);
}
let started=false;
try {
  docker(['run','--detach','--rm','--name',container,'--env','POSTGRES_PASSWORD=disposable-test-only',image]);started=true;
  await waitFor(()=>{try{return sql('select 1;')==='1';}catch{return false;}},'isolated PostgreSQL startup');
  // TCP excludes the entrypoint's temporary socket-only initialization server.
  // template0 excludes Supabase image-owned auth tables from our scoped fixture.
  sql('create database finance_race template template0;');
  args[args.indexOf('-d')+1]='finance_race';
  const version=sql("select current_setting('server_version_num')::int/10000;");
  if(process.env.BACKGROUND_JOBS_DB_EXPECTED_POSTGRES_MAJOR && version!==process.env.BACKGROUND_JOBS_DB_EXPECTED_POSTGRES_MAJOR) throw new Error('Wrong PostgreSQL major');
  await prepareXeroPaymentDatabase(q=>sql(q),name=>readFileSync(path.join(root,'supabase',name),'utf8').replace(/\r/g,''));
  sql(readFileSync(path.join(root,'supabase/migrations/20260915000006_xero_automatic_payments.sql'),'utf8'));
  await race('lost response retries same approval',20,20,'replay');
  await race('two approvals for one receipt',21,20,'already recorded');
  await race('different receipts with stale reviewed balance',21,21,'Payment evidence changed');
  await race('automatic lost-response replay',20,20,'replay',true);
  await race('automatic duplicate receipt with different command',21,20,'already recorded',true);
  await race('automatic competing instalments with stale balance',21,21,'Payment evidence changed',true);
  await race('manual approval follows automatic receipt recording',21,20,'already recorded',true,false);
  await race('automatic recording follows manual receipt approval',21,20,'already recorded',false,true);
} finally {
  if(started) docker(['rm','--force',container]);
}
