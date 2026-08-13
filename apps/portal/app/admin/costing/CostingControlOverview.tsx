'use client';

import type { CostingConfigurationVersionSummary } from '@/lib/costing/configurationTypes';
import type { CostingConfigurationOverview } from '@/lib/costing/configurationAdmin';
import { formatCostingDate, type CostingControlSection } from './costingControlModel';
import styles from './costingControl.module.css';

export function CostingWorkflow(props: {
  currentStep: 1 | 2 | 3 | 4;
  hasEditor: boolean;
  canPublish: boolean;
  onOverview: () => void;
  onEdit: () => void;
  onReview: () => void;
  onPublish: () => void;
  busy?: boolean;
}) {
  const steps: Array<{
    number: 1 | 2 | 3 | 4;
    label: string;
    action: () => void;
    enabled: boolean;
  }> = [
    { number: 1, label: 'Overview', action: props.onOverview, enabled: true },
    { number: 2, label: 'Edit settings', action: props.onEdit, enabled: props.hasEditor && props.canPublish },
    { number: 3, label: 'Review impact', action: props.onReview, enabled: props.hasEditor },
    { number: 4, label: 'Publish', action: props.onPublish, enabled: props.hasEditor && props.canPublish },
  ];
  return (
    <nav className={styles.workflow} aria-label="Costing workflow">
      {steps.map((step) => (
        <button
          key={step.number}
          type="button"
          disabled={props.busy || !step.enabled}
          aria-current={step.number === props.currentStep ? 'step' : undefined}
          className={`${styles.workflowStep} ${
            step.number === props.currentStep
              ? styles.workflowCurrent
              : step.number < props.currentStep
                ? styles.workflowComplete
                : ''
          }`}
          onClick={step.action}
        >
          <span>{step.number < props.currentStep ? '✓' : step.number}</span>
          {step.label}
        </button>
      ))}
    </nav>
  );
}

function StatusCard(props: {
  label: string;
  value: string;
  detail: string;
  tone: 'success' | 'warning' | 'neutral';
}) {
  return (
    <div className={`${styles.statusCard} ${styles[`statusCard_${props.tone}`]}`}>
      <span className={styles.statusLabel}>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.detail}</small>
    </div>
  );
}

export function CostingStatusSummary(props: {
  currentVersion: CostingConfigurationVersionSummary | null;
  latestDraft: CostingConfigurationVersionSummary | null;
  selectedVersion: CostingConfigurationVersionSummary | null;
  dirty: boolean;
}) {
  return (
    <section className={styles.statusGrid} aria-label="Pricing configuration status">
      <StatusCard
        label="Active pricing"
        value={props.currentVersion
          ? props.currentVersion.name
          : 'Legacy calculator settings'}
        detail={props.currentVersion
          ? `Version ${props.currentVersion.versionNumber} · published ${formatCostingDate(props.currentVersion.publishedAt)}`
          : 'Existing calculator behaviour remains active until a version is published.'}
        tone={props.currentVersion ? 'success' : 'neutral'}
      />
      <StatusCard
        label="Latest draft"
        value={props.latestDraft ? props.latestDraft.name : 'No draft in progress'}
        detail={props.latestDraft
          ? `Last updated ${formatCostingDate(props.latestDraft.updatedAt)} by ${props.latestDraft.updatedByEmail}`
          : 'Create a draft to propose a supported pricing change.'}
        tone={props.latestDraft ? 'warning' : 'neutral'}
      />
      <StatusCard
        label="Your working state"
        value={props.selectedVersion
          ? props.selectedVersion.name
          : 'Overview'}
        detail={props.dirty
          ? 'Unsaved changes — save before leaving.'
          : props.selectedVersion?.status === 'draft'
            ? 'Saved and validated.'
            : 'No unsaved work.'}
        tone={props.dirty ? 'warning' : 'neutral'}
      />
    </section>
  );
}

export function VersionHistory(props: {
  overview: CostingConfigurationOverview;
  versionById: Map<string, CostingConfigurationVersionSummary>;
  selectedId: string | null;
  busy: boolean;
  onOpen: (id: string, landing?: CostingControlSection) => void;
  onClone: (id?: string) => void;
}) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2>Version history</h2>
          <p className={styles.muted}>Drafts, publication notes and immutable pricing records.</p>
        </div>
        <span className={styles.muted}>
          {props.overview.versions.length} {props.overview.versions.length === 1 ? 'version' : 'versions'}
        </span>
      </div>
      {props.overview.versions.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name and purpose</th>
                <th>State</th>
                <th>Based on</th>
                <th>Last activity</th>
                <th>Publication audit note</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {props.overview.versions.map((version) => (
                <VersionRow
                  key={version.id}
                  version={version}
                  basedOn={version.basedOnVersionId ? props.versionById.get(version.basedOnVersionId) ?? null : null}
                  current={version.id === props.overview.currentVersionId}
                  selected={version.id === props.selectedId}
                  busy={props.busy}
                  onOpen={() => props.onOpen(version.id)}
                  onClone={() => props.onClone(version.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyHistory}>
          <strong>No versioned pricing history yet</strong>
          <span>The legacy calculator settings remain active. Your first draft will copy them exactly.</span>
        </div>
      )}
    </section>
  );
}

function VersionRow(props: {
  version: CostingConfigurationVersionSummary;
  basedOn: CostingConfigurationVersionSummary | null;
  current: boolean;
  selected: boolean;
  busy: boolean;
  onOpen: () => void;
  onClone: () => void;
}) {
  const { version } = props;
  const state = props.current ? 'Current' : version.status === 'draft' ? 'Draft' : 'Superseded';
  return (
    <tr className={props.selected ? styles.selectedRow : undefined}>
      <td>
        <strong>{version.name}</strong>
        <div className={styles.muted}>v{version.versionNumber} · {version.purpose}</div>
      </td>
      <td>
        <span className={`${styles.badge} ${props.current ? styles.published : version.status === 'draft' ? styles.draft : ''}`}>
          {state}
        </span>
      </td>
      <td>{props.basedOn ? `Version ${props.basedOn.versionNumber}` : 'Legacy settings'}</td>
      <td>
        <strong>{version.publishedByEmail ?? version.updatedByEmail}</strong>
        <div className={styles.muted}>{formatCostingDate(version.publishedAt ?? version.updatedAt)}</div>
      </td>
      <td>{version.publishNote || (version.status === 'draft' ? 'Captured when published' : 'Not recorded')}</td>
      <td className={styles.rowActions}>
        <button className={styles.buttonSecondary} type="button" disabled={props.busy} onClick={props.onOpen}>
          {version.status === 'draft' ? 'Continue' : 'View'}
        </button>
        {version.status === 'published' ? (
          <button className={styles.textButton} type="button" disabled={props.busy} onClick={props.onClone}>
            Clone
          </button>
        ) : null}
      </td>
    </tr>
  );
}
