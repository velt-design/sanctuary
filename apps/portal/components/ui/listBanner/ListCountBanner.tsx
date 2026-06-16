import { shouldShowListCountWarning } from '@/lib/list/listLimits';
import styles from './ListCountBanner.module.css';

/**
 * PR-PG1 (2026-06-16): inline banner that surfaces list-fetch scale to
 * staff when a list approaches the silent-truncation ceiling. Rendered
 * above the table on every staff list page.
 *
 * PR-PG1c (2026-06-16): added the `truncated` prop. When the chunked
 * fetch hit `MAX_LIST_FETCH_ROWS` before exhausting the table, banner
 * fires unconditionally with a stronger "Showing first N of M" copy
 * (count may be null when PostgREST capped it too).
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
  truncated = false,
}: {
  totalCount: number | null;
  visibleCount: number;
  entityLabelSingular: string;
  entityLabelPlural: string;
  truncated?: boolean;
}) {
  if (!shouldShowListCountWarning(visibleCount, totalCount, { truncated })) return null;

  const formattedVisible = visibleCount.toLocaleString();
  const formattedTotal = typeof totalCount === 'number' ? totalCount.toLocaleString() : null;
  const entityLabel = visibleCount === 1 ? entityLabelSingular : entityLabelPlural;

  let message: string;
  if (truncated) {
    message = formattedTotal
      ? `Showing first ${formattedVisible} of ${formattedTotal} ${entityLabel}. Use search or filter to find specific entries; cursor pagination is needed for the full list — file a ticket.`
      : `Showing first ${formattedVisible} ${entityLabel} — there may be more. Use search or filter to find specific entries; cursor pagination is needed for the full list — file a ticket.`;
  } else {
    message = formattedTotal
      ? `Showing ${formattedVisible} of ${formattedTotal} ${entityLabel}. Use search or filter to find what you need; very large lists may need cursor pagination — file a ticket.`
      : `Showing ${formattedVisible} ${entityLabel}. The list may be approaching the size where cursor pagination is needed — file a ticket if you notice missing rows.`;
  }

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.icon}>Heads up</span>
      <span>{message}</span>
    </div>
  );
}
