import { shouldShowListCountWarning } from '@/lib/list/listLimits';
import styles from './ListCountBanner.module.css';

/**
 * PR-PG1 (2026-06-16): inline banner that surfaces list-fetch scale to
 * staff when a list approaches the silent-truncation ceiling. Rendered
 * above the table on every staff list page.
 *
 * Why an inline banner and not a toast: the site-wide `ToastProvider`
 * silently suppresses non-error toasts
 * (see `apps/portal/components/ui/toast/ToastProvider.tsx`), so a
 * `toast.info(...)` for this would never appear. Truncation is also a
 * STATE, not an EVENT — a persistent banner is the right surface.
 */
export default function ListCountBanner({
  totalCount,
  visibleCount,
  entityLabelSingular,
  entityLabelPlural,
}: {
  totalCount: number | null;
  visibleCount: number;
  entityLabelSingular: string;
  entityLabelPlural: string;
}) {
  if (!shouldShowListCountWarning(visibleCount, totalCount)) return null;

  const formattedVisible = visibleCount.toLocaleString();
  const formattedTotal = typeof totalCount === 'number' ? totalCount.toLocaleString() : null;
  const entityLabel = visibleCount === 1 ? entityLabelSingular : entityLabelPlural;

  const message = formattedTotal
    ? `Showing ${formattedVisible} of ${formattedTotal} ${entityLabel}. Use search or filter to find what you need; very large lists may need cursor pagination — file a ticket.`
    : `Showing ${formattedVisible} ${entityLabel}. The list may be approaching the size where cursor pagination is needed — file a ticket if you notice missing rows.`;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.icon}>Heads up</span>
      <span>{message}</span>
    </div>
  );
}
