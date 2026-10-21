import Image from 'next/image';
import Link from 'next/link';
import ArrowUpRight from '../../components/marketing-foundation/ArrowUpRight';
import styles from './pitched.module.css';

export default function PitchedSection() {
  return <figure className={styles.roofProfile}>
    <div className={styles.roofProfileImage}>
      <Image src="/images/project-velskov-02.jpg" alt="The complete freestanding Velskov roof slopes from its high left edge to its low right edge beneath the forest canopy" width={3000} height={2000} sizes="(max-width: 1440px) 92vw, 1312px"/>
      <span className={`${styles.roofLabel} ${styles.highEdge}`} aria-hidden="true">High edge</span>
      <span className={`${styles.roofLabel} ${styles.lowEdge}`} aria-hidden="true">Low edge</span>
    </div>
    <figcaption><span>Velskov Forest. A freestanding pitched shelter with one clear roof plane.</span><Link className={styles.textLink} href="/projects/velskov-forest">See Velskov Forest<ArrowUpRight/></Link></figcaption>
  </figure>;
}
