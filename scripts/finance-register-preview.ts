/** Local synthetic reader. No credentials, provider calls or financial writes. */
import { createServer } from 'node:http';
import { createFinanceRegisterDatabase, financeActor, seedFinanceRegisterScenario, seedFinanceRegisterPreviewCases } from '../test/support/financeRegisterDatabase';
import { parseRegisterQuery, registerSchema } from '../apps/portal/lib/finance/register';

async function main() {
  const db = await createFinanceRegisterDatabase();
  await seedFinanceRegisterScenario(db);
  await db.exec(`alter table public.deposit_invoices disable trigger all;
    insert into public.deposit_invoices select (jsonb_populate_record(null::public.deposit_invoices,to_jsonb(i)||jsonb_build_object(
      'id',gen_random_uuid(),'invoice_ref','INV-'||lpad(n::text,4,'0'),'status','OPEN','issue_command_id',null,'paid_at',null,'paid_by',null,
      'customer_name',case when n%3=0 then 'Synthetic long customer name and project partnership' else 'Synthetic customer '||n end,
      'project_name',case when n%3=0 then 'Synthetic north courtyard and weather protection' else 'Synthetic job '||n end,
      'due_date',case when n%3=0 then current_date-7 else current_date+7 end,
      'sent_at',case when n%4=0 then null else now()-interval '3 days' end,
      'total_inc_gst_cents',100000+n*1000,'total_ex_gst_cents',86957,'gst_cents',13043))).*
      from public.deposit_invoices i cross join generate_series(1,56) n where i.invoice_ref='INV-REGISTER';
    alter table public.deposit_invoices enable trigger all;
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
