export type EnquiryAudience = 'residential' | 'commercial' | 'professional';

type EnquirySourceComponent =
  | 'header'
  | 'hero'
  | 'pathway'
  | 'project_cta'
  | 'product_cta'
  | 'final_cta'
  | 'embedded_form';

export type EnquiryContext = {
  enquiryType?: EnquiryAudience;
  sourcePath?: string;
  sourceComponent?: EnquirySourceComponent;
  sourceProject?: string;
  sourceProduct?: string;
};

type EnquiryContextProperties = {
  enquiry_type?: EnquiryAudience;
  source_path?: string;
  source_component?: EnquirySourceComponent;
  source_project?: string;
  source_product?: string;
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
  'embedded_form',
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PATH_LENGTH = 240;
const MAX_SLUG_LENGTH = 100;
const contextPropertyKeys = [
  'enquiry_type',
  'source_path',
  'source_component',
  'source_project',
  'source_product',
] as const satisfies ReadonlyArray<keyof EnquiryContextProperties>;

const serviceAudienceByPath = new Map<string, EnquiryAudience>([
  ['/', 'residential'],
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
  ['/acrylic-roof-pergolas-auckland-v2', 'residential'],
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

  return {
    ...(enquiryType ? { enquiryType } : {}),
    ...(sourcePath ? { sourcePath } : {}),
    ...(sourceComponent ? { sourceComponent } : {}),
    ...(sourceProject ? { sourceProject } : {}),
    ...(sourceProduct ? { sourceProduct } : {}),
  };
}

export function buildEnquiryHref(context: EnquiryContext = {}): string {
  const normalized = parseEnquiryContext({
    enquiry_type: context.enquiryType,
    source_path: context.sourcePath,
    source_component: context.sourceComponent,
    source_project: context.sourceProject,
    source_product: context.sourceProduct,
  });
  const params = new URLSearchParams();

  if (normalized.enquiryType) params.set('enquiry_type', normalized.enquiryType);
  if (normalized.sourcePath) params.set('source_path', normalized.sourcePath);
  if (normalized.sourceComponent) {
    params.set('source_component', normalized.sourceComponent);
  }
  if (normalized.sourceProject) params.set('source_project', normalized.sourceProject);
  if (normalized.sourceProduct) params.set('source_product', normalized.sourceProduct);

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
  });

  return {
    ...(normalized.enquiryType ? { enquiry_type: normalized.enquiryType } : {}),
    ...(normalized.sourcePath ? { source_path: normalized.sourcePath } : {}),
    ...(normalized.sourceComponent
      ? { source_component: normalized.sourceComponent }
      : {}),
    ...(normalized.sourceProject ? { source_project: normalized.sourceProject } : {}),
    ...(normalized.sourceProduct ? { source_product: normalized.sourceProduct } : {}),
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
  if (serviceAudience) return { enquiryType: serviceAudience };

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
