import Link from 'next/link';
import { LANDING_REDESIGN_PATH } from '@/components/configurator-prototype/draftScope';
import styles from './comparison.module.css';

export default function ComparisonLink({ redesign = false }: { redesign?: boolean }) {
  return <nav className={styles.compare} aria-label="Page comparison">
    <span>Design preview {redesign ? '02' : '01'}</span>
    <Link href={redesign ? '/pergolas-auckland' : LANDING_REDESIGN_PATH} prefetch={false}>
      {redesign ? 'View original page' : 'View new design'} <span aria-hidden="true">↗</span>
    </Link>
  </nav>;
}
