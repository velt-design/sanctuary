'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  CostingEstimateCandidate,
  CostingEstimatePreview as CostingEstimatePreviewResult,
  CostingConfigurationVersion,
} from '@/lib/costing/configurationTypes';
import { formatCostingDate } from './costingControlModel';
import styles from './costingControl.module.css';

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(String(body?.error ?? 'Request failed'));
  return body as T;
}

function MoneyMovement(props: { label: string; before: number; after: number; total?: boolean }) {
  const delta = props.after - props.before;
  return (
    <div className={props.total ? styles.impactTotal : undefined}>
      <dt>{props.label}</dt>
      <dd>
        <span>${props.before.toFixed(2)}</span>
        <span aria-hidden="true">→</span>
        <strong>${props.after.toFixed(2)}</strong>
        <em className={delta > 0 ? styles.positive : delta < 0 ? styles.negative : undefined}>
          ({delta >= 0 ? '+' : ''}${delta.toFixed(2)})
        </em>
      </dd>
    </div>
  );
}

export function CostingEstimatePreview(props: {
  version: CostingConfigurationVersion;
  dirty: boolean;
}) {
  const [search, setSearch] = useState('');
  const [estimates, setEstimates] = useState<CostingEstimateCandidate[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [preview, setPreview] = useState<CostingEstimatePreviewResult | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewSequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoadingList(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/costing/estimates?q=${encodeURIComponent(search.trim())}`, {
          signal: controller.signal,
        });
        const body = await responseJson<{ estimates: CostingEstimateCandidate[] }>(response);
        if (!Array.isArray(body.estimates)) throw new Error('Estimate search returned an invalid response.');
        setEstimates(body.estimates);
        setSelectedId((current) => (
          body.estimates.some((item) => item.id === current) ? current : body.estimates[0]?.id ?? ''
        ));
      } catch (caught) {
        if (!controller.signal.aborted) {
          setEstimates([]);
          setSelectedId('');
          setError(caught instanceof Error ? caught.message : 'Failed to search estimates.');
        }
      } finally {
        if (!controller.signal.aborted) setLoadingList(false);
      }
    }, search ? 300 : 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  useEffect(() => {
    previewSequence.current += 1;
    setPreview(null);
  }, [props.version.contentHash, selectedId, props.dirty]);

  const runPreview = async () => {
    if (!selectedId || props.dirty) return;
    const sequence = ++previewSequence.current;
    setLoadingPreview(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/costing/configurations/${encodeURIComponent(props.version.id)}/estimate-preview`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            estimateId: selectedId,
            expectedContentHash: props.version.contentHash,
          }),
        },
      );
      const body = await responseJson<{ preview: CostingEstimatePreviewResult }>(response);
      if (
        sequence !== previewSequence.current
        || body.preview.draftContentHash !== props.version.contentHash
        || body.preview.estimate.id !== selectedId
      ) return;
      setPreview(body.preview);
    } catch (caught) {
      if (sequence === previewSequence.current) {
        setError(caught instanceof Error ? caught.message : 'Failed to preview the selected estimate.');
      }
    } finally {
      if (sequence === previewSequence.current) setLoadingPreview(false);
    }
  };

  const selected = estimates.find((item) => item.id === selectedId) ?? null;
  return (
    <div className={styles.subsection}>
      <div className={styles.cardHeader}>
        <div>
          <h3>Check a real saved estimate</h3>
          <p className={styles.muted}>
            Recalculate a saved estimate’s frozen inputs with active and draft settings. This is read-only:
            the estimate and its provenance are never changed.
          </p>
        </div>
        <span className={styles.badge}>Optional confidence check</span>
      </div>
      <div className={styles.estimatePicker}>
        <label className={styles.searchLabel}>
          <span>Find a project or estimate</span>
          <input
            className={styles.search}
            type="search"
            value={search}
            placeholder="Project name, quote reference or address"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className={styles.searchLabel}>
          <span>{search ? 'Matching estimates' : 'Recently updated estimates'}</span>
          <select
            className={styles.input}
            value={selectedId}
            disabled={loadingList || !estimates.length}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {!estimates.length ? <option value="">No supported estimates found</option> : null}
            {estimates.map((estimate) => (
              <option key={estimate.id} value={estimate.id}>
                {estimate.projectName}
                {estimate.quoteRef ? ` · ${estimate.quoteRef}` : ''}
                {estimate.version ? ` · estimate v${estimate.version}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          className={styles.buttonSecondary}
          type="button"
          disabled={loadingList || loadingPreview || props.dirty || !selectedId}
          onClick={runPreview}
        >
          {loadingPreview ? 'Calculating…' : 'Preview selected estimate'}
        </button>
      </div>
      {props.dirty ? (
        <div className={styles.warning}>Save the draft before running a real-estimate preview.</div>
      ) : null}
      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {selected ? (
        <div className={styles.estimateContext}>
          <strong>{selected.projectName}</strong>
          <span>{selected.siteAddress || 'No site address recorded'}</span>
          <span>
            Estimate {selected.version ? `v${selected.version}` : 'version not recorded'} · {selected.status}
            {' · '}updated {formatCostingDate(selected.updatedAt)}
          </span>
          <span>
            Saved costing provenance: {selected.savedCostingVersionId
              ? `version ${selected.savedCostingVersionId.slice(0, 8)}…`
              : 'legacy snapshot / no published version ID'}
          </span>
        </div>
      ) : null}
      {preview ? (
        <article className={styles.estimatePreviewResult}>
          <div className={styles.impactHeader}>
            <div>
              <strong>{preview.impact.label}</strong>
              <div className={styles.muted}>
                Active pricing → saved draft · generated {formatCostingDate(preview.generatedAt)}
              </div>
            </div>
            <span className={
              preview.impact.deltaExGst > 0
                ? styles.positive
                : preview.impact.deltaExGst < 0
                  ? styles.negative
                  : undefined
            }>
              {preview.impact.deltaExGst >= 0 ? '+' : ''}${preview.impact.deltaExGst.toFixed(2)}
              {preview.impact.deltaPercent === null
                ? ''
                : ` · ${preview.impact.deltaPercent >= 0 ? '+' : ''}${preview.impact.deltaPercent.toFixed(1)}%`}
            </span>
          </div>
          <dl className={styles.impactBreakdown}>
            <MoneyMovement
              label="Materials"
              before={preview.impact.beforeMaterialsExGst}
              after={preview.impact.afterMaterialsExGst}
            />
            <MoneyMovement
              label="Labour"
              before={preview.impact.beforeInstallExGst}
              after={preview.impact.afterInstallExGst}
            />
            <MoneyMovement
              label="Overheads"
              before={preview.impact.beforeOverheadExGst}
              after={preview.impact.afterOverheadExGst}
            />
            <MoneyMovement
              label="Total ex GST"
              before={preview.impact.beforeTotalExGst}
              after={preview.impact.afterTotalExGst}
              total
            />
            {typeof preview.impact.beforeCustomerPriceIncGst === 'number'
              && typeof preview.impact.afterCustomerPriceIncGst === 'number' ? (
                <MoneyMovement
                  label="Customer price inc GST"
                  before={preview.impact.beforeCustomerPriceIncGst}
                  after={preview.impact.afterCustomerPriceIncGst}
                  total
                />
              ) : null}
          </dl>
          <details className={styles.inlineTechnical}>
            <summary>Saved provenance details</summary>
            <div>
              Source: {preview.estimate.savedProvenance?.source ?? 'legacy / unavailable'} · version:{' '}
              {preview.estimate.savedProvenance?.versionNumber ?? 'not recorded'} · content hash:{' '}
              {preview.estimate.savedProvenance?.contentHash ?? 'not recorded'}
            </div>
          </details>
        </article>
      ) : null}
    </div>
  );
}
