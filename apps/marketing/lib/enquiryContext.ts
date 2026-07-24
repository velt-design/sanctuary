export const enquiryAudiences = [
  'residential',
  'commercial',
  'professional',
] as const;

export type EnquiryAudience = (typeof enquiryAudiences)[number];

export const enquirySourceComponents = [
  'header',
  'mobile-menu',
  'homepage-hero',
  'homepage-process',
  'homepage-final',
  'homepage-professional',
  'project-intro',
  'project-final',
  'products-index-hero',
  'products-index-final',
  'product-hero',
  'product-final',
  'embedded-enquiry',
] as const;

export type EnquirySourceComponent = (typeof enquirySourceComponents)[number];

export type EnquirySourceContext = {
  sourcePath?: string;
  sourceComponent?: EnquirySourceComponent;
  projectSlug?: string;
  productSlug?: string;
};

export type EnquiryLinkContext = EnquirySourceContext & {
  enquiryType?: EnquiryAudience;
};

const audienceSet = new Set<string>(enquiryAudiences);
const sourceComponentSet = new Set<string>(enquirySourceComponents);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const internalPathPattern = /^\/(?:[a-z0-9_-]+\/?)*$/;

const residentialHeaderRoutes = new Set([
  '/',
  '/home-v2',
  '/pergolas-auckland',
  '/custom-pergolas-auckland',
  '/aluminium-pergolas-auckland',
  '/pergola-cost-auckland',
  '/gable-pergolas-auckland',
  '/pitched-pergolas-auckland',
  '/outdoor-rooms-auckland',
  '/pergolas-with-blinds',
  '/acrylic-pergolas-vs-louvre-roofs',
  '/acrylic-roof-pergolas-auckland',
  '/acrylic-roof-pergolas-auckland-v2',
]);

function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

function normalizeAudience(value: unknown): EnquiryAudience | undefined {
  const normalized = firstString(value)?.trim().toLowerCase();
  return normalized && audienceSet.has(normalized)
    ? normalized as EnquiryAudience
    : undefined;
}

function normalizeSourceComponent(
  value: unknown,
): EnquirySourceComponent | undefined {
  const normalized = firstString(value)?.trim().toLowerCase();
  return normalized && sourceComponentSet.has(normalized)
    ? normalized as EnquirySourceComponent
    : undefined;
}

function normalizeSlug(value: unknown): string | undefined {
  const normalized = firstString(value)?.trim().toLowerCase();
  return normalized
    && normalized.length <= 100
    && slugPattern.test(normalized)
    ? normalized
    : undefined;
}

function normalizeSourcePath(value: unknown): string | undefined {
  const normalized = firstString(value)?.trim();
  return normalized
    && normalized.length <= 200
    && internalPathPattern.test(normalized)
    && !normalized.startsWith('//')
    ? normalized
    : undefined;
}

function searchValue(
  input: URLSearchParams | Record<string, unknown>,
  key: string,
): unknown {
  return input instanceof URLSearchParams ? input.get(key) ?? undefined : input[key];
}

export function parseEnquiryContext(
  input: URLSearchParams | Record<string, unknown>,
): EnquiryLinkContext {
  const enquiryType = normalizeAudience(searchValue(input, 'enquiry'));
  const sourcePath = normalizeSourcePath(searchValue(input, 'source_path'));
  const sourceComponent = normalizeSourceComponent(
    searchValue(input, 'source_component'),
  );
  const projectSlug = normalizeSlug(searchValue(input, 'project'));
  const productSlug = normalizeSlug(searchValue(input, 'product'));

  return {
    ...(enquiryType ? { enquiryType } : {}),
    ...(sourcePath ? { sourcePath } : {}),
    ...(sourceComponent ? { sourceComponent } : {}),
    ...(projectSlug ? { projectSlug } : {}),
    ...(productSlug ? { productSlug } : {}),
  };
}

export function normalizeEnquirySourceContext(
  value: unknown,
): EnquirySourceContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const sourcePath = normalizeSourcePath(input.sourcePath);
  const sourceComponent = normalizeSourceComponent(input.sourceComponent);
  const projectSlug = normalizeSlug(input.projectSlug);
  const productSlug = normalizeSlug(input.productSlug);

  return {
    ...(sourcePath ? { sourcePath } : {}),
    ...(sourceComponent ? { sourceComponent } : {}),
    ...(projectSlug ? { projectSlug } : {}),
    ...(productSlug ? { productSlug } : {}),
  };
}

export function buildEnquiryHref(context: EnquiryLinkContext = {}): string {
  const normalized = {
    ...normalizeEnquirySourceContext(context),
    enquiryType: normalizeAudience(context.enquiryType),
  };
  const search = new URLSearchParams();

  if (normalized.enquiryType) search.set('enquiry', normalized.enquiryType);
  if (normalized.sourcePath) search.set('source_path', normalized.sourcePath);
  if (normalized.sourceComponent) {
    search.set('source_component', normalized.sourceComponent);
  }
  if (normalized.projectSlug) search.set('project', normalized.projectSlug);
  if (normalized.productSlug) search.set('product', normalized.productSlug);

  const query = search.toString();
  return `/contact${query ? `?${query}` : ''}#contact-form`;
}

export function getHeaderEnquiryContext(pathname: string): EnquiryLinkContext {
  const sourcePath = normalizeSourcePath(pathname);
  if (!sourcePath) return {};

  if (sourcePath === '/commercial-pergolas-auckland') {
    return { enquiryType: 'commercial', sourcePath };
  }

  const projectMatch = sourcePath.match(/^\/projects\/([a-z0-9-]+)$/);
  if (projectMatch) {
    return { sourcePath, projectSlug: projectMatch[1] };
  }

  const productMatch = sourcePath.match(
    /^\/products\/[a-z0-9-]+\/([a-z0-9-]+)$/,
  );
  if (productMatch) {
    return {
      enquiryType: 'residential',
      sourcePath,
      productSlug: productMatch[1],
    };
  }

  if (sourcePath === '/products' || residentialHeaderRoutes.has(sourcePath)) {
    return { enquiryType: 'residential', sourcePath };
  }

  return { sourcePath };
}
