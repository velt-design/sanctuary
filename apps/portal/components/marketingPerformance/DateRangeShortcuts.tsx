import { Button } from '@/components/ui/foundation/FoundationControls';
import { dateRanges, matchingPreset, presetDates } from '@/lib/marketingPerformance/dateRanges';
import styles from './MarketingPerformance.module.css';

export default function DateRangeShortcuts({ start, end, onSelect }: {
  start: string; end: string; onSelect: (dates: { start: string; end: string }) => void;
}) {
  const selected = matchingPreset(start, end);
  return <div className={styles.rangeShortcuts} role="group" aria-label="Quick date ranges">
    {dateRanges.map(([key, label]) => <Button key={key} type="button" variant={selected === key ? 'primary' : 'secondary'} aria-pressed={selected === key}
      onClick={() => onSelect(presetDates(key))}>{label}</Button>)}
    <span className={styles.muted}>{selected ? 'Or choose custom dates below' : 'Custom date range'}</span>
  </div>;
}
