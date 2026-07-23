'use client';

import type { RefObject } from 'react';
import type { CostingConfigurationVersion } from '@/lib/costing/configurationTypes';
import type { CostingConfigurationComparison } from '@/lib/costing/configurationAdmin';
import { formatSettingPath, formatSettingValue } from './costingControlModel';
import { CostingEstimatePreview } from './CostingEstimatePreview';
import styles from './costingControl.module.css';

export function CostingComparison(props: {
  comparison: CostingConfigurationComparison | null;
  version: CostingConfigurationVersion;
  materialLabels: Map<string, string>;
  actionLabels: Map<string, string>;
  dirty: boolean;
}) {
  const diff = props.comparison?.diff ?? props.version.publicationDiff ?? [];
  const impact = props.comparison?.impact ?? props.version.publicationImpact ?? [];
  const largeChanges = impact.filter((row) => row.deltaPercent !== null && Math.abs(row.deltaPercent) >= 10);
  return (
    <div className={styles.reviewSection}>
      <div className={styles.reviewIntro}>
        <div>
          <div className={styles.eyebrow}>Step 3 · Review impact</div>
          <h3>Understand the change before publishing</h3>
          <p className={styles.muted}>
            {props.version.status === 'published'
              ? 'The costing package captured this comparison when the version was published.'
              : 'The costing package compared this saved version with the active pricing configuration.'}
          </p>
        </div>
        <div className={styles.reviewMetric}>
          <strong>{diff.length}</strong>
          <span>changed {diff.length === 1 ? 'value' : 'values'}</span>
        </div>
      </div>

      {props.dirty ? (
        <div className={styles.warning}>
          The preview is based on the last saved draft. Save your current edits to refresh it.
        </div>
      ) : null}
      {largeChanges.length ? (
        <div className={styles.warning}>
          <strong>Large pricing movement detected.</strong>{' '}
          {largeChanges.length} representative {largeChanges.length === 1 ? 'scenario changes' : 'scenarios change'} by
          10% or more. Review the component breakdown carefully.
        </div>
      ) : null}

      <div>
        <h3>What changed</h3>
        <p className={styles.muted}>
          {props.version.status === 'published'
            ? 'Baseline values are the settings that were active when this version was published.'
            : 'Active values are what the calculator uses today.'}
        </p>
        {diff.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Setting</th><th>Active value</th><th>This version</th><th>Movement</th></tr></thead>
              <tbody>
                {diff.map((entry) => {
                  const before = typeof entry.before === 'number' ? entry.before : null;
                  const after = typeof entry.after === 'number' ? entry.after : null;
                  const movement = before !== null && after !== null ? after - before : null;
                  return (
                    <tr key={entry.path}>
                      <td>
                        <strong>{formatSettingPath(entry.path, props.materialLabels, props.actionLabels)}</strong>
                        <details className={styles.inlineTechnical}>
                          <summary>Technical path</summary>
                          <code>{entry.path}</code>
                        </details>
                      </td>
                      <td>{formatSettingValue(entry.path, entry.before)}</td>
                      <td><strong>{formatSettingValue(entry.path, entry.after)}</strong></td>
                      <td className={movement !== null && movement > 0 ? styles.positive : movement !== null && movement < 0 ? styles.negative : undefined}>
                        {movement === null
                          ? 'Changed'
                          : `${movement >= 0 ? '+' : ''}${formatSettingValue(entry.path, movement)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyInline}>
            This saved version matches the active pricing configuration. Change and save a supported value to
            generate a review.
          </div>
        )}
      </div>

      <div className={styles.subsection}>
        <h3>Representative project impact</h3>
        <p className={styles.muted}>
          Package-owned scenarios show directional impact; they do not replace a pricing review.
        </p>
        {impact.length ? (
          <div className={styles.impactGrid}>
            {impact.map((row) => (
              <article className={styles.impactCard} key={row.id}>
                <div className={styles.impactHeader}>
                  <strong>{row.label}</strong>
                  <span className={row.deltaExGst > 0 ? styles.positive : row.deltaExGst < 0 ? styles.negative : undefined}>
                    {row.deltaExGst >= 0 ? '+' : ''}${row.deltaExGst.toFixed(2)}
                    {row.deltaPercent === null
                      ? ''
                      : ` · ${row.deltaPercent >= 0 ? '+' : ''}${row.deltaPercent.toFixed(1)}%`}
                  </span>
                </div>
                <dl className={styles.impactBreakdown}>
                  <ImpactLine label="Materials" before={row.beforeMaterialsExGst} after={row.afterMaterialsExGst} />
                  <ImpactLine label="Labour" before={row.beforeInstallExGst} after={row.afterInstallExGst} />
                  <ImpactLine label="Overheads" before={row.beforeOverheadExGst} after={row.afterOverheadExGst} />
                  <ImpactLine label="Total ex GST" before={row.beforeTotalExGst} after={row.afterTotalExGst} total />
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyInline}>
            Save a changed draft to generate representative project impacts.
          </div>
        )}
      </div>
      {props.version.status === 'draft' ? (
        <CostingEstimatePreview version={props.version} dirty={props.dirty} />
      ) : null}
    </div>
  );
}

function ImpactLine(props: { label: string; before: number; after: number; total?: boolean }) {
  return (
    <div className={props.total ? styles.impactTotal : undefined}>
      <dt>{props.label}</dt>
      <dd>
        <span>${props.before.toFixed(2)}</span>
        <span aria-hidden="true">→</span>
        <strong>${props.after.toFixed(2)}</strong>
      </dd>
    </div>
  );
}

export function CostingPublishPanel(props: {
  panelRef: RefObject<HTMLDivElement | null>;
  publishNote: string;
  confirmed: boolean;
  busy: boolean;
  dirty: boolean;
  hasChanges: boolean;
  onPublishNoteChange: (value: string) => void;
  onConfirmedChange: (value: boolean) => void;
  onPublish: () => void;
}) {
  return (
    <div className={styles.publishPanel} ref={props.panelRef} tabIndex={-1}>
      <div>
        <div className={styles.eyebrow}>Step 4 · Publish</div>
        <h3>Publish for future calculations</h3>
        <p className={styles.muted}>
          Existing estimates keep their saved costing provenance. Only calculations made after publication
          will resolve this version.
        </p>
      </div>
      <label className={styles.field}>
        <span className={styles.fieldLabelStrong}>Reason for this pricing change</span>
        <span className={styles.fieldDescription}>
          This becomes the permanent audit note in version history.
        </span>
        <textarea
          className={styles.textarea}
          value={props.publishNote}
          maxLength={1000}
          onChange={(event) => props.onPublishNoteChange(event.target.value)}
          placeholder="For example: Updated aluminium supplier rates effective 1 August."
        />
      </label>
      <label className={styles.confirmation}>
        <input
          type="checkbox"
          checked={props.confirmed}
          onChange={(event) => props.onConfirmedChange(event.target.checked)}
        />
        <span>
          <strong>I have reviewed the saved changes and representative project impacts.</strong>
          <small>I understand this version will be used for future calculations immediately.</small>
        </span>
      </label>
      <div className={styles.publishRow}>
        <span className={styles.muted}>
          Publishing is disabled until the draft is saved, changed and explicitly confirmed.
        </span>
        <button
          className={styles.button}
          type="button"
          disabled={
            props.busy
            || props.dirty
            || !props.confirmed
            || props.publishNote.trim().length < 3
            || !props.hasChanges
          }
          onClick={props.onPublish}
        >
          Publish pricing version
        </button>
      </div>
    </div>
  );
}
