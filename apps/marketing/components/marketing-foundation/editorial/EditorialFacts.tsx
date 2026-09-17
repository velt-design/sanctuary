import type { ReactNode } from 'react';
import { FactList } from '../Primitives';
import styles from './editorial.module.css';

export function EditorialFacts({ items, variant = 'details', className = '' }: {
  items: Array<{ label: ReactNode; value: ReactNode }>;
  variant?: 'summary' | 'details';
  className?: string;
}) {
  return <FactList items={items} layout="rows" data-fact-count={items.length} className={styles[variant] + ' ' + className} />;
}

export function MeasurementGroups({ value }: { value: string }) {
  return <>{value.split(' × ').map((part, index) => <span className={styles.measurement} key={part}>{index ? ' × ' : ''}{part}</span>)}</>;
}
