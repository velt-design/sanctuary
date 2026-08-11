'use client';

import { useMemo, useState } from 'react';

import {
  Badge,
  Button,
  DataStatePanel,
  EmptyState,
  LoadingSkeleton,
  SearchFilterBar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type BadgeTone,
} from '@/components/ui/foundation';
import type { EstimateMeta } from '@/lib/estimates/types';
import { formatPortalDate } from '@/lib/format/portalDateTime';
import styles from './EstimatesListView.module.css';

function estimateStatus(estimate: EstimateMeta): { label: string; tone: BadgeTone } {
  if (estimate.status === 'archived') return { label: 'Archived', tone: 'neutral' };
  if (estimate.isActiveDraft) return { label: 'Active draft', tone: 'success' };
  if (estimate.hasSentQuote) return { label: 'Quoted', tone: 'info' };
  return { label: 'Historical', tone: 'neutral' };
}

export default function EstimatesListView({
  estimates,
  loading,
  error,
  onRetry,
  onCreate,
  onOpen,
  onDuplicate,
  onRename,
}: {
  estimates: EstimateMeta[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onCreate: () => void;
  onOpen: (estimateId: string) => void;
  onDuplicate: (estimateId: string) => void;
  onRename: (estimate: EstimateMeta) => void;
}) {
  const [query, setQuery] = useState('');
  const visibleEstimates = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return estimates;
    return estimates.filter((estimate) => [
      estimate.internalName,
      estimate.versionLabel,
      estimate.createdBy,
    ].some((value) => String(value ?? '').toLocaleLowerCase().includes(needle)));
  }, [estimates, query]);

  return (
    <div className={styles.wrapper} role="region" aria-label="Estimates" data-estimates-view="list">
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Estimates</h3>
          <p className={styles.subtitle}>Versioned estimates for this project.</p>
        </div>
        <Button onClick={onCreate}>Create estimate</Button>
      </div>

      {loading ? <LoadingSkeleton rows={4} columns={5} label="Loading estimates" /> : null}
      {error ? (
        <DataStatePanel
          state={estimates.length ? 'stale' : 'error'}
          title={estimates.length ? 'Showing saved estimates' : 'Could not load estimates'}
          description={error}
          onRetry={onRetry}
        />
      ) : null}

      {!loading && !error && !estimates.length ? (
        <EmptyState
          title="No estimates yet"
          description="Create the first estimate to start pricing this project."
          action={<Button onClick={onCreate}>Create estimate</Button>}
        />
      ) : null}

      {estimates.length ? (
        <SearchFilterBar
          query={query}
          onQueryChange={setQuery}
          queryPlaceholder="Search estimate names or versions"
          searchId="estimate-search"
          filters={[]}
          onClearAll={() => setQuery('')}
        />
      ) : null}

      {!loading && estimates.length && !visibleEstimates.length ? (
        <EmptyState
          title="No matching estimates"
          description="Try a different internal name or version."
          action={<Button variant="secondary" onClick={() => setQuery('')}>Clear search</Button>}
        />
      ) : null}

      {visibleEstimates.length ? (
        <Table aria-label="Project estimates">
          <TableHeader>
            <TableRow>
              <TableHead>Estimate</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className={styles.secondaryColumn}>Quote</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleEstimates.map((estimate) => {
              const status = estimateStatus(estimate);
              const openLabel = estimate.isActiveDraft ? 'Edit in calculator' : 'Open in calculator';
              const open = () => onOpen(estimate.id);
              return (
                <TableRow
                  key={estimate.id}
                  className={styles.row}
                  data-estimate-id={estimate.id}
                  tabIndex={0}
                  aria-label={`${openLabel}: ${estimate.internalName || estimate.versionLabel}`}
                  onClick={open}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    open();
                  }}
                >
                  <TableCell>
                    <span className={styles.estimateIdentity}>
                      <strong>{estimate.internalName || `Estimate ${estimate.versionLabel}`}</strong>
                      <small>
                        {estimate.internalName ? `Estimate ${estimate.versionLabel} · ` : ''}
                        {estimate.createdBy || 'Sanctuary staff'}
                      </small>
                    </span>
                  </TableCell>
                  <TableCell>{formatPortalDate(estimate.createdAt, { fallback: '-' })}</TableCell>
                  <TableCell><Badge tone={status.tone}>{status.label}</Badge></TableCell>
                  <TableCell className={styles.secondaryColumn}>{estimate.hasSentQuote ? 'Quote issued' : 'Not quoted'}</TableCell>
                  <TableCell
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <div className={styles.actions}>
                      <Button size="small" variant="secondary" onClick={open}>{openLabel}</Button>
                      <Button size="small" variant="quiet" onClick={() => onRename(estimate)}>Rename</Button>
                      <Button size="small" variant="quiet" onClick={() => onDuplicate(estimate.id)}>Duplicate</Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
