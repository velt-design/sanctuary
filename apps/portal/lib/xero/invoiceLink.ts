import 'server-only';
import { access } from './store';
import { config } from './security';
export async function xeroInvoiceUrl(invoiceId: string) {
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId)) throw new Error('INVALID_INVOICE_ID');
 const tenantId=config().tenantId;
 const tokens=await access();
 const response=await fetch('https://api.xero.com/api.xro/2.0/Organisation', {cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),
  headers:{Authorization:`Bearer ${tokens.accessToken}`,'Xero-tenant-id':tenantId,Accept:'application/json'}});
 if(!response.ok) throw new Error('XERO_LINK_UNAVAILABLE');
 const data=await response.json();
 const organisation=Array.isArray(data.Organisations) ? data.Organisations.find((item: {OrganisationID?: string})=>item.OrganisationID===tenantId) : null;
 if(typeof organisation?.ShortCode!=='string' || !/^!?[A-Za-z0-9_-]{1,30}$/.test(organisation.ShortCode)) throw new Error('XERO_LINK_UNAVAILABLE');
 return `https://go.xero.com/app/${encodeURIComponent(organisation.ShortCode)}/invoicing/view/${invoiceId}`;
}
