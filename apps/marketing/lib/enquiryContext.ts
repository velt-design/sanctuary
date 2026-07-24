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

export type EnquiryContextProperties = {
  enquiry_type?: EnquiryAudience;
  source_path?: string;
  source_component?: EnquirySourceComponent;
  source_project?: string;
  source_product?: string;
};

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

export function inferEnquiryAudience(pathname: string): EnquiryAudience | undefined {
  if (pathname === '/commercial-pergolas-auckland') return 'commercial';
  if (pathname === '/contact') return undefined;
  return 'residential';
}
