import type { ReactNode } from 'react';
import type { CommercialMetric } from '@/lib/marketingPerformance/commercial';
import styles from './CommercialOverview.module.css';

const commercialMetricLabels: Record<CommercialMetric, string> = {
  quoted: 'Quoted value', accepted: 'Accepted value', average: 'Average accepted quote',
  enquiryDays: 'Enquiry to first quote', acceptanceDays: 'First quote to acceptance',
};
export type CommercialMetricValue = { value: string; unavailable: boolean; note: ReactNode };

/** The same metric controls own their pending, unavailable and complete values. */
export default function CommercialMetricStrip({ values, pending, inspect, controlRef, timing = false }: {
  values?: Partial<Record<CommercialMetric, CommercialMetricValue>>;
  pending: boolean;
  inspect: (metric: CommercialMetric) => void;
  timing?: boolean;controlRef?:(metric:CommercialMetric,node:HTMLButtonElement|null)=>void;
}) {
  const keys: CommercialMetric[] = timing ? ['enquiryDays', 'acceptanceDays'] : ['quoted', 'accepted', 'average'];
  return <div aria-busy={pending} className={timing ? styles.timing : styles.metrics}>{keys.map(key => {
    const result = values?.[key];
    const control = <button key={key} ref={node=>controlRef?.(key,node)} disabled={!result} onClick={() => inspect(key)} aria-label={`Inspect ${commercialMetricLabels[key]}`} title={result?.value}>
      <span>{commercialMetricLabels[key]}</span>
      <strong data-unavailable={!result || result.unavailable || undefined}>{result?.value ?? (pending ? 'Reading…' : 'Unavailable')}</strong>
      <small>{result?.note ?? '\u00a0'}</small>
    </button>;
    return timing ? control : <div className={styles.metric} key={key}>{control}</div>;
  })}</div>;
}
