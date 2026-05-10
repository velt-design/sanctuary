'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  estimateDetailQueryOptions,
  estimateMetasByProjectQueryOptions,
} from '@/lib/queries/projectEstimates';
import { quoteVersionsByProjectQueryOptions } from '@/lib/queries/quotes';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { resolveProjectCurrentDesign } from '@/lib/projects/currentDesign/resolve';
import {
  summarizeCurrentDesign,
  type CurrentDesignStatusVariant,
} from '@/lib/projects/currentDesign/summarize';
import styles from './ProjectActivityDesignSnapshotBar.module.css';

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

// Variants that read as "noteworthy" get pill chrome. Muted/draft states render as
// plain muted text so the absence of news doesn't visually outweigh the actual data.
const PILL_VARIANT_CLASS: Partial<Record<CurrentDesignStatusVariant, string>> = {
  accepted: styles.pill_accepted!,
  sent: styles.pill_sent!,
  declined: styles.pill_declined!,
};

export default function ProjectActivityDesignSnapshotBar({ projectId }: { projectId: string }) {
  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const estimatesQuery = useQuery(estimateMetasByProjectQueryOptions(hostKey, projectId));
  const quotesQuery = useQuery(quoteVersionsByProjectQueryOptions(hostKey, projectId));

  const resolved = useMemo(
    () =>
      resolveProjectCurrentDesign({
        estimates: estimatesQuery.data ?? [],
        quoteVersions: quotesQuery.data ?? [],
      }),
    [estimatesQuery.data, quotesQuery.data],
  );

  const detailQuery = useQuery({
    ...estimateDetailQueryOptions(hostKey, resolved.estimate?.id ?? ''),
    enabled: Boolean(resolved.estimate?.id),
  });

  const summary = useMemo(
    () => summarizeCurrentDesign(resolved, detailQuery.data?.calculatorSnapshot ?? null),
    [resolved, detailQuery.data],
  );

  if (summary.isEmpty) {
    return (
      <aside className={styles.bar} aria-label="Current design snapshot">
        <div className={styles.data}>
          <span className={styles.label}>Current design</span>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.emptyHint}>No design selected</span>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.emptyHint}>Create or refresh a quote to show size, shape, and price</span>
        </div>
      </aside>
    );
  }

  const pillClass = PILL_VARIANT_CLASS[summary.statusVariant];

  return (
    <aside
      className={styles.bar}
      aria-label="Current design snapshot"
      data-current-design-source={resolved.source}
    >
      <div className={styles.data}>
        <span className={styles.label}>Current design</span>
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.size}>{summary.size}</span>
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.shape}>{summary.shape}</span>
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.price}>{summary.totalLabel}</span>
        {pillClass ? (
          <span className={cx(styles.pill, pillClass)} data-status-variant={summary.statusVariant}>
            {summary.statusLabel}
          </span>
        ) : (
          <span className={styles.statusText} data-status-variant={summary.statusVariant}>
            {summary.statusLabel}
          </span>
        )}
      </div>
      {summary.quoteVersionId ? (
        <Link
          className={styles.viewLink}
          href={`?tab=quotes&quoteId=${encodeURIComponent(summary.quoteVersionId)}`}
        >
          View quote
        </Link>
      ) : summary.estimateId ? (
        <Link className={styles.viewLink} href="?tab=estimates">
          View design
        </Link>
      ) : null}
    </aside>
  );
}
