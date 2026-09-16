import 'server-only';
import type { FrozenConfiguratorPrice } from './configuratorPricing.server';
import { buildEnquiryDraftEstimateRow, buildEnquiryPricingSnapshot, type EnquiryPricingParams } from './enquiryPricingSnapshot';

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';

/** Reuse the complete enquiry-to-estimate adapter, not the partial staff calculator. */
export function buildStaffConfiguratorRevisionEstimate(params: {
  projectId: string; sourceEstimateId: string; actorId: string;
  sourceSnapshot: Record<string, unknown>; frozen: FrozenConfiguratorPrice;
}) {
  const contact = record(params.sourceSnapshot.contact), project = record(params.sourceSnapshot.project);
  const basis: EnquiryPricingParams = {
    enquiryType: text(record(params.sourceSnapshot.enquiry).enquiryType) || 'residential',
    name: text(contact.displayName), suburb: text(project.siteAddress),
    widthM: null, depthM: null, heightM: null, style: '', roofMaterials: [], addOns: {},
  };
  const pricing = buildEnquiryPricingSnapshot(basis, null, {verifiedConfigurator: params.frozen});
  const row = buildEnquiryDraftEstimateRow({...basis, pricing, projectId: params.projectId,
    draftOrigin: 'staff_revision', createdBy: params.actorId,
    email: text(contact.email), phoneRaw: text(contact.phone), message: ''});
  const outputs = record(row.outputs), snapshot = record(outputs.snapshot);
  // Retain the project's recorded name/details, not a newly invented customer enquiry.
  snapshot.project = structuredClone(project);
  snapshot.revision = {sourceEstimateId: params.sourceEstimateId, actorUserId: params.actorId};
  return row;
}
