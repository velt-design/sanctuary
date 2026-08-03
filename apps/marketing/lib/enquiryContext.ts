import {
  GUIDED_ENQUIRY_SOURCE_EXPERIENCE,
  guidedBusinessRoles,
  guidedCoverFocuses,
  guidedOutdoorUses,
  guidedProfessionalNeeds,
  guidedResultIds,
  guidedSiteConstraints,
  type GuidedFocusId,
  type GuidedResultId,
} from './guidedJourneyContract';
import {
  PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
  PROJECT_FINDER_HOME_PATH,
  isCommercialProfessionalPath,
  isProjectDirection,
  isResidentialProjectDirection,
  normalizeProjectPriorities,
  type CommercialProfessionalPath,
  type ProjectDirection,
  type ProjectPriority,
} from './projectFinderContract';

export type EnquiryAudience = 'residential' | 'commercial' | 'professional';

type EnquirySourceComponent =
  | 'header'
  | 'hero'
  | 'pathway'
  | 'project_cta'
  | 'product_cta'
  | 'final_cta'
  | 'footer'
  | 'embedded_form'
  | 'project_finder'
  | 'brief_summary'
  | 'project_card';

type EnquirySourceExperience =
  | typeof GUIDED_ENQUIRY_SOURCE_EXPERIENCE
  | typeof PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE;

export type EnquiryContext = {
  enquiryType?: EnquiryAudience;
  sourcePath?: string;
  sourceComponent?: EnquirySourceComponent;
  sourceProject?: string;
  sourceProduct?: string;
  sourceExperience?: EnquirySourceExperience;
  sourcePathway?: GuidedResultId;
  sourceFocus?: GuidedFocusId;
  projectDirection?: ProjectDirection;
  projectProfessionalPath?: CommercialProfessionalPath;
  projectPriorities?: ProjectPriority[];
};

type EnquiryContextProperties = {
  enquiry_type?: EnquiryAudience;
  source_path?: string;
  source_component?: EnquirySourceComponent;
  source_project?: string;
  source_product?: string;
  source_experience?: EnquirySourceExperience;
  source_pathway?: GuidedResultId;
  source_focus?: GuidedFocusId;
  project_direction?: ProjectDirection;
  project_professional_path?: CommercialProfessionalPath;
  project_priorities?: ProjectPriority[];
};

type EnquiryAnalyticsProperties = Record<string, unknown>
  & EnquiryContextProperties;

type SearchValue = string | string[] | undefined;
export type EnquiryContextSearchParams = Record<string, SearchValue>;

type KnownContext = {
  projectSlugs?: Iterable<string>;
  productSlugs?: Iterable<string>;
};

const enquiryAudiences = new Set<EnquiryAudience>([
  'residential',
  'commercial',
  'professional',
]);

const sourceComponents = new Set<EnquirySourceComponent>([
  'header',
  'hero',
  'pathway',
  'project_cta',
  'product_cta',
  'final_cta',
  'footer',
  'embedded_form',
  'project_finder',
  'brief_summary',
  'project_card',
]);
const guidedPathways = new Set<GuidedResultId>(guidedResultIds);
const guidedFocuses = new Set<GuidedFocusId>([
  ...guidedCoverFocuses,
  ...guidedOutdoorUses,
  ...guidedSiteConstraints,
  ...guidedBusinessRoles,
  ...guidedProfessionalNeeds,
]);
const guidedFocusesByPathway: Record<GuidedResultId, ReadonlySet<GuidedFocusId>> = {
  'residential-cover': new Set(guidedCoverFocuses),
  'outdoor-room': new Set(guidedOutdoorUses),
  bespoke: new Set(guidedSiteConstraints),
  commercial: new Set(guidedBusinessRoles),
  professional: new Set(guidedProfessionalNeeds),
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PATH_LENGTH = 240;
const MAX_SLUG_LENGTH = 100;
const contextPropertyKeys = [
  'enquiry_type',
  'source_path',
  'source_component',
  'source_project',
  'source_product',
  'source_experience',
  'source_pathway',
  'source_focus',
  'project_direction',
  'project_professional_path',
  'project_priorities',
] as const satisfies ReadonlyArray<keyof EnquiryContextProperties>;

const serviceAudienceByPath = new Map<string, EnquiryAudience>([
  [PROJECT_FINDER_HOME_PATH, 'residential'],
  ['/pergolas-auckland', 'residential'],
  ['/custom-pergolas-auckland', 'residential'],
  ['/aluminium-pergolas-auckland', 'residential'],
  ['/pergola-cost-auckland', 'residential'],
  ['/gable-pergolas-auckland', 'residential'],
  ['/pitched-pergolas-auckland', 'residential'],
  ['/outdoor-rooms-auckland', 'residential'],
  ['/pergolas-with-blinds', 'residential'],
  ['/acrylic-pergolas-vs-louvre-roofs', 'residential'],
  ['/acrylic-roof-pergolas-auckland', 'residential'],
  ['/commercial-pergolas-auckland', 'commercial'],
  ['/architects-designers-builders', 'professional'],
]);

// This compact route index keeps the global client header independent from the
// full project catalogue. The catalogue parity test must be updated with every
// project so a new route cannot silently inherit an audience.
const projectAudienceBySlug = new Map<string, Exclude<EnquiryAudience, 'professional'>>([
  ['warkworth-outdoor-room', 'residential'],
  ['mt-maunganui-box', 'residential'],
  ['lilliput-mini-golf', 'commercial'],
  ['waiheke-holiday-home', 'residential'],
  ['goodhome-commercial-terrace', 'commercial'],
  ['kiwi-rail-platform', 'commercial'],
  ['tindalls-bay-pavilion', 'residential'],
  ['atelier-shu-cafe', 'commercial'],
  ['muriwai-courtyard', 'residential'],
  ['velskov-forest', 'commercial'],
  ['ardmore-box-carport', 'residential'],
  ['riverhead-gable-pavilion', 'residential'],
  ['st-heliers-townhouse', 'residential'],
  ['dairy-flat-estate', 'residential'],
]);

const productSlugByPath = new Map<string, string>([
  ['/products/pergolas/pitched', 'pitched'],
  ['/products/pergolas/gable', 'gable'],
  ['/products/pergolas/hip', 'hip'],
  ['/products/pergolas/box-perimeter', 'box-perimeter'],
  ['/products/screens-walls/slat-screens', 'slat-screens'],
  ['/products/screens-walls/acrylic-infill-panels', 'acrylic-infill-panels'],
  ['/products/screens-walls/drop-down-blinds', 'drop-down-blinds'],
  ['/products/lighting-heating/downlights', 'downlights'],
  ['/products/lighting-heating/led-strip-lighting', 'led-strip-lighting'],
  ['/products/lighting-heating/patio-heaters', 'patio-heaters'],
]);

function firstValue(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeAudience(value: SearchValue): EnquiryAudience | undefined {
  const normalized = firstValue(value)?.trim().toLowerCase() as EnquiryAudience | undefined;
  return normalized && enquiryAudiences.has(normalized) ? normalized : undefined;
}

function normalizeSourceComponent(
  value: SearchValue,
): EnquirySourceComponent | undefined {
  const normalized = firstValue(value)?.trim().toLowerCase() as
    | EnquirySourceComponent
    | undefined;
  return normalized && sourceComponents.has(normalized) ? normalized : undefined;
}

function normalizeSourceExperience(
  value: SearchValue,
): EnquirySourceExperience | undefined {
  const normalized = firstValue(value)?.trim().toLowerCase();
  if (normalized === GUIDED_ENQUIRY_SOURCE_EXPERIENCE) {
    return GUIDED_ENQUIRY_SOURCE_EXPERIENCE;
  }
  if (normalized === PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE) {
    return PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE;
  }
  return undefined;
}

function normalizeGuidedPathway(value: SearchValue): GuidedResultId | undefined {
  const normalized = firstValue(value)?.trim().toLowerCase() as
    | GuidedResultId
    | undefined;
  return normalized && guidedPathways.has(normalized) ? normalized : undefined;
}

function normalizeGuidedFocus(value: SearchValue): GuidedFocusId | undefined {
  const normalized = firstValue(value)?.trim().toLowerCase() as
    | GuidedFocusId
    | undefined;
  return normalized && guidedFocuses.has(normalized) ? normalized : undefined;
}

function normalizeProjectDirection(
  value: SearchValue,
): ProjectDirection | undefined {
  const normalized = firstValue(value)?.trim().toLowerCase();
  return isProjectDirection(normalized) ? normalized : undefined;
}

function normalizeFinderPriorities(value: SearchValue): ProjectPriority[] {
  if (Array.isArray(value) || typeof value !== 'string') return [];
  return normalizeProjectPriorities(value.split(','));
}

function normalizeProjectProfessionalPath(
  value: SearchValue,
): CommercialProfessionalPath | undefined {
  const normalized = firstValue(value)?.trim().toLowerCase();
  return isCommercialProfessionalPath(normalized) ? normalized : undefined;
}

export function getCanonicalMarketingPathname(
  pathname: string | null,
): string {
  // Next's optimized static root can expose the public URL as its filesystem
  // alias. Shared route-aware conversion links must retain the canonical root.
  return !pathname || pathname === '/index' ? '/' : pathname;
}

function normalizeSourcePath(value: SearchValue): string | undefined {
  const normalized = firstValue(value)?.trim();
  if (
    !normalized
    || normalized.length > MAX_PATH_LENGTH
    || !normalized.startsWith('/')
    || normalized.startsWith('//')
    || normalized.includes('\\')
    || normalized.includes('?')
    || normalized.includes('#')
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function normalizeSlug(
  value: SearchValue,
  knownValues?: Iterable<string>,
): string | undefined {
  const normalized = firstValue(value)?.trim().toLowerCase();
  if (
    !normalized
    || normalized.length > MAX_SLUG_LENGTH
    || !SLUG_PATTERN.test(normalized)
  ) {
    return undefined;
  }
  if (knownValues && !new Set(knownValues).has(normalized)) return undefined;
  return normalized;
}

export function parseEnquiryContext(
  searchParams: EnquiryContextSearchParams,
  knownContext: KnownContext = {},
): EnquiryContext {
  const enquiryType = normalizeAudience(
    searchParams.enquiry_type ?? searchParams.enquiry,
  );
  const sourcePath = normalizeSourcePath(searchParams.source_path);
  const sourceComponent = normalizeSourceComponent(searchParams.source_component);
  const sourceProject = normalizeSlug(
    searchParams.source_project,
    knownContext.projectSlugs,
  );
  const sourceProduct = normalizeSlug(
    searchParams.source_product,
    knownContext.productSlugs,
  );
  const sourceExperience = normalizeSourceExperience(
    searchParams.source_experience,
  );
  const sourcePathway = normalizeGuidedPathway(searchParams.source_pathway);
  const sourceFocus = normalizeGuidedFocus(searchParams.source_focus);
  const hasCompleteGuidedContext = Boolean(
    sourceExperience === GUIDED_ENQUIRY_SOURCE_EXPERIENCE
      && sourcePathway
      && sourceFocus
      && guidedFocusesByPathway[sourcePathway].has(sourceFocus),
  );
  const projectDirection = normalizeProjectDirection(
    searchParams.project_direction,
  );
  const projectProfessionalPath = projectDirection === 'commercial-professional'
    ? normalizeProjectProfessionalPath(searchParams.project_professional_path)
    : undefined;
  const projectPriorities = isResidentialProjectDirection(projectDirection)
    ? normalizeFinderPriorities(searchParams.project_priorities)
    : [];
  const hasProjectFinderContext =
    sourceExperience === PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE;

  return {
    ...(enquiryType ? { enquiryType } : {}),
    ...(sourcePath ? { sourcePath } : {}),
    ...(sourceComponent ? { sourceComponent } : {}),
    ...(sourceProject ? { sourceProject } : {}),
    ...(sourceProduct ? { sourceProduct } : {}),
    ...(hasCompleteGuidedContext
      ? { sourceExperience, sourcePathway, sourceFocus }
      : {}),
    ...(hasProjectFinderContext
      ? {
          sourceExperience,
          ...(projectDirection ? { projectDirection } : {}),
          ...(projectProfessionalPath ? { projectProfessionalPath } : {}),
          ...(projectPriorities.length ? { projectPriorities } : {}),
        }
      : {}),
  };
}

export function buildEnquiryHref(context: EnquiryContext = {}): string {
  const normalized = parseEnquiryContext({
    enquiry_type: context.enquiryType,
    source_path: context.sourcePath,
    source_component: context.sourceComponent,
    source_project: context.sourceProject,
    source_product: context.sourceProduct,
    source_experience: context.sourceExperience,
    source_pathway: context.sourcePathway,
    source_focus: context.sourceFocus,
    project_direction: context.projectDirection,
    project_professional_path: context.projectProfessionalPath,
    project_priorities: context.projectPriorities?.join(','),
  });
  const params = new URLSearchParams();

  if (normalized.enquiryType) params.set('enquiry_type', normalized.enquiryType);
  if (normalized.sourcePath) params.set('source_path', normalized.sourcePath);
  if (normalized.sourceComponent) {
    params.set('source_component', normalized.sourceComponent);
  }
  if (normalized.sourceProject) params.set('source_project', normalized.sourceProject);
  if (normalized.sourceProduct) params.set('source_product', normalized.sourceProduct);
  if (normalized.sourceExperience === GUIDED_ENQUIRY_SOURCE_EXPERIENCE) {
    params.set('source_experience', normalized.sourceExperience);
    params.set('source_pathway', normalized.sourcePathway!);
    params.set('source_focus', normalized.sourceFocus!);
  } else if (
    normalized.sourceExperience === PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE
  ) {
    params.set('source_experience', normalized.sourceExperience);
    if (normalized.projectDirection) {
      params.set('project_direction', normalized.projectDirection);
    }
    if (normalized.projectProfessionalPath) {
      params.set(
        'project_professional_path',
        normalized.projectProfessionalPath,
      );
    }
    if (normalized.projectPriorities?.length) {
      params.set('project_priorities', normalized.projectPriorities.join(','));
    }
  }

  const query = params.toString();
  return `/contact${query ? `?${query}` : ''}#contact-form`;
}

export function getEnquiryContextProperties(
  context: EnquiryContext,
): EnquiryContextProperties {
  const normalized = parseEnquiryContext({
    enquiry_type: context.enquiryType,
    source_path: context.sourcePath,
    source_component: context.sourceComponent,
    source_project: context.sourceProject,
    source_product: context.sourceProduct,
    source_experience: context.sourceExperience,
    source_pathway: context.sourcePathway,
    source_focus: context.sourceFocus,
    project_direction: context.projectDirection,
    project_professional_path: context.projectProfessionalPath,
    project_priorities: context.projectPriorities?.join(','),
  });

  return {
    ...(normalized.enquiryType ? { enquiry_type: normalized.enquiryType } : {}),
    ...(normalized.sourcePath ? { source_path: normalized.sourcePath } : {}),
    ...(normalized.sourceComponent
      ? { source_component: normalized.sourceComponent }
      : {}),
    ...(normalized.sourceProject ? { source_project: normalized.sourceProject } : {}),
    ...(normalized.sourceProduct ? { source_product: normalized.sourceProduct } : {}),
    ...(normalized.sourceExperience === GUIDED_ENQUIRY_SOURCE_EXPERIENCE
      ? {
          source_experience: normalized.sourceExperience,
          source_pathway: normalized.sourcePathway,
          source_focus: normalized.sourceFocus,
        }
      : {}),
    ...(normalized.sourceExperience === PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE
      ? {
          source_experience: normalized.sourceExperience,
          ...(normalized.projectDirection
            ? { project_direction: normalized.projectDirection }
            : {}),
          ...(normalized.projectProfessionalPath
            ? {
                project_professional_path:
                  normalized.projectProfessionalPath,
              }
            : {}),
          ...(normalized.projectPriorities?.length
            ? { project_priorities: normalized.projectPriorities }
            : {}),
        }
      : {}),
  };
}

export function getEnquiryAnalyticsProperties(
  context: EnquiryContext,
  properties: Record<string, unknown> = {},
): EnquiryAnalyticsProperties {
  const safeProperties = { ...properties };
  for (const key of contextPropertyKeys) delete safeProperties[key];

  return {
    ...safeProperties,
    ...getEnquiryContextProperties(context),
  };
}

export function getEnquiryRouteContext(pathname: string): EnquiryContext {
  const normalizedPath = normalizeSourcePath(pathname);
  if (!normalizedPath || normalizedPath === '/contact') return {};

  const serviceAudience = serviceAudienceByPath.get(normalizedPath);
  if (serviceAudience) {
    return {
      enquiryType: serviceAudience,
      ...(normalizedPath === PROJECT_FINDER_HOME_PATH
        ? { sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE }
        : {}),
    };
  }

  const projectMatch = normalizedPath.match(/^\/projects\/([a-z0-9-]+)$/);
  if (projectMatch) {
    const sourceProject = projectMatch[1];
    const enquiryType = projectAudienceBySlug.get(sourceProject);
    return enquiryType ? { enquiryType, sourceProject } : {};
  }

  const sourceProduct = productSlugByPath.get(normalizedPath);
  if (sourceProduct) return { sourceProduct };

  return {};
}

export function inferEnquiryAudience(pathname: string): EnquiryAudience | undefined {
  return getEnquiryRouteContext(pathname).enquiryType;
}
