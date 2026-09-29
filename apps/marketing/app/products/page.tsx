import ProductsHub from '@/components/products/ProductsHub';

// Compare only the currently published, release-approved pricing snapshot.
export const dynamic = 'force-dynamic';

export default function ProductsPage() {
  return <ProductsHub />;
}
