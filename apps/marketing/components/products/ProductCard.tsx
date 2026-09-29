import Image from 'next/image';
import Link from 'next/link';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import { Heading } from '../marketing-foundation/Primitives';
import { PRODUCT_DESIGNS, type ProductDesignType } from './productDesigns';
import type { ProductSelection } from './productSelection';
import ProductComparisonPrice from './ProductComparisonPrice';
import styles from './product-hub.module.css';
import type { ProductComparisonTable } from './productComparisonTable';

type ProductCardProps = { type: ProductDesignType; title: string; description: string; selection: ProductSelection; table: ProductComparisonTable; priority?: boolean };

export default function ProductCard({ type, title, description, selection, table, priority = false }: ProductCardProps) {
  return <article className={styles.card} id={`compare-${type}`} data-product-type={type}>
    <Heading as="h2" variant="card">{title}</Heading>
    <div className={styles.image}><Image src={`/images/homepage-challenger-rooflines/${PRODUCT_DESIGNS[type].imageFamily}-daylight.webp`} alt={`${title} pergola design illustration, house-attached with acrylic roofing and open sides`} width={1120} height={1400} sizes="(max-width:760px) calc(100vw - 40px), 33vw" priority={priority} /></div>
    <p className={styles.description}>{description}</p>
    <ProductComparisonPrice type={type} selection={selection} table={table} />
    <Link className={styles.explore} href={`/products/pergolas/${type}`}>Explore {title} <ArrowUpRight /></Link>
  </article>;
}
