'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiJson } from '@/lib/repo/apiClient';
import type { EstimateActualCostInput, EstimateCostCalibrationComparison } from '@/lib/estimateActuals/types';
import styles from './CalculatorActualCostReview.module.css';

type Draft = Record<keyof Omit<EstimateActualCostInput, 'notes' | 'isComplete'>, string> & {
  notes: string;
  isComplete: boolean;
};

const emptyDraft: Draft = {
  materialsExGst: '',
  installExGst: '',
  overheadExGst: '',
  travelExGst: '',
  extrasExGst: '',
  crewHours: '',
  notes: '',
  isComplete: false,
};

const rows = [
  ['materialsExGst', 'Materials', '$'],
  ['installExGst', 'Install cost', '$'],
  ['overheadExGst', 'Overhead', '$'],
  ['travelExGst', 'Travel', '$'],
  ['extrasExGst', 'Extras', '$'],
  ['crewHours', 'Crew hours', ''],
] as const;

function draftFromComparison(comparison: EstimateCostCalibrationComparison): Draft {
  const actual = comparison.actual;
  if (!actual) return emptyDraft;
  return {
    materialsExGst: actual.materialsExGst?.toString() ?? '',
    installExGst: actual.installExGst?.toString() ?? '',
    overheadExGst: actual.overheadExGst?.toString() ?? '',
    travelExGst: actual.travelExGst?.toString() ?? '',
    extrasExGst: actual.extrasExGst?.toString() ?? '',
    crewHours: actual.crewHours?.toString() ?? '',
    notes: actual.notes,
    isComplete: actual.isComplete,
  };
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(value);
}

function signed(value: number | null, currency: boolean): string {
  if (value === null) return '—';
  const prefix = value > 0 ? '+' : '';
  return currency ? `${prefix}${money(value)}` : `${prefix}${value.toFixed(2)}`;
}

export default function CalculatorActualCostReview({ estimateId }: { estimateId: string }) {
  const [comparison, setComparison] = useState<EstimateCostCalibrationComparison | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const saveLockedRef = useRef(false);
  const canLoad = Boolean(estimateId && !estimateId.startsWith('local-'));

  useEffect(() => {
    if (!canLoad) return;
    let cancelled = false;
    setStatus('loading');
    apiJson<{ comparison: EstimateCostCalibrationComparison }>(
      `/api/staff/v1/estimates/${encodeURIComponent(estimateId)}/actual-costs`,
    ).then((response) => {
      if (cancelled) return;
      setComparison(response.comparison);
      setDraft(draftFromComparison(response.comparison));
      setStatus('idle');
    }).catch((caught) => {
      if (cancelled) return;
      setError(caught instanceof Error ? caught.message : 'Failed to load actual job costs');
      setStatus('error');
    });
    return () => { cancelled = true; };
  }, [canLoad, estimateId]);

  const payload = useMemo<EstimateActualCostInput>(() => ({
    materialsExGst: numberOrNull(draft.materialsExGst),
    installExGst: numberOrNull(draft.installExGst),
    overheadExGst: numberOrNull(draft.overheadExGst),
    travelExGst: numberOrNull(draft.travelExGst),
    extrasExGst: numberOrNull(draft.extrasExGst),
    crewHours: numberOrNull(draft.crewHours),
    notes: draft.notes,
    isComplete: draft.isComplete,
  }), [draft]);

  if (!estimateId) return null;

  const save = async () => {
    if (saveLockedRef.current || status === 'saving') return;
    saveLockedRef.current = true;
    setStatus('saving');
    setError('');
    try {
      const response = await apiJson<{ comparison: EstimateCostCalibrationComparison }>(
        `/api/staff/v1/estimates/${encodeURIComponent(estimateId)}/actual-costs`,
        { method: 'PUT', body: JSON.stringify(payload) },
      );
      setComparison(response.comparison);
      setDraft(draftFromComparison(response.comparison));
      setStatus('saved');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save actual job costs');
      setStatus('error');
    } finally {
      saveLockedRef.current = false;
    }
  };

  return (
    <details className={styles.card}>
      <summary>
        <span>
          <strong>Actual vs estimated</strong>
          <small>{comparison?.actual?.isComplete ? 'Completed calibration record' : 'Post-job margin calibration'}</small>
        </span>
        <span>{comparison?.variance.totalExGst !== null && comparison?.variance.totalExGst !== undefined ? signed(comparison.variance.totalExGst, true) : 'Not recorded'}</span>
      </summary>
      <div className={styles.body}>
        {!canLoad ? <p>Actual costs become available after this estimate has synced.</p> : null}
        {canLoad ? (
          <>
            <div className={styles.grid}>
              {rows.map(([key, label, prefix]) => (
                <label key={key}>
                  <span>{label}</span>
                  <span className={styles.inputWrap}>{prefix}<input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft[key]}
                    disabled={status === 'loading' || status === 'saving'}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  /></span>
                  <small>
                    Estimated {key === 'crewHours' ? comparison?.estimated[key]?.toFixed(2) ?? '—' : money(comparison?.estimated[key] ?? null)}
                    {' · '}Variance {signed(comparison?.variance[key] ?? null, key !== 'crewHours')}
                  </small>
                </label>
              ))}
            </div>
            <label className={styles.notes}>
              <span>Calibration notes</span>
              <textarea
                rows={3}
                maxLength={2000}
                value={draft.notes}
                disabled={status === 'loading' || status === 'saving'}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Explain major supplier, fabrication or site variances."
              />
            </label>
            <label className={styles.complete}>
              <input
                type="checkbox"
                checked={draft.isComplete}
                disabled={status === 'loading' || status === 'saving'}
                onChange={(event) => setDraft((current) => ({ ...current, isComplete: event.target.checked }))}
              />
              <span>Actuals are complete and ready for pricing review</span>
            </label>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.footer}>
              <span>{status === 'saved' ? 'Actual costs saved.' : comparison?.actual?.updatedByEmail ? `Last updated by ${comparison.actual.updatedByEmail}` : ''}</span>
              <button type="button" onClick={() => void save()} disabled={status === 'loading' || status === 'saving'}>
                {status === 'saving' ? 'Saving…' : 'Save actual costs'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </details>
  );
}
