import { buildEnquiryHref, type EnquiryContext } from './enquiryContext';
import { PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE, type ProjectPriority } from './projectFinderContract';

export function buildHomeConfiguratorHref(priorities: ProjectPriority[] = []): string {
  return buildConfiguratorEnquiryHref({
    enquiryType: 'residential', sourcePath: '/', sourceComponent: 'project_finder',
    sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
    projectDirection: 'cover', projectPriorities: priorities,
  });
}

/** Keep governed source attribution when moving from a brief into the designer. */
export function buildConfiguratorEnquiryHref(context: EnquiryContext = {}): string {
  const enquiryHref = buildEnquiryHref(context).split('#')[0];
  const [pathname, query = ''] = enquiryHref.split('?');
  const params = new URLSearchParams(query);
  params.set('configurator', 'preview');
  return `${pathname}?${params.toString()}`;
}

export function buildAssistedEnquiryHref(context: EnquiryContext, intent: 'help' | 'bespoke'): string {
  const [path, hash] = buildEnquiryHref(context).split('#');
  return `${path}${path.includes('?') ? '&' : '?'}enquiry_intent=${intent}#${hash}`;
}
