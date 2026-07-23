'use client';

import {
  COSTING_CONFIGURATION_NAME_MAX,
  COSTING_CONFIGURATION_PURPOSE_MAX,
  type CostingConfigurationMetadataIssue,
} from '@/lib/costing/configurationMetadata';
import styles from './costingControl.module.css';

export type DraftDialogState = {
  sourceVersionId: string | null;
  name: string;
  purpose: string;
};

function MetadataIssue(props: {
  issues: CostingConfigurationMetadataIssue[];
  path: CostingConfigurationMetadataIssue['path'];
}) {
  const issue = props.issues.find((item) => item.path === props.path);
  return issue ? <span className={styles.fieldError}>{issue.message}</span> : null;
}

export function CostingDraftDialog(props: {
  value: DraftDialogState;
  issues: CostingConfigurationMetadataIssue[];
  busy: boolean;
  onChange: (value: DraftDialogState) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="create-draft-title">
        <div>
          <div className={styles.eyebrow}>New pricing draft</div>
          <h2 id="create-draft-title">
            {props.value.sourceVersionId ? 'Clone this pricing version' : 'Describe the pricing change'}
          </h2>
          <p className={styles.muted}>
            Give the draft a recognisable name and explain its intended change. Both stay with the
            immutable version history.
          </p>
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabelStrong}>Draft name</span>
          <input
            className={styles.input}
            value={props.value.name}
            maxLength={COSTING_CONFIGURATION_NAME_MAX}
            onChange={(event) => props.onChange({ ...props.value, name: event.target.value })}
          />
          <span className={styles.fieldDescription}>
            {props.value.name.length}/{COSTING_CONFIGURATION_NAME_MAX}
          </span>
          <MetadataIssue issues={props.issues} path="name" />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabelStrong}>Purpose and intended outcome</span>
          <textarea
            className={styles.textarea}
            value={props.value.purpose}
            maxLength={COSTING_CONFIGURATION_PURPOSE_MAX}
            placeholder="For example: Update aluminium supplier rates for August while keeping labour assumptions unchanged."
            onChange={(event) => props.onChange({ ...props.value, purpose: event.target.value })}
          />
          <span className={styles.fieldDescription}>
            {props.value.purpose.length}/{COSTING_CONFIGURATION_PURPOSE_MAX}
          </span>
          <MetadataIssue issues={props.issues} path="purpose" />
        </label>
        <div className={styles.dialogActions}>
          <button
            className={styles.buttonSecondary}
            type="button"
            disabled={props.busy}
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button className={styles.button} type="button" disabled={props.busy} onClick={props.onCreate}>
            Create safe draft
          </button>
        </div>
      </section>
    </div>
  );
}

export function CostingDraftMetadataEditor(props: {
  readOnly: boolean;
  persistedPurpose: string;
  name: string;
  purpose: string;
  issues: CostingConfigurationMetadataIssue[];
  onChange: (field: 'name' | 'purpose', value: string) => void;
}) {
  if (props.readOnly) {
    return (
      <div className={styles.purposePanel}>
        <strong>Purpose</strong>
        <span>{props.persistedPurpose}</span>
      </div>
    );
  }
  return (
    <div className={styles.metadataGrid}>
      <label className={styles.field}>
        <span className={styles.fieldLabelStrong}>Draft name</span>
        <input
          className={styles.input}
          value={props.name}
          maxLength={COSTING_CONFIGURATION_NAME_MAX}
          onChange={(event) => props.onChange('name', event.target.value)}
        />
        <span className={styles.fieldDescription}>
          A short identity for status cards and history · {props.name.length}/{COSTING_CONFIGURATION_NAME_MAX}
        </span>
        <MetadataIssue issues={props.issues} path="name" />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabelStrong}>Purpose and intended outcome</span>
        <textarea
          className={styles.textarea}
          value={props.purpose}
          maxLength={COSTING_CONFIGURATION_PURPOSE_MAX}
          onChange={(event) => props.onChange('purpose', event.target.value)}
        />
        <span className={styles.fieldDescription}>
          Explain the business reason, scope and expected result · {props.purpose.length}/
          {COSTING_CONFIGURATION_PURPOSE_MAX}
        </span>
        <MetadataIssue issues={props.issues} path="purpose" />
      </label>
    </div>
  );
}
