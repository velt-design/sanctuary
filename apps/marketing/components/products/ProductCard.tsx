import Image from 'next/image';
import Link from 'next/link';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import { Heading } from '../marketing-foundation/Primitives';
import { PRODUCT_DESIGNS, type ProductDesignType } from './productDesigns';
import ProductExamplePrice from './ProductExamplePrice';
import styles from './product-hub.module.css';

type ProductCardProps = { type: ProductDesignType; title: string; description: string; connection: string; priority?: boolean; compact?: boolean };

export default function ProductCard({ type, title, description, connection, priority = false, compact = false }: ProductCardProps) {
  return <article className={`${styles.card} ${compact ? styles.compactCard : ''}`} data-product-type={type}>
    <div className={styles.image}><Image src={`/images/portrait-roofline-trial/${PRODUCT_DESIGNS[type].imageFamily}-${type === 'gable' ? 'v1' : 'v2'}.webp`} alt={`${title} pergola illustration, attached to a house with acrylic roofing and open sides`} width={1120} height={1400} sizes="(max-width:760px) 100vw, 33vw" priority={priority}/><span>Design illustration</span></div>
    <div className={styles.body}>
      <Heading as={compact ? 'h3' : 'h2'} variant="card">{title}</Heading><p className={styles.description}>{description}</p>
      <div className={styles.spec}><span>6 × 3 m example</span><span>Acrylic roof · Open sides</span><small>{connection} · Ground level</small></div>
      <ProductExamplePrice type={type}/>
      <Link className={styles.explore} href={`/products/pergolas/${type}`}>Explore {title} <ArrowUpRight/></Link>
    </div>
  </article>;
}
