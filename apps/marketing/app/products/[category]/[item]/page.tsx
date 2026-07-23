import { notFound } from 'next/navigation';
import ProductDetailPage from '@/components/products/ProductDetailPage';
import { getProduct, products } from '@/data/products';

type ProductPageProps = {
  params: Promise<{
    category: string;
    item: string;
  }>;
};

export function generateStaticParams() {
  return products.map((product) => ({
    category: product.categorySlug,
    item: product.slug,
  }));
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { category, item } = await params;
  const product = getProduct(category, item);

  if (!product) {
    notFound();
  }

  return <ProductDetailPage product={product} />;
}
