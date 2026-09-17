import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/data/products';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import { shouldShowMarketingFoundation } from '../../foundationAccess';
import ProductReference from '../ProductReference';
import ReferenceShell from '../ReferenceShell';
import { PRODUCT_REFERENCE } from '../referencePaths';

export const metadata: Metadata = { title: 'Gable — foundation reference', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function ProductReferencePage() {
  if (!shouldShowMarketingFoundation({ nodeEnv: process.env.NODE_ENV, enabled: process.env.ENABLE_MARKETING_FOUNDATION })) notFound();
  const product = getProductBySlug('gable');
  if (!product) notFound();
  const enquiryHref = buildEnquiryHref({ enquiryType: 'residential', sourcePath: PRODUCT_REFERENCE, sourceComponent: 'product_cta', sourceProduct: product.slug });
  return <ReferenceShell page="product" enquiryHref={enquiryHref}><ProductReference product={product} enquiryHref={enquiryHref} /></ReferenceShell>;
}
