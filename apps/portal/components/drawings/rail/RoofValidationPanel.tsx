'use client';

import { useCallback, useMemo, useState } from 'react';
import type { HouseFormModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchRoofInspectorModel } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type { ObjectWorkbenchRoofFailingStage } from '@/lib/drawings/state/objectWorkbenchStatusModel';
import {
  buildRoofFailureRepro,
  downloadRoofFailureRepro,
} from '@/lib/drawings/exportRoofFailureRepro';
import styles from './RoofValidationPanel.module.css';

/**
 * PR-HR2 (2026-06-18): structured failure panel for the right rail.
 *
 * Replaces the single-line `<p className={styles.fieldError}>` that
 * pre-PR-HR2 rendered "Roof geometry failed package QA: eave_…" with
 * no further context. Designers now see:
 *   - the validation message (full, no truncation),
 *   - the failing stage (e.g. "Eave polygon construction"),
 *   - the raw code (e.g. "eave_offset_self_overlap"),
 *   - approximation reasons when the roof is approximate (not invalid),
 *   - a "Copy diagnostics" button that puts a JSON payload on the
 *     clipboard so it can be pasted into a bug report or handed to an
 *     engineer for repro. The payload is the full
 *     `stageDiagnostics` snapshot from `@sp/geometry` plus the
 *     summary fields — same shape PR-HR1's capture button will
 *     persist as a regression fixture.
 *
 * Renders nothing when `validationStatus` is `'valid'` or `null`.
 */
export default function RoofValidationPanel({
  roofStatus,
  houseForm,
}: {
  roofStatus: ObjectWorkbenchRoofInspectorModel;
  /**
   * PR-HR1 (2026-06-18): required for the "Save bug report" button.
   * When `null` (no active house selected), the export button is
   * hidden but the rest of the panel still renders.
   */
  houseForm: HouseFormModel | null;
}) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState<string | null>(null);

  const payload = useMemo(
    () =>
      JSON.stringify(
        {
          validationStatus: roofStatus.validationStatus,
          validationCode: roofStatus.validationCode,
          validationMessage: roofStatus.validationMessage,
          approximationReasons: roofStatus.approximationReasons,
          failingStage: roofStatus.failingStage,
          stageDiagnostics: roofStatus.stageDiagnostics,
          roofForm: roofStatus.intent.form,
          geometryKind: roofStatus.geometryKind,
          terminalEnds: roofStatus.terminalEnds,
        },
        null,
        2,
      ),
    [roofStatus],
  );

  const handleCopy = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(payload).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // Clipboard write can fail in iframes / permissions-denied
        // contexts. Stay quiet — the panel still shows the data
        // designers can read.
      },
    );
  }, [payload]);

  const handleSaveBugReport = useCallback(() => {
    if (!houseForm) return;
    const repro = buildRoofFailureRepro({ houseForm, roof: roofStatus });
    const filename = downloadRoofFailureRepro(repro);
    setDownloaded(filename);
    window.setTimeout(() => setDownloaded(null), 3000);
  }, [houseForm, roofStatus]);

  const status = roofStatus.validationStatus;
  if (status !== 'invalid' && status !== 'approximate') return null;

  const isInvalid = status === 'invalid';
  const reasons = roofStatus.approximationReasons;

  return (
    <div
      className={isInvalid ? styles.invalidPanel : styles.approximatePanel}
      data-testid="roof-validation-panel"
    >
      <p className={styles.message}>
        {roofStatus.validationMessage ??
          (isInvalid
            ? 'Roof geometry failed package QA.'
            : 'Roof geometry is approximate.')}
      </p>

      {isInvalid && roofStatus.failingStage ? (
        <dl className={styles.metaList}>
          <FailureRow label="Failed at" stage={roofStatus.failingStage} />
          <CodeRow code={roofStatus.failingStage.code} />
        </dl>
      ) : null}

      {!isInvalid && roofStatus.validationCode ? (
        <dl className={styles.metaList}>
          <CodeRow code={roofStatus.validationCode} />
        </dl>
      ) : null}

      {reasons.length > 0 ? (
        <p className={styles.reasons}>
          <span className={styles.reasonsLabel}>Reasons: </span>
          {reasons.join(', ')}
        </p>
      ) : null}

      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.copyButton}
          onClick={handleCopy}
          aria-label="Copy roof diagnostics JSON to clipboard"
          data-testid="roof-validation-copy"
        >
          {copied ? 'Copied to clipboard' : 'Copy diagnostics'}
        </button>

        {houseForm ? (
          <button
            type="button"
            className={styles.copyButton}
            onClick={handleSaveBugReport}
            aria-label="Download this failing house as a JSON bug report"
            data-testid="roof-validation-save-bug-report"
          >
            {downloaded ? `Saved: ${downloaded}` : 'Save bug report'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FailureRow({
  label,
  stage,
}: {
  label: string;
  stage: ObjectWorkbenchRoofFailingStage;
}) {
  return (
    <>
      <dt className={styles.metaTerm}>{label}</dt>
      <dd className={styles.metaValue}>{stage.label}</dd>
    </>
  );
}

function CodeRow({ code }: { code: string }) {
  return (
    <>
      <dt className={styles.metaTerm}>Code</dt>
      <dd className={styles.metaValue}>
        <code className={styles.codeChip}>{code}</code>
      </dd>
    </>
  );
}
