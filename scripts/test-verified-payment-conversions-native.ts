// Supplementary multi-session proof on the existing local WSL PostgreSQL16.
// Creates one uniquely named disposable database; accepts no remote connection.
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { paymentConversionMigration, paymentId as id, paymentSql, preparePaymentConversions, seedPaymentProject } from '../test/fixtures/verified-payment-conversion-db';

const name=`sanctuary_payment_events_${process.pid}_${Date.now()}`;
assert.match(name,/^sanctuary_payment_events_\d+_\d+$/);
const args=(database:string)=>['-d','Ubuntu-24.04','--','sudo','-n','-u','postgres','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-d',database];
function sql(statement:string,database=name) {
  const result=spawnSync('wsl',args(database),{input:statement,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4*1024*1024});
  if(result.error||result.status!==0)throw Error(result.error?.message??result.stderr);
  return result.stdout.trim();
}
const setup:string[]=[];
const collect={exec:async(statement:string)=>{setup.push(statement);},query:async()=>({rows:[]})};
const mark=(family:number)=>`select * from commercial_mark_invoice_paid_with_project_lock('${id(3000+family)}','${id(99)}',now()-interval '1 hour',null,null,null);`;
const evidence='.local-evidence/payment-events';mkdirSync(evidence,{recursive:true});
async function main() {
let created=false;
try {
  sql(`create database ${name};`,'postgres');created=true;
  await preparePaymentConversions(collect);
  await collect.exec(paymentSql(paymentConversionMigration));
  await collect.exec(`insert into auth.users(id) values('${id(99)}');`);
  await seedPaymentProject(collect,1,1);await seedPaymentProject(collect,2,2);await seedPaymentProject(collect,3,3);
  sql(setup.map(statement=>`${statement}\n;`).join('\n'));
  assert.match(sql('show server_version'),/^16\./);
  let secondStarted=false;
  const session=(statement:string,onData?:(data:string)=>void)=>new Promise<string>((resolve,reject)=>{
    const process=spawn('wsl',args(name),{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',error='';
    const timeout=setTimeout(()=>{process.kill();reject(Error('Disposable SQL session timed out'));},20000);
    process.stdout.on('data',data=>{output+=String(data);onData?.(output);});process.stderr.on('data',data=>{error+=String(data);});
    process.on('error',reject);process.on('close',code=>{clearTimeout(timeout);code===0?resolve(output):reject(Error(error));});
    process.stdin.end(statement);
  });
  let second:Promise<string>|undefined;
  const first=session(`begin;${mark(1)} select 'payment-lock-held';select pg_sleep(1);commit;`,output=>{
    if(!secondStarted&&output.includes('payment-lock-held')){secondStarted=true;second=session(`begin;${mark(1)} commit;`);}
  });
  await first;assert(secondStarted&&second,'Second real connection must start while the first owns its project lock');await second;
  const counts=JSON.parse(sql(`select json_build_object('payments',(select count(*) from project_payment_entries),
    'events',(select count(*) from audit_events where type='marketing.deposit_received'),
    'outbox',(select count(*) from marketing_conversion_deliveries));`));
  assert.deepEqual(counts,{payments:1,events:1,outbox:1});

  // Modest larger single-project ledger, with unrelated source data to expose
  // accidental all-project scans. All IDs/business fields remain fictional.
  sql(`insert into public.projects(id,name) select ('44444444-4444-4444-8444-'||lpad(n::text,12,'0'))::uuid,'Synthetic unrelated project' from generate_series(1,1500) n;
    insert into project_payment_entries(id,project_id,entry_type,amount_inc_gst_cents,occurred_at)
    select gen_random_uuid(),'${id(3)}','PAYMENT',1,now()-interval '30 days' from generate_series(1,2000);analyze;`);
  function benchmark(family:number,enabled:boolean) {
    const triggers=[['deposit_invoices','marketing_verified_deposit_invoices'],['project_payment_entries','marketing_verified_payment_entries'],['project_payment_allocations','marketing_verified_payment_allocations']];
    if(!enabled)sql(triggers.map(([table,trigger])=>`alter table ${table} disable trigger ${trigger};`).join(''));
    const measurements:number[]=[];
    try {for(let n=0;n<5;n++) {
      const output=sql(`begin;create temp table synthetic_clock as select clock_timestamp() started;${mark(family)} set constraints all immediate;
        select json_build_object('ms',extract(epoch from(clock_timestamp()-started))*1000) from synthetic_clock;rollback;`);
      measurements.push(JSON.parse(output.split('\n').find(line=>line.startsWith('{'))!).ms);
    }} finally {if(!enabled)sql(triggers.map(([table,trigger])=>`alter table ${table} enable trigger ${trigger};`).join(''));}
    return measurements;
  }
  const timing={ordinaryWithout:benchmark(2,false),ordinaryWith:benchmark(2,true),largerWithout:benchmark(3,false),largerWith:benchmark(3,true)};
  const body=paymentSql(paymentConversionMigration).split('as $$')[1].split('$$;')[0]
    .replace(/\bp_project\b/g,`'${id(3)}'::uuid`).replace(/\bp_quote\b/g,`'${id(3)}'::uuid`);
  const plan=JSON.parse(sql(`explain(analyze,buffers,format json) ${body}`));
  writeFileSync(`${evidence}/native-source-plan.json`,JSON.stringify(plan,null,2));
  const receipt={postgres:sql('show server_version'),concurrentSessions:2,counts,syntheticProjects:1503,largerProjectUnallocatedReceipts:2000,timing,
    limits:'Existing local PostgreSQL16, synthetic prerequisites plus actual financial/outbox/forward migrations. Not deployed PostgreSQL17, full schema, PostgREST or provider acceptance.'};
  writeFileSync(`${evidence}/native-receipt.json`,JSON.stringify(receipt,null,2));
  console.log(JSON.stringify(receipt,null,2));
} finally {
  if(created)sql(`drop database ${name};`,'postgres');
}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
