import Image from 'next/image';
import { PRODUCT_DESIGNS, type ProductDesignType } from './productDesigns';
import styles from './product-selection.module.css';

/** Immediate server-rendered fallback; never presented as the saved live design. */
export default function ProductPreviewPoster({ type }: { type: ProductDesignType }) {
  return <div className={styles.previewPoster} aria-live="polite">
    <Image src={`/images/configurator/shape-${PRODUCT_DESIGNS[type].imageFamily}-v1.webp`} alt="Starting roofline illustration" fill sizes="(max-width:760px) 100vw, 60vw" priority style={{ objectFit: 'contain' }}/>
    <span role="status">Starting design · Loading your 3D choices…</span>
  </div>;
}
