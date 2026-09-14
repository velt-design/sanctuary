import { buildSimpleCoverEnquiryPayload } from '../../lib/simpleCoverEnquiryPayload';
import type { ContactDesignBrief } from './contactDesignBrief';

/** Keep configured intent independent of whether a verified public price exists. */
export function buildContactDesignSubmission(design: ContactDesignBrief) {
  const legacy = buildSimpleCoverEnquiryPayload(design.estimate);
  return {
    dimensions: design.dimensions,
    style: design.style,
    roofMaterials: design.roofMaterials,
    calculationRef: design.configuredPrice?.calculationRef ?? legacy.calculationRef,
    simpleCoverStatus: design.estimate ? legacy.simpleCoverStatus : null,
    projectDetails: design.estimate ? legacy.projectDetails : {},
  };
}
