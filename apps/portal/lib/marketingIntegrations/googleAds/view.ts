import type { AdsReport } from './contract';
export type AdvertisingRow = { key: string; label: string; campaignId: string; cost: number; clicks: number; enquiries: number | null; sales: number | null; value: number | null };
/** Costs and action-specific outcomes are independently grouped at the same grain. */
export function advertisingRows(report: AdsReport, input: { grain: 'campaign' | 'keyword'; dateBasis: 'interaction' | 'conversion'; start: string; end: string;
  saleActionId: string | null; enquiryActionIds: string[] }): AdvertisingRow[] {
  if (input.start < report.start || input.end > report.end || input.start > input.end) throw new Error('Dates outside retained evidence.');
  const mappedSale = input.saleActionId !== null && report.actions.some(a => a.id === input.saleActionId);
  const mappedEnquiries = input.enquiryActionIds.length > 0 && input.enquiryActionIds.every(id => report.actions.some(a => a.id === id));
  const rows = new Map<string, AdvertisingRow>();
  const key = (r: { campaignId: string; adGroupId?: string; criterionId?: string }) => input.grain === 'campaign' ? r.campaignId : `${r.campaignId}/${r.adGroupId}/${r.criterionId}`;
  const ensure = (k: string, campaignId: string, label: string) => { let row = rows.get(k); if (!row) { row = { key: k, label, campaignId, cost: 0, clicks: 0, enquiries: mappedEnquiries ? 0 : null, sales: mappedSale ? 0 : null, value: mappedSale ? 0 : null }; rows.set(k, row); } return row; };
  for (const r of input.grain === 'campaign' ? report.campaigns : report.keywords) {
    if (r.day < input.start || r.day > input.end) continue;
    const row = ensure(key(r), r.campaignId, 'name' in r ? r.name : `${r.keyword} (${r.matchType.toLowerCase()})`);
    row.cost += Number(r.costMicros) / 1000000; row.clicks += r.clicks;
  }
  for (const c of report.conversions) {
    if (c.dateBasis !== input.dateBasis || c.day < input.start || c.day > input.end || (input.grain === 'keyword') !== Boolean(c.criterionId)) continue;
    const row = ensure(key(c), c.campaignId, input.grain === 'campaign' ? `Campaign ${c.campaignId}` : `Keyword ${c.criterionId}`);
    if (mappedSale && c.actionId === input.saleActionId) { row.sales! += c.count; row.value! += c.value; }
    if (mappedEnquiries && input.enquiryActionIds.includes(c.actionId)) row.enquiries! += c.count;
  }
  return [...rows.values()].sort((a,b) => b.cost-a.cost || a.key.localeCompare(b.key));
}
export const deliveryLabels: Record<string,string> = { SKIPPED:'Not eligible',READY:'Waiting to send',SENDING:'Sending',SUBMITTED:'Google processing',ACCEPTED:'Google ingestion confirmed',RETRY:'Retry scheduled',FAILED:'Failed',REVIEW_REQUIRED:'Needs review',RETRACTION_READY:'Cancellation pending',RETRACTING:'Cancelling',RETRACTED:'Cancellation confirmed' };
export const reasonLabels: Record<string,string> = {
  CONSENT_POLICY_NOT_APPROVED_FOR_RECEIPT:'Original enquiry outside the approved advertising-data policy',
  SALE_NO_LONGER_CURRENT:'No current deposited sale',ORIGIN_ENQUIRY_MISSING:'Original enquiry missing',MARKETING_CONSENT_NOT_GRANTED:'Advertising permission missing or withdrawn',
  SALE_DATE_UNVERIFIED:'Sale date needs verification',SALE_OUTSIDE_IMPORT_WINDOW:'Sale outside import window',PERMITTED_MATCHING_ID_MISSING:'No permitted matching identifier',
  ENHANCED_MATCHING_WINDOW_EXCEEDED:'Original enquiry outside enhanced matching window',AUTHORITY_CHANGED:'Connection authority changed',
  RESTORED_SALE_REQUIRES_NEW_CYCLE:'Restored sale needs a new reviewed sale cycle',SALE_IDENTITY_OR_DATE_CHANGED:'Sale identity or date changed',
  RETRACTION_REQUIRES_OPERATOR:'Cancellation needs operator action',GOOGLE_INGESTION_REJECTED:'Google rejected the event',GOOGLE_DIAGNOSTIC_TIMEOUT:'Google status remains uncertain',
  GOOGLE_PROCESSING:'Waiting for Google processing',DISPATCH_OUTCOME_UNCERTAIN:'Delivery outcome uncertain; same sale will be checked or retried',
};
