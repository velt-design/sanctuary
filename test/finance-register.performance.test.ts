// @vitest-environment node
import { expect, it } from 'vitest';
import { createFinanceRegisterDatabase, financeActor, seedFinanceRegisterScenario } from './support/financeRegisterDatabase';
import { registerSchema } from '../apps/portal/lib/finance/register';
import { writeFileSync } from 'node:fs';

it('measures bounded invoice and quote reads at 10,000 synthetic records with current indexes', async () => {
  const db = await createFinanceRegisterDatabase();
  const receipts: Array<{tab:string;count:number;bytes:number;medianMs:number;p95Ms:number}> = [];
  try {
    await seedFinanceRegisterScenario(db);
    await db.exec(`
      create temp table perf_projects as select gen_random_uuid() id,n from generate_series(1,1000) n;
      insert into public.projects(id,name) select id,'PERF synthetic job '||n from perf_projects;
      insert into public.quotes(id,project_id,quote_ref) select gen_random_uuid(),id,'PERF-Q-'||n from perf_projects;
      insert into public.quote_versions(quote_id,version_number,status,total_inc_gst_cents,total_ex_gst_cents,gst_cents,is_current_draft,accepted_at)
        select q.id,n,case when n=10 then 'DRAFT' when n=9 then 'SENT' when n=8 then 'ACCEPTED' else 'SUPERSEDED' end,
          1000000,869565,130435,n=10,case when n=8 then now() end
        from public.quotes q cross join generate_series(1,10) n where q.quote_ref like 'PERF-Q-%';
      update public.quote_versions v set sent_at=now()-interval '1 day' from public.quotes q
        where q.id=v.quote_id and q.quote_ref like 'PERF-Q-%' and v.status='SENT';
      -- Exercise nonempty canonical unfinished state for both current offers
      -- and draft revisions, rather than benchmarking empty intent relations.
      insert into private.commercial_email_intents(intent_key,kind,subject_id,project_id,payload_hash,protected_payload,status,
        provider_idempotency_key,provider_idempotency_expires_at,provider_message_id)
        select 'synthetic-perf:'||v.id,case when v.status='DRAFT' then 'quote_send' else 'quote_resend' end,
          v.id,q.project_id,repeat('a',64),'{}','provider_accepted','synthetic-perf:'||v.id,now()+interval '1 day','synthetic-perf-message:'||v.id
        from public.quote_versions v join public.quotes q on q.id=v.quote_id where q.quote_ref like 'PERF-Q-%'
          and split_part(q.quote_ref,'-',3)::integer<=100 and v.version_number in (9,10);
    `);
    console.info('Finance performance fixture: 10,000 quote versions and 200 unfinished delivery intents seeded.');
    await db.exec(`
      create temp table perf_invoices as select gen_random_uuid() id,p.id project_id,p.n*10+s.n sequence,
        case when s.n%4=0 then 'PAID' else 'OPEN' end status from perf_projects p cross join generate_series(1,10) s(n);
      alter table public.deposit_invoices disable trigger all;
      insert into public.deposit_invoices select (jsonb_populate_record(null::public.deposit_invoices,to_jsonb(i)||jsonb_build_object(
        'id',s.id,'project_id',s.project_id,'invoice_ref','PERF-INV-'||s.sequence,'status',s.status,'issue_command_id',null,
        'paid_at',case when s.status='PAID' then now() end,'total_inc_gst_cents',100000,'total_ex_gst_cents',86957,'gst_cents',13043))).*
        from public.deposit_invoices i cross join perf_invoices s where i.invoice_ref='INV-REGISTER';
      alter table public.deposit_invoices enable trigger all;
      alter table public.project_payment_entries disable trigger all;
      insert into public.project_payment_entries(id,project_id,source_invoice_id,entry_type,amount_inc_gst_cents,occurred_at,created_by)
        select gen_random_uuid(),project_id,id,'PAYMENT',100000,now(),'Synthetic performance fixture' from perf_invoices where status='PAID';
      alter table public.project_payment_entries enable trigger all;
      insert into public.xero_deposit_matches(id,tenant_id,receipt_id,contact_id,project_id,invoice_id,payment_entry_id,amount_inc_gst_cents,receipt_date,evidence_fingerprint,approved_by)
        select gen_random_uuid(),'${financeActor}',gen_random_uuid(),gen_random_uuid(),e.project_id,e.source_invoice_id,e.id,
          100000,current_date,repeat('a',64),'${financeActor}' from public.project_payment_entries e join perf_invoices i on i.id=e.source_invoice_id;
      analyze;
    `);
    console.info('Finance performance fixture: 10,000 invoices and canonical receipt evidence seeded.');
    const run=async(tab:string,view:string,search:string)=>{
      const start=performance.now();
      const response=await db.query<any>('select public.finance_register_v1($1,$2,$3,$4,$5,$6) result',[financeActor,tab,view,search,'all',0]);
      const data=registerSchema.parse(response.rows[0]?.result);
      return {ms:performance.now()-start,data};
    };
    for(const [tab,view,search] of [['invoices','all','PERF-INV-'],['quotes','all','PERF-Q-']]){
      await run(tab,view,search);
      const samples=[];
      let result;
      for(let n=0;n<7;n++){result=await run(tab,view,search);samples.push(result.ms);}
      const sorted=samples.sort((a,b)=>a-b);
      const p95=sorted[Math.ceil(sorted.length*.95)-1];
      console.info(`Finance ${tab}: synthetic rows=${result!.data.count}, response=${JSON.stringify(result!.data).length} bytes, warm median=${sorted[3].toFixed(1)}ms, p95=${p95.toFixed(1)}ms (PGlite, not production network/browser timing)`);
      receipts.push({tab,count:result!.data.count,bytes:JSON.stringify(result!.data).length,medianMs:sorted[3],p95Ms:p95});
      if(process.env.FINANCE_REGISTER_PERF_RECEIPT)writeFileSync(process.env.FINANCE_REGISTER_PERF_RECEIPT,JSON.stringify({environment:'PGlite synthetic; excludes seed time, transport and browser readiness',invoiceRows:10000,quoteVersions:10000,unfinishedQuoteIntents:200,samples:7,receipts},null,2));
      expect(result!.data.rows).toHaveLength(50);expect(JSON.stringify(result!.data).length).toBeLessThan(100000);
      expect(result!.data.count).toBe(tab==='invoices'?10000:1000);
      expect(p95).toBeLessThan(500);
    }
  } finally { await db.close(); }
},60000);
