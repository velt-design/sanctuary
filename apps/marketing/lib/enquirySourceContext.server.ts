import 'server-only';
import { getProductBySlug } from '../data/products';
import { projects } from '../data/projects';
import {
  normalizeEnquirySourceContext,
  type EnquirySourceContext,
} from './enquiryContext';

const projectSlugs = new Set(projects.map((project) => project.slug));

export function normalizeKnownEnquirySourceContext(
  value: unknown,
): EnquirySourceContext {
  const normalized = normalizeEnquirySourceContext(value);

  return {
    ...(normalized.sourcePath ? { sourcePath: normalized.sourcePath } : {}),
    ...(normalized.sourceComponent
      ? { sourceComponent: normalized.sourceComponent }
      : {}),
    ...(normalized.projectSlug && projectSlugs.has(normalized.projectSlug)
      ? { projectSlug: normalized.projectSlug }
      : {}),
    ...(normalized.productSlug && getProductBySlug(normalized.productSlug)
      ? { productSlug: normalized.productSlug }
      : {}),
  };
}
