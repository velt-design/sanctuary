import { projects } from '../../data/projects';
import { products } from '../../data/products';
import { parseEnquiryContext, type EnquiryContext, type EnquiryContextSearchParams } from '../../lib/enquiryContext';
import { resolveGuidedJourneyContext } from '../../lib/guidedJourneyContext';
import { resolveProjectFinderJourneyContext, resolveProjectFinderProjectJourneyContext } from '../../lib/projectFinderContinuation';
import { isResidentialProjectDirection } from '../../lib/projectFinderContract';
import { BLINDS_ROUTE } from './content';

/** Carry a real incoming brief without assigning this guide a new recommendation. */
export function resolveBlindsContext(params: EnquiryContextSearchParams) {
  const carried = parseEnquiryContext(params, { projectSlugs: projects.map(item => item.slug), productSlugs: products.map(item => item.slug) });
  const direction = carried.projectDirection ?? (typeof params.project === 'string' ? params.project : undefined);
  const finder = isResidentialProjectDirection(direction) ? resolveProjectFinderJourneyContext(direction, {
    project: direction, priorities: carried.projectPriorities?.join(',') ?? params.priorities,
  }) : null;
  const reference = typeof params.reference === 'string' && projects.some(item => item.slug === params.reference)
    ? resolveProjectFinderProjectJourneyContext(params.reference, params) : null;
  const pathway = carried.sourcePathway;
  const guided = pathway === 'residential-cover' || pathway === 'outdoor-room' || pathway === 'bespoke'
    ? resolveGuidedJourneyContext(pathway, { focus: carried.sourceFocus, use: carried.sourceFocus, constraint: carried.sourceFocus }) : null;
  const context: EnquiryContext = {
    enquiryType: 'residential', sourcePath: BLINDS_ROUTE, sourceComponent: 'embedded_form',
    ...finder?.enquiryContext, ...reference?.enquiryContext, ...carried,
  };
  const sourceProject = projects.find(item => item.slug === context.sourceProject);
  return { context, guided, finder: guided ? null : finder, sourceProject };
}
