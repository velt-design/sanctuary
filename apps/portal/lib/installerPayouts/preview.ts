import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateInstallerPayoutV1 } from '@sp/costing';
import { resolvePublishedCostingConfiguration } from '@/lib/costing/configurationResolver';
import { buildSiteInputsFromCalculatorInputs } from '@/lib/estimates/costingPayload';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1, migrateLegacyCalculatorInputsToV2 } from '@/lib/types/calculator';
import { amountField, textField } from './model';

export async function previewPayout(db: SupabaseClient, projectId: string, body: Record<string, unknown>) {
  if (body.scopeMatched !== true) throw new Error('Review and confirm that the benchmark covers the same installation scope.');
  if (typeof body.gstRegistered !== 'boolean') throw new Error('Choose the installer GST status.');
  const accepted = await db.rpc('commercial_current_accepted_quote_versions', { p_project_id: projectId });
  if (accepted.error) throw new Error('Could not load the accepted quote.');
  if (accepted.data?.length !== 1) throw new Error('One accepted quote is required. Multiple contracts need a separate payout review.');
  const sourceQuoteId = accepted.data[0].quote_version_id;
  const quote = await db.from('quote_versions').select('source_estimate_version_id').eq('id', sourceQuoteId).single();
  if (quote.error || !quote.data) throw new Error('The accepted quote has no available estimate.');
  const sourceEstimateId = quote.data.source_estimate_version_id;
  const estimate = await db.from('estimates').select('inputs').eq('id', sourceEstimateId).eq('project_id', projectId).single();
  if (estimate.error || !estimate.data) throw new Error('The accepted estimate could not be loaded.');
  const raw = estimate.data.inputs;
  const inputs = isCalculatorInputsV2(raw) ? raw : isLegacyCalculatorInputsV1(raw) ? migrateLegacyCalculatorInputsToV2(raw) : null;
  if (!inputs) throw new Error('This estimate needs a calculator scope review.');
  const { config, provenance } = await resolvePublishedCostingConfiguration(db);
  if (provenance.source !== 'published') throw new Error('A published pricebook is required before agreeing installer pay.');
  const scope = textField(body.scope, 'Installation scope');
  const scopeId = `${sourceEstimateId}:${createHash('sha256').update(scope).digest('hex')}`;
  const site = buildSiteInputsFromCalculatorInputs(inputs);
  const calculation = calculateInstallerPayoutV1({ site, config, pricingVersionReference: provenance.versionId,
    scopeId, gstRegistered: body.gstRegistered,
    benchmark: { status: 'matched', scopeId, evidenceReference: textField(body.evidenceReference, 'Benchmark evidence'), amountExGst: amountField(body.benchmarkExGst) } });
  if (!calculation.proposal) throw new Error(calculation.reason);
  const agreement = {
    installer: textField(body.installer, 'Installer', 200), scope,
    exclusions: textField(body.exclusions, 'Exclusions (or None)'),
    paymentTerms: textField(body.paymentTerms, 'Payment terms'),
    acceptanceReference: textField(body.acceptanceReference, 'Installer acceptance reference'),
    gstRegistered: body.gstRegistered, sourceQuoteId, sourceEstimateId,
    payoutExGst: calculation.proposal.payoutExGst, gst: calculation.proposal.gst, totalPayable: calculation.proposal.totalPayable,
    internal: { calculation, provenance, site },
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(agreement)).digest('hex');
  return { agreement, fingerprint, calculation };
}
