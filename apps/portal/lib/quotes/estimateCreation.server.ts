import 'server-only';
import type {Estimate} from '@/lib/types/estimate';
import type {QuoteLineItem} from './types';
import {assertQuoteEstimateMappingReady,buildQuoteLineItemsFromEstimate} from './mapping';
import {totalsFromLineItems} from './utils';
import {DEFAULT_QUOTE_INTRO,DEFAULT_QUOTE_TERMS} from './defaults';
import {applyPaymentScheduleToTerms,buildDefaultQuotePaymentSchedule,paymentScheduleCompatibilityDepositPercent} from './paymentSchedule';
import {buildQuotePricingSourceCopyFromEstimate,quotePricingSourceDbColumns,quotePricingSourceAuditPayload} from './pricingSource';
import {nowIso} from './serverHelpers';

export function quoteLineItemsRpcPayload(items:Omit<QuoteLineItem,'id'>[]){
 return items.map(item=>({sort_order:item.sortOrder,description:item.description,qty:item.qty,unit_price_inc_gst_cents:item.unitPriceIncGstCents,line_total_inc_gst_cents:item.lineTotalIncGstCents}));
}
export function extractEstimateText(estimate:Estimate,keys:string[]):string|null{
 for(const key of keys){const value=(estimate as any)[key]??(estimate as any)?.outputs?.[key]??(estimate as any)?.inputs?.[key];if(typeof value==='string'&&value.trim())return value.trim();}return null;
}
/** One owner for finance defaults, mapping, payment schedule and compact provenance. */
export function buildEstimateQuoteCreation(estimate:Estimate&{pricingSource?:unknown;pricingSourceMetadata?:unknown},estimateUuid:string,actor:string|null,clientIntentId:string,quoteId:string|null,customerName:string|null,separateDocuments:boolean){
  const mapping = buildQuoteLineItemsFromEstimate(estimate);
  assertQuoteEstimateMappingReady(mapping);
  const items = mapping.items.map((item, idx) => ({ ...item, sortOrder: idx }));
  const totals = totalsFromLineItems(
    items.map((item) => ({
      id: 'tmp',
      description: item.description,
      qty: item.qty,
      unitPriceIncGstCents: item.unitPriceIncGstCents,
      lineTotalIncGstCents: item.lineTotalIncGstCents,
      sortOrder: item.sortOrder,
    })),
  );

  const introText = extractEstimateText(estimate, ['introText', 'intro_text']) ?? DEFAULT_QUOTE_INTRO;
  const paymentTerms = buildDefaultQuotePaymentSchedule({
    quoteTotalIncGstCents: totals.totalIncGstCents,
    approvalRequirement: mapping.approvalRequirement,
    approvalIncGstCents: mapping.approvalIncGstCents,
  });
  const depositPercent = paymentScheduleCompatibilityDepositPercent(paymentTerms, totals.totalIncGstCents);
  const termsSource = extractEstimateText(estimate, ['termsText', 'terms_text', 'terms']) ?? DEFAULT_QUOTE_TERMS;
  const termsText = applyPaymentScheduleToTerms(termsSource, paymentTerms);
  const pricingSourceCopy = buildQuotePricingSourceCopyFromEstimate({
    estimate,
    sourceEstimateVersionId: estimateUuid,
    copiedAt: nowIso(),
    copiedBy: actor,
    copyReason: 'quote_created',
  });

  const pricingColumns = quotePricingSourceDbColumns(pricingSourceCopy);
  const command={
    p_quote_id: quoteId,
    p_source_estimate_version_id: estimateUuid,
    p_revised_from_quote_version_id: null,
    p_client_intent_id: clientIntentId,
    p_actor: actor,
    p_customer_name: customerName,
    p_reference: null,
    p_intro_text: introText,
    p_terms_text: termsText,
    p_deposit_percent: depositPercent,
    p_payment_terms: paymentTerms,
    p_expires_at: null,
    p_total_inc_gst_cents: totals.totalIncGstCents,
    p_total_ex_gst_cents: totals.totalExGstCents,
    p_gst_cents: totals.gstCents,
    p_pricing_source: pricingColumns.pricing_source,
    p_pricing_source_metadata: pricingColumns.pricing_source_metadata,
    p_line_items: quoteLineItemsRpcPayload(items),
    ...(separateDocuments?{p_studio_created_audit:{estimateVersionId:estimateUuid,copiedBy:actor,copyReason:'quote_created',...quotePricingSourceAuditPayload(pricingSourceCopy)}}:{}),
  };
  return {command,pricingSourceCopy};
}
