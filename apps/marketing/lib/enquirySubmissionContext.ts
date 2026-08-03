import {
  parseEnquiryContext,
  type EnquiryContext,
} from './enquiryContext';

type KnownEnquiryContext = {
  projectSlugs: Iterable<string>;
  productSlugs: Iterable<string>;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function parseSubmittedEnquiryContext(
  rawContext: Record<string, unknown>,
  knownContext: KnownEnquiryContext,
): EnquiryContext {
  const rawPriorities = rawContext.project_priorities;

  return parseEnquiryContext(
    {
      enquiry_type: stringValue(rawContext.enquiry_type),
      source_path: stringValue(rawContext.source_path),
      source_component: stringValue(rawContext.source_component),
      source_project: stringValue(rawContext.source_project),
      source_product: stringValue(rawContext.source_product),
      source_experience: stringValue(rawContext.source_experience),
      source_pathway: stringValue(rawContext.source_pathway),
      source_focus: stringValue(rawContext.source_focus),
      project_direction: stringValue(rawContext.project_direction),
      project_professional_path: stringValue(
        rawContext.project_professional_path,
      ),
      project_priorities: Array.isArray(rawPriorities)
        ? rawPriorities.join(',')
        : stringValue(rawPriorities),
    },
    knownContext,
  );
}
