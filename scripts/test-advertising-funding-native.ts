// Native read-engine/performance proof using the existing local WSL PostgreSQL16.
// Creates and drops a uniquely named disposable database; no remote URL accepted.
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {prepareAdvertisingFunding,advertisingFundingMigration} from '../test/fixtures/advertising-funding-db';
import {paymentSql,paymentId as id,seedPaymentProject} from '../test/fixtures/verified-payment-conversion-db';
const name=`sanctuary_ad_funding_${process.pid}_${Date.now()}`;
assert.match(name,/^sanctuary_ad_funding_\d+_\d+$/);
function sql(statement:string,database=name){const r=spawnSync('wsl',['-d','Ubuntu-24.04','--','sudo','-n','-u','postgres','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-d',database],{input:statement,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:8*1024*1024});if(r.error||r.status!==0)throw Error(r.error?.message??r.stderr);return r.stdout.trim();}
const evidence='.local-evidence/advertising-funding';mkdirSync(evidence,{recursive:true});
async function main(){let created=false;try{
 sql(`create database ${name};`,'postgres');created=true;assert.match(sql('show server_version'),/^16\./);
 const setup:string[]=[];const db={exec:async(s:string)=>{setup.push(s);},query:async()=>({rows:[]})};
 await prepareAdvertisingFunding(db,false);
 // Invented representative workload. Counts, records and prices are synthetic;
 // they do not reproduce a private customer or production aggregate.
 for(let family=1;family<=300;family++)await seedPaymentProject(db,1+(family-1)%250,family);
 setup.push(`insert into projects(id,name) select ('44444444-4444-4444-8444-'||lpad(n::text,12,'0'))::uuid,'Synthetic unquoted project' from generate_series(1,1250) n;`);
 setup.push(Array.from({length:40},(_,i)=>`select * from commercial_mark_invoice_paid_with_project_lock('${id(3001+i)}','synthetic-admin',now()-interval '1 hour',null,null,null);`).join('\n'));
 let batch='';for(const statement of setup){if(batch.length+statement.length>64000){sql(batch);batch='';}batch+=statement+'\n;\n';}if(batch)sql(batch);sql('analyze;');
 const timings=(query:string)=>Array.from({length:5},()=>{const plan=JSON.parse(sql(`explain(analyze,buffers,format json) ${query}`));return plan[0]['Execution Time'] as number;});
 const count=()=>JSON.parse(sql(`select json_build_object('scopes',count(*),'active',count(*) filter(where source->>'active'='true')) from private.google_ads_sources();`));
 const ordinaryBefore=timings('select * from private.google_ads_sources()');const before=count();
 const currentSql=paymentSql(advertisingFundingMigration);sql(`begin;${currentSql} commit;`);const ordinaryAfter=timings('select * from private.google_ads_sources()');const after=count();assert.deepEqual(after,before);
 sql(`insert into project_payment_entries(id,project_id,entry_type,amount_inc_gst_cents,occurred_at) select gen_random_uuid(),'${id(1)}','PAYMENT',1,now()-interval '30 days' from generate_series(1,2000);analyze;`);
 const largerAfter=timings('select * from private.google_ads_sources()');assert.deepEqual(count(),after);
 const helper=currentSql.split('as $$')[1].split('$$;')[0].replace(/\bp_project\b/g,`'${id(1)}'::uuid`).replace(/\bp_quote\b/g,`'${id(1)}'::uuid`);
 const helperPlan=JSON.parse(sql(`explain(analyze,buffers,format json) ${helper}`));
 const sourceBody=currentSql.split('as $$')[2].split('$$;')[0];const sourcePlan=JSON.parse(sql(`explain(analyze,buffers,format json) ${sourceBody}`));
 writeFileSync(`${evidence}/native-helper-plan.json`,JSON.stringify(helperPlan,null,2));writeFileSync(`${evidence}/native-source-plan.json`,JSON.stringify(sourcePlan,null,2));
 const receipt={postgres:sql('show server_version'),syntheticProjects:1500,syntheticScopes:300,fundedScopes:40,largerUnallocatedReceipts:2000,before,after,timingMs:{ordinaryBefore,ordinaryAfter,largerAfter},remoteCalls:0,limits:'Actual complete revised finance and Google/Meta command/source migrations with synthetic auth/reporting prerequisites on local16, not deployed17/PostgREST/provider proof.'};
 writeFileSync(`${evidence}/native-receipt.json`,JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
 }finally{if(created)sql(`drop database ${name};`,'postgres');}}
main().catch(error=>{console.error(error);process.exitCode=1;});
