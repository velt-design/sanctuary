import { spawn, spawnSync } from 'node:child_process';
import {createHash} from 'node:crypto';
import { mkdtempSync,readFileSync,rmSync,writeFileSync,mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join,resolve,dirname,basename } from 'node:path';
import {landingExperimentTestBootstrap} from './lib/landing-experiment-test-bootstrap.mjs';
const bin=process.env.SANCTUARY_DISPOSABLE_POSTGRES_BIN;
if(!bin)throw new Error('Set SANCTUARY_DISPOSABLE_POSTGRES_BIN to a local PostgreSQL installation. No remote database is used.');
const suffix=process.platform==='win32'?'.exe':'',directory=mkdtempSync(join(tmpdir(),'sanctuary-experiment-'));
let started=false;
const run=(name,args,input,background=false)=>{const result=spawnSync(join(bin,name+suffix),args,{input,encoding:'utf8',windowsHide:true,stdio:background?'ignore':undefined,env:{NODE_ENV:'test'},maxBuffer:2e6});if(result.status!==0)throw new Error(result.stderr??String(result.error));return result.stdout;};
const port=await new Promise((done,reject)=>{const server=createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();if(!address||typeof address==='string')return reject();server.close(()=>done(address.port));});});
const sql=(value,db='postgres')=>run('psql',['-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(port),'-U','cluster_admin','-d',db,'-q','-At'],value);
try{
 run('initdb',['-D',directory,'-U','cluster_admin','-A','trust','--no-locale','-E','UTF8']);run('pg_ctl',['-D',directory,'-l',join(directory,'postgres.log'),'-o',`-p ${port} -h 127.0.0.1`,'-w','start'],undefined,true);started=true;
 sql(landingExperimentTestBootstrap(process.cwd()));
 sql(readFileSync('supabase/migrations/20261021020002_landing_experiments.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261021050001_creative_effect_ledger.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261022100001_landing_render_recovery.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261022110001_landing_packaging_recovery.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261022120001_landing_render_successor.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261022130001_landing_completion_permit.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261022140001_landing_technical_resume.sql','utf8'));
 sql(readFileSync('supabase/tests/landing_render_recovery.sql','utf8'));
 sql(readFileSync('supabase/tests/landing_technical_resume.sql','utf8')+readFileSync('supabase/tests/landing_completion_permit.sql','utf8')+readFileSync('supabase/tests/landing_render_successor.sql','utf8')+readFileSync('supabase/tests/landing_packaging_recovery.sql','utf8'));
 sql(readFileSync('supabase/tests/landing_technical_resume.sql','utf8')+readFileSync('supabase/tests/landing_completion_permit.sql','utf8')+readFileSync('supabase/tests/landing_render_successor.sql','utf8').replaceAll('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland')+readFileSync('supabase/tests/landing_packaging_recovery.sql','utf8').replaceAll('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland').replaceAll('explore','action-first'));
 sql(readFileSync('supabase/tests/landing_experiments.sql','utf8'));
 sql(readFileSync('supabase/tests/landing_experiment_probes.sql','utf8'));
 sql(readFileSync('supabase/tests/landing_experiment_layout.sql','utf8'));
 sql(readFileSync('supabase/tests/landing_experiment_learning.sql','utf8'));
 sql(readFileSync('supabase/tests/campaign_intake_evidence.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261021020003_campaign_intake_evidence.sql','utf8'));
 sql(readFileSync('supabase/tests/campaign_intake_evidence_assertions.sql','utf8'));
 if(sql('select count(*) from public.landing_experiments').trim()!=='0')throw new Error('Synthetic fixture did not roll back');
 sql(readFileSync('supabase/tests/meta_creative_ledger.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261021050002_creative_executor.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261021050003_creative_measurement.sql','utf8'));
 sql(readFileSync('supabase/tests/meta_creative_measurement.sql','utf8'));
 sql(readFileSync('supabase/tests/meta_creative_capability.sql','utf8'));
 // Complete the shared minimal fixture with the established 20260917000003 columns.
 sql('alter table private.enquiry_qualification_events add column project_id uuid,add column recorded_at timestamptz not null default clock_timestamp()');
 sql(readFileSync('supabase/migrations/20261021050004_creative_formal_cohort.sql','utf8'));
 sql(readFileSync('supabase/tests/meta_creative_formal_cohort.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261021050005_creative_settled_registry.sql','utf8'));
 sql(readFileSync('supabase/tests/meta_creative_settled_registry.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261021050006_creative_native_acceptance.sql','utf8'));
 sql(readFileSync('supabase/tests/meta_creative_native_acceptance.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261021050007_creative_activation_fence.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261021050008_creative_formal_settlement.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261021050009_landing_authored_copy.sql','utf8'));
 sql(readFileSync('supabase/tests/landing_authored_copy.sql','utf8'));
 sql(readFileSync('supabase/tests/landing_copy_identity.sql','utf8'));
 // Upgrade order: production recovery precedes the unpublished authored layer.
 // A disposable clone isolates old fixture rows; it is not a production reset.
 sql('create database landing_composed_check template postgres');
 sql('truncate public.landing_experiments cascade;delete from public.landing_experiment_control;delete from public.acquisition_experiment_reservation;', 'landing_composed_check');
 sql(readFileSync('supabase/tests/landing_technical_resume.sql','utf8')+readFileSync('supabase/tests/landing_completion_permit.sql','utf8')+readFileSync('supabase/tests/landing_render_successor.sql','utf8')+readFileSync('supabase/tests/landing_packaging_recovery.sql','utf8'),'landing_composed_check');
 sql(readFileSync('supabase/tests/landing_render_recovery.sql','utf8'),'landing_composed_check');
 sql(readFileSync('supabase/tests/meta_creative_activation.sql','utf8'));
 sql(readFileSync('supabase/tests/meta_creative_formal_settlement.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261022050010_creative_learning.sql','utf8'));
 sql(readFileSync('supabase/tests/meta_creative_learning.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261022050011_creative_retention.sql','utf8'));
 sql(readFileSync('supabase/tests/meta_creative_retention.sql','utf8'));
 sql(readFileSync('supabase/tests/meta_creative_outcomes.sql','utf8'));

 sql("update public.landing_experiments set created_at=clock_timestamp()-interval '8 days'");
 const plan="jsonb_build_object('scope',scope,'originalAds',original_ads,'budgetHash',budget_hash,'controlHash',control_hash,'nativeContractHash',native_contract_hash,'approvalHash',repeat('f',64),'catalogueHash',repeat('a',64),'generator','author','reviewer','reviewer')";
 const creative="select public.meta_creative_command(repeat('b',64),gen_random_uuid(),gen_random_uuid(),'reserve',"+plan+") from public.meta_creative_control";
 const landing="select public.landing_experiment_command(repeat('a',64),gen_random_uuid(),'prepare',gen_random_uuid(),jsonb_build_object('generation',generation,'template',template,'candidateHash',repeat('c',64),'evidenceHash',repeat('e',64),'path','/auckland-outdoor-living','copy','project','generator','author','minimumExposures',100,'durationDays',14)) from public.landing_experiment_control";
 const concurrent=statement=>new Promise((done,reject)=>{const child=spawn(join(bin,'psql'+suffix),['-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(port),'-U','cluster_admin','-d','postgres','-q','-At'],{windowsHide:true,env:{NODE_ENV:'test'}});child.stdout.resume();child.stderr.resume();child.on('error',reject);child.on('close',code=>done(code===0));child.stdin.end(statement);});
 // Reuse only the synthetic historical setup in this owned disposable cluster.
 // Separate psql sessions exercise the real global lock and one-use fence.
 const retentionFixture=readFileSync('supabase/tests/meta_creative_retention.sql','utf8').split('alter table public.meta_creative_native_acceptance disable trigger native_acceptance_guard;')[0].replace(/^begin;\s*/, '').replaceAll('pg_temp.','public.retention_fixture_');
 sql(retentionFixture);
 const retainedExperiment=sql("alter table public.meta_creative_native_acceptance disable trigger native_acceptance_guard;select public.retention_fixture_ret_seed('21');alter table public.meta_creative_native_acceptance enable trigger native_acceptance_guard;").trim();
 const retentionPayload=sql(`select public.retention_fixture_ret_payload('${retainedExperiment}','create_retained')`).trim();
 const quotedPayload="'"+retentionPayload.replaceAll("'","''")+"'";
 const retentionCommands=['f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002'];
 const admits=await Promise.all(retentionCommands.map(id=>concurrent(`select public.meta_creative_executor_command(repeat('b',64),'${id}','${retainedExperiment}','retention_admit',${quotedPayload})`)));
 if(admits.filter(Boolean).length!==1)throw new Error('Retention parallel admits did not admit exactly one');
 const retentionCommand=retentionCommands[admits.indexOf(true)];
 const retentionCheck=`select public.meta_creative_executor_command(repeat('b',64),'${retentionCommand}','${retainedExperiment}','retention_check',jsonb_build_object('requestHash',repeat('e',64)))`;
 const retentionNoEffect=`select public.meta_creative_executor_command(repeat('b',64),'${retentionCommand}','${retainedExperiment}','retention_no_effect',jsonb_build_object('requestHash',repeat('e',64),'evidenceHash',repeat('a',64),'reason','dispatch_not_started'))`;
 if((await Promise.all([concurrent(retentionCheck),concurrent(retentionNoEffect)])).filter(Boolean).length!==1)throw new Error('Retention dispatch/no-effect race did not admit exactly one');
 const retainedState=sql(`select state from public.meta_creative_effects where command='${retentionCommand}'`).trim();
 if(await concurrent(retentionCheck))throw new Error('Retention dispatch repeated');
 if(retainedState==='uncertain')sql(`select public.meta_creative_executor_command(repeat('b',64),'${retentionCommand}','${retainedExperiment}','retention_confirm',jsonb_build_object('requestHash',repeat('e',64),'objectId','9788','evidenceHash',repeat('f',64)))`);
 else if(retainedState!=='no_effect')throw new Error('Retention race state differs');
 sql(`select public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),'${retainedExperiment}','retention_abort',jsonb_build_object('generation',(select generation from meta_creative_control),'evidenceHash',repeat('a',64)))`);
 if(retainedState==='uncertain')sql(`select public.retention_fixture_ret_effect('${retainedExperiment}','pause_retained')`);
 sql(`select public.retention_fixture_ret_finish('${retainedExperiment}','reverted')`);
 const experiment='f1000000-0000-4000-8000-000000000001',command='f1000000-0000-4000-8000-000000000002';
 sql(`select public.meta_creative_command(repeat('b',64),gen_random_uuid(),'${experiment}','reserve',${plan}) from public.meta_creative_control;
 select public.meta_creative_command(repeat('b',64),'${command}','${experiment}','admit',jsonb_build_object('kind','create_paused_ad','objectId',null,'requestHash',repeat('a',64),'generation',generation,'preStateHash',repeat('c',64),'observedAt',clock_timestamp())) from public.meta_creative_control;`);
 const check=`select public.meta_creative_command(repeat('b',64),'${command}','${experiment}','check',jsonb_build_object('requestHash',repeat('a',64)))`;
 const noEffect=`select public.meta_creative_command(repeat('b',64),'${command}','${experiment}','no_effect',jsonb_build_object('requestHash',repeat('a',64),'evidenceHash',repeat('f',64),'reason','dispatch_not_started'))`;
 if((await Promise.all([concurrent(check),concurrent(noEffect)])).filter(Boolean).length!==1)throw new Error('Dispatch/no-effect race did not admit exactly one');
 const state=sql(`select state from public.meta_creative_effects where command='${command}'`).trim();
 if(state==='uncertain'){
  if(await concurrent(noEffect))throw new Error('Claimed dispatch resolved as no effect');
  sql(`select public.meta_creative_command(repeat('b',64),'${command}','${experiment}','confirm',jsonb_build_object('requestHash',repeat('a',64),'objectId','81','evidenceHash',repeat('f',64)));
  select public.meta_creative_command(repeat('b',64),'f1000000-0000-4000-8000-000000000003','${experiment}','admit_cleanup',jsonb_build_object('kind','pause_ad','objectId','81','requestHash',repeat('a',64),'generation',generation,'preStateHash',repeat('c',64),'observedAt',clock_timestamp())) from public.meta_creative_control;
  select public.meta_creative_command(repeat('b',64),'f1000000-0000-4000-8000-000000000003','${experiment}','check',jsonb_build_object('requestHash',repeat('a',64)));
  select public.meta_creative_command(repeat('b',64),'f1000000-0000-4000-8000-000000000003','${experiment}','confirm',jsonb_build_object('requestHash',repeat('a',64),'objectId','81','evidenceHash',repeat('f',64)));`);
 }else if(state!=='no_effect')throw new Error('Unexpected race state');
 if(await concurrent(check))throw new Error('Stale dispatch fence reused');
 sql(`select public.meta_creative_command(repeat('b',64),gen_random_uuid(),'${experiment}','cleanup',jsonb_build_object('evidenceHash',repeat('f',64)))`);
 if((await Promise.all([concurrent(creative),concurrent(landing)])).filter(Boolean).length!==1)throw new Error('Cross-lane concurrent reservation did not admit exactly one');
 if(sql('select count(*) from public.acquisition_experiment_reservation').trim()!=='1')throw new Error('Missing global reservation');
 sql(readFileSync('supabase/migrations/20261022050012_creative_ambiguity.sql','utf8'));
 const ambiguityCohorts=JSON.parse(sql(readFileSync('supabase/tests/meta_creative_ambiguity_cohort.sql','utf8')).trim().split('\n').at(-1));
 mkdirSync('.local-evidence',{recursive:true});writeFileSync('.local-evidence/ambiguity-native-cohorts.json',JSON.stringify(ambiguityCohorts));
 const generated=spawnSync(process.execPath,['--require','tsx/cjs','scripts/meta-creative-ambiguity-fixtures.ts'],{encoding:'utf8',windowsHide:true,input:JSON.stringify(ambiguityCohorts),maxBuffer:2e6});
 if(generated.status!==0)throw new Error(generated.stderr);
 const analysisCases=JSON.parse(generated.stdout);
 sql(`do $fixture$declare a jsonb;begin for a in select value from jsonb_array_elements('${JSON.stringify(analysisCases).replaceAll("'","''")}'::jsonb)loop
 if public.meta_creative_analysis_valid(a)is distinct from true then raise exception 'Cross-runtime native sensitivity differs: %',a;end if;
 if public.meta_creative_analysis_valid(a||'{"private":"synthetic-canary"}')then raise exception 'Private field accepted';end if;
 if public.meta_creative_analysis_valid(jsonb_set(a,'{sensitivity,pool}','2001'))then raise exception 'Unbounded pool accepted';end if;
 end loop;end$fixture$;`);
 const settlement=JSON.parse(sql(readFileSync('supabase/tests/meta_creative_ambiguity_settlement.sql','utf8')).trim().split('\n').at(-1));
 writeFileSync('.local-evidence/ambiguity-native-analysis.json',JSON.stringify({cases:analysisCases,settlement}));
 sql(readFileSync('supabase/migrations/20261022050013_creative_steady_inventory.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261024000001_creative_paused_native_copy.sql','utf8'));
 sql(readFileSync('supabase/tests/meta_creative_paused_native_copy.sql','utf8'));
 sql(readFileSync('supabase/tests/meta_creative_capability.sql','utf8').replace('begin;', 'begin;delete from public.acquisition_experiment_reservation;truncate public.meta_creative_plans cascade;update public.meta_creative_control set enabled=true,cleanup_enabled=true,authority_current=true,global_stop=false;'));
 const inventory=JSON.parse(sql(readFileSync('supabase/tests/meta_creative_steady_inventory.sql','utf8')).trim().split('\n').at(-1));
 writeFileSync('.local-evidence/steady-native-inventory.json',JSON.stringify(inventory));
 // Synthetic capacity-only cluster state: real trigger in parallel sessions,
 // then real owned cleanup at the full bound. This is not provider inventory.
 sql(`delete from public.acquisition_experiment_reservation;truncate public.meta_creative_plans cascade;
 update public.meta_creative_control set enabled=true,cleanup_enabled=true,authority_current=true,global_stop=false;
 select public.meta_creative_command(repeat('b',64),gen_random_uuid(),'f3000000-0000-4000-8000-000000000001','reserve',${plan})from public.meta_creative_control;
 insert into public.meta_creative_plans(id,plan,plan_hash)values('f3000000-0000-4000-8000-000000000002','{}',repeat('2',64));
 do $capacity$declare cmd uuid;begin for n in 1..39 loop cmd:=gen_random_uuid();
 insert into public.meta_creative_effects(command,experiment,command_hash,request_hash,kind,generation,pre_state_hash,state,object_id,evidence_hash)values(cmd,'f3000000-0000-4000-8000-000000000001',repeat('a',64),repeat('a',64),'create_paused_ad',1,repeat('a',64),'confirmed',(98000+n)::text,repeat('a',64));
 insert into public.meta_creative_objects(object_id,experiment,kind,created_by,request_hash,evidence_hash)values((98000+n)::text,'f3000000-0000-4000-8000-000000000001','ad',cmd,repeat('a',64),repeat('a',64));
 end loop;end$capacity$;`);
 const capacity=await Promise.all([1,2].map(()=>concurrent("insert into public.meta_creative_effects(command,experiment,command_hash,request_hash,kind,generation,pre_state_hash)values(gen_random_uuid(),'f3000000-0000-4000-8000-000000000002',repeat('a',64),repeat('a',64),'create_paused_ad',1,repeat('a',64))")));
 if(capacity.filter(Boolean).length!==1)throw new Error('Inventory capacity race did not admit exactly one');
 sql(`do $capacity$begin begin perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),gen_random_uuid(),'prepare','{"plan":{"purpose":"formal_experiment"}}');raise exception 'capacity bypass';exception when others then if sqlerrm<>'Owned ad inventory capacity reached'then raise;end if;end;end$capacity$;
 select public.meta_creative_command(repeat('b',64),gen_random_uuid(),'f3000000-0000-4000-8000-000000000001','admit_cleanup',jsonb_build_object('kind','pause_ad','objectId','98001','requestHash',repeat('a',64),'generation',generation,'preStateHash',repeat('c',64),'observedAt',clock_timestamp()))from public.meta_creative_control;`);
 // The new owner branch is additive: the complete historical fixtures above
 // ran against unchanged signatures/rows before installation.
 const ownerCatalog=()=>JSON.parse(sql(`select jsonb_build_object('functions',(select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object('md5',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'securityDefiner',p.prosecdef,'settings',p.proconfig))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.prokind='f'),
  'tables',(select jsonb_object_agg(c.relname,jsonb_build_object('rls',c.relrowsecurity,'acl',c.relacl::text,'columns',(select jsonb_agg(a.attname order by a.attnum)from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)))from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relkind='r'))`).trim());
 const beforeOwner=ownerCatalog();
 sql(readFileSync('supabase/migrations/20261026000001_creative_owner_reviewed_bundle.sql','utf8'));
 const capacityCatalog=()=>({catalog:ownerCatalog(),constraints:JSON.parse(sql(`select jsonb_object_agg(c.conrelid::regclass::text||'.'||c.conname,pg_get_constraintdef(c.oid))from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'`).trim())});
 const capacityBefore=capacityCatalog(),capacityMigration=readFileSync('supabase/migrations/20261026000002_creative_owner_payload_bounds.sql','utf8');
 sql(`begin;${capacityMigration.replace(/^begin;/m,'').replace(/^commit;/m,'')}rollback;`);
 if(JSON.stringify(capacityCatalog())!==JSON.stringify(capacityBefore))throw Error('Capacity rollback changed catalogue');
 sql(capacityMigration);const capacityAfter=capacityCatalog();
 const capacityFunctions=Object.keys(capacityBefore.catalog.functions).filter(k=>JSON.stringify(capacityBefore.catalog.functions[k])!==JSON.stringify(capacityAfter.catalog.functions[k]));
 const capacityConstraints=Object.keys(capacityBefore.constraints).filter(k=>capacityBefore.constraints[k]!==capacityAfter.constraints[k]);
 if(JSON.stringify(capacityFunctions.sort())!==JSON.stringify(['meta_creative_executor_without_formal_cohort(text,uuid,uuid,text,jsonb)','meta_creative_winning_control(jsonb,text)','meta_creative_executor_without_ambiguity(text,uuid,uuid,text,jsonb)','meta_creative_executor_without_retention(text,uuid,uuid,text,jsonb)'].sort())||capacityConstraints.length!==3||JSON.stringify(capacityAfter.catalog.tables)!==JSON.stringify(capacityBefore.catalog.tables))throw Error('Capacity owned delta differs');
 writeFileSync('.local-evidence/owner-capacity-native-delta.private.json',JSON.stringify({before:capacityBefore,after:capacityAfter,changedFunctions:capacityFunctions,changedConstraints:capacityConstraints,rollbackIdentical:true,migrationSha256:createHash('sha256').update(capacityMigration).digest('hex')}));
 const afterOwner=ownerCatalog(),changed=Object.keys(beforeOwner.functions).filter(k=>JSON.stringify(beforeOwner.functions[k])!==JSON.stringify(afterOwner.functions[k])),added=Object.keys(afterOwner.functions).filter(k=>!beforeOwner.functions[k]);
 const expectedChanged=['meta_creative_generation()','meta_creative_without_activation(text,uuid,uuid,text,jsonb)','meta_creative_executor_without_formal_cohort(text,uuid,uuid,text,jsonb)','meta_creative_executor_command(text,uuid,uuid,text,jsonb)','meta_creative_winning_control(jsonb,text)','meta_creative_executor_without_ambiguity(text,uuid,uuid,text,jsonb)','meta_creative_executor_without_retention(text,uuid,uuid,text,jsonb)'];
 if(JSON.stringify(changed.sort())!==JSON.stringify(expectedChanged.sort())||added.length!==1||!added[0].startsWith('meta_creative_loss_cohort('))throw new Error('Owner migration function delta differs');
 for(const key of Object.keys(beforeOwner.tables)){const prior=beforeOwner.tables[key],next=afterOwner.tables[key];if(key==='meta_creative_control'){if(JSON.stringify(next)!==JSON.stringify({...prior,columns:[...prior.columns,'owner_proposal']}))throw new Error('Owner column delta differs');}else if(JSON.stringify(prior)!==JSON.stringify(next))throw new Error('Unowned table metadata changed');}
 for(const key of changed)if(JSON.stringify({...beforeOwner.functions[key],md5:null})!==JSON.stringify({...afterOwner.functions[key],md5:null}))throw new Error('Existing function ACL/security changed');
 writeFileSync('.local-evidence/owner-reviewed-source-native-delta.private.json',JSON.stringify({before:beforeOwner,after:afterOwner,changed,added}));
 const ownerFixture=spawnSync(process.execPath,['--require','tsx/cjs','scripts/meta-creative-owner-fixtures.ts'],{encoding:'utf8',windowsHide:true,maxBuffer:2e6});
 if(ownerFixture.status!==0)throw new Error(ownerFixture.stderr);
 const ownerNative=JSON.parse(sql(readFileSync('supabase/tests/meta_creative_owner_reviewed_bundle.sql','utf8').replace('__OWNER_FIXTURE__',ownerFixture.stdout.replaceAll("'","''"))).trim().split('\n').at(-1));
 const normalizationBefore=capacityCatalog(),normalizationMigration=readFileSync('supabase/migrations/20261027040000_creative_capability_baseline.sql','utf8');
 sql(`begin;${normalizationMigration.replace(/^begin;/m,'').replace(/^commit;/m,'')}rollback;`);
 if(JSON.stringify(capacityCatalog())!==JSON.stringify(normalizationBefore))throw Error('Normalization migration rollback changed catalogue');
 sql(normalizationMigration);const normalizationAfter=capacityCatalog();
 if(JSON.stringify(normalizationAfter.catalog.tables)!==JSON.stringify(normalizationBefore.catalog.tables))throw Error('Normalization changed table columns/access');
 const normalizationConstraints=Object.keys(normalizationBefore.constraints).filter(k=>normalizationBefore.constraints[k]!==normalizationAfter.constraints[k]);
 if(normalizationConstraints.length!==1||!normalizationConstraints[0].startsWith('meta_creative_execution.'))throw Error('Normalization constraint delta differs');
 writeFileSync('.local-evidence/normalization-native-delta.private.json',JSON.stringify({before:normalizationBefore,after:normalizationAfter,changedConstraints:normalizationConstraints,rollbackIdentical:true}));
 const normalizationFixture=spawnSync(process.execPath,['--require','tsx/cjs','scripts/meta-creative-normalization-fixtures.ts'],{encoding:'utf8',windowsHide:true,maxBuffer:2e6});
 if(normalizationFixture.status!==0)throw Error(normalizationFixture.stderr);
 const normalizationNative=JSON.parse(sql(readFileSync('supabase/tests/meta_creative_normalization.sql','utf8').replace('__NORMALIZATION_FIXTURE__',normalizationFixture.stdout.replaceAll("'","''"))).trim().split('\n').at(-1));
 const retentionSettingsFixture=readFileSync('supabase/tests/meta_creative_retention.sql','utf8').split('alter table public.meta_creative_native_acceptance disable trigger native_acceptance_guard;')[0]
  .replace('baseline jsonb default null)returns uuid','baseline jsonb default null,settings jsonb default null)returns uuid')
  .replace("if baseline is not null then p:=p||jsonb_build_object('retainedBaseline',baseline);end if;","if settings is not null then p:=p||jsonb_build_object('adSettings',settings);end if;if baseline is not null then p:=p||jsonb_build_object('retainedBaseline',baseline);end if;");
 if(!retentionSettingsFixture.includes('settings jsonb default null')||!retentionSettingsFixture.includes("jsonb_build_object('adSettings',settings)"))throw Error('Retained settings fixture predecessor differs');
 const retentionSettingsNative=JSON.parse(sql(retentionSettingsFixture+readFileSync('supabase/tests/meta_creative_retention_ad_settings.sql','utf8')).trim().split('\n').at(-1));
 process.stdout.write(JSON.stringify({normalization:normalizationNative,retentionSettings:retentionSettingsNative,ownerReviewedBundle:ownerNative,authoredLanding:true,steadyInventory:true,ambiguityCohort:true,ambiguitySettlement:true,ambiguityCrossRuntimeCases:analysisCases.length,postgres:sql('show server_version').trim(),sourceContract:true,intakeProvenance:true,creativeLedger:true,pausedCreativeAndAd:true,creativeMeasurement:true,formalCohort:true,launchTestExclusions:true,dispatchNoEffectConcurrency:true,crossLaneConcurrency:true,retentionReplacementRecovery:true,retentionAdmitAndDispatchConcurrency:true,disposableOnly:true,liveCalls:0}));

}finally{
 if(started)run('pg_ctl',['-D',directory,'-m','immediate','-w','stop'],undefined,true);
 if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith('sanctuary-experiment-'))rmSync(directory,{recursive:true,force:true});
}
