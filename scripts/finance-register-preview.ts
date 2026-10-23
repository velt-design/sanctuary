/** Local synthetic reader. No credentials, provider calls or financial writes. */
import { createServer } from 'node:http';
import { createFinanceRegisterDatabase, financeActor, seedFinanceRegisterScenario, seedFinanceRegisterPreviewCases } from '../test/support/financeRegisterDatabase';
import { parseRegisterQuery, registerSchema } from '../apps/portal/lib/finance/register';

async function main() {
  const db = await createFinanceRegisterDatabase();
  await seedFinanceRegisterScenario(db);
  await db.exec(`
    create temp table preview_everyday as select gen_random_uuid() project_id,n,
      (array['Alex Morgan','Sam Taylor','Casey Wilson','Robin Lee','Jamie Clarke','Avery Patel','Charlie Bennett','Drew Campbell'])[(n-1)%8+1] customer,
      (array['Coastal terrace, Bayview','Garden pergola, Hillcrest','Courtyard roof, Westhaven','Poolside shade, Riverview','Outdoor room, Cedar Lane','Entry canopy, Northfield','Deck extension, Parklane','Kitchen courtyard, Brookside'])[(n-1)%8+1] job,
      (array[1927500,684000,1235000,398500,2560000,842000,1570000,610000])[(n-1)%8+1]+((n-1)/8)*12500 total,
      case when n<=8 then current_date-3+n else current_date+4+n%24 end due
      from generate_series(1,56) n;
    insert into public.projects(id,name) select project_id,job from preview_everyday;
    alter table public.deposit_invoices disable trigger all;
    insert into public.deposit_invoices select (jsonb_populate_record(null::public.deposit_invoices,to_jsonb(i)||jsonb_build_object(
      'id',gen_random_uuid(),'project_id',s.project_id,'invoice_ref','INV-'||(1040+s.n),'status','OPEN','issue_command_id',null,'paid_at',null,'paid_by',null,
      'customer_name',s.customer,'project_name',s.job,'issue_date',least(current_date-1,s.due-14),'due_date',s.due,
      'sent_at',case when s.n%4=0 then null else least(now(),(s.due-13)::timestamptz+interval '9 hours') end,
      'total_inc_gst_cents',s.total,'total_ex_gst_cents',round(s.total/1.15),'gst_cents',s.total-round(s.total/1.15)))).*
      from public.deposit_invoices i cross join preview_everyday s where i.invoice_ref='INV-REGISTER';
    alter table public.deposit_invoices enable trigger all;
    -- Due dates can be future; completed issue/send facts cannot. Fail the
    -- preview seed if a later fixture change breaks that chronology.
    do $$ begin
      if exists(select 1 from public.deposit_invoices i join preview_everyday s on s.project_id=i.project_id
        where i.issue_date>current_date or i.sent_at>now()
          or i.issue_date>(i.sent_at at time zone 'Pacific/Auckland')::date)
      then raise exception 'Synthetic invoice issue/send chronology is invalid'; end if;
    end $$;
    insert into public.quote_versions(quote_id,version_number,status,total_inc_gst_cents,total_ex_gst_cents,gst_cents,is_current_draft)
      select id,4,'DRAFT',200000,173913,26087,true from public.quotes where quote_ref='Q-SYNTHETIC';
  `);
  await seedFinanceRegisterPreviewCases(db);
  createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET' || url.pathname !== '/register') { response.statusCode = 404; response.end('{}'); return; }
    const mode = url.searchParams.get('mode');
    if (mode === 'unavailable' || mode === 'denied') { response.statusCode = mode === 'denied' ? 403 : 503; response.end('{}'); return; }
    if (mode === 'slow') await new Promise(resolve => setTimeout(resolve,1500));
    try {
      const q = parseRegisterQuery(url.searchParams);
      const result = (await db.query<any>('select public.finance_register_v1($1,$2,$3,$4,$5,$6) result', [financeActor,q.tab,q.view,q.search,q.sent,q.offset])).rows[0].result;
      response.end(JSON.stringify(registerSchema.parse(result)));
    } catch { response.statusCode=503; response.end('{"error":"Synthetic reader unavailable"}'); }
  }).listen(3167, '127.0.0.1', () => console.log('Synthetic Finance read SQL ready on 127.0.0.1:3167'));
}
void main();
