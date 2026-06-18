import { useMemo, useState } from 'react';
import styles from './CalculatorGrid.module.css';
import type { CutListRow, InfillComputeStatus } from './infillCompute';

function formatLengthValue(lengthM?: number | { min: number; max: number }): string {
  if (lengthM === undefined) return '-';
  if (typeof lengthM === 'number') return `${lengthM.toFixed(3)}m`;
  return `${lengthM.min.toFixed(3)}m to ${lengthM.max.toFixed(3)}m`;
}

function escapeCsv(value: string): string {
  if (!value.includes(',') && !value.includes('"') && !value.includes('\n')) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function cutListRowsToCsv(rows: CutListRow[]): string {
  const header = ['Part', 'Qty', 'Length/Range', 'Notes'];
  const lines = rows.map((row) =>
    [
      escapeCsv(row.part),
      String(row.qty),
      escapeCsv(formatLengthValue(row.lengthM)),
      escapeCsv(row.notes ?? ''),
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

type InfillCutListProps = {
  status: InfillComputeStatus;
  rows: CutListRow[];
};

export default function InfillCutList({ status, rows }: InfillCutListProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const csv = useMemo(() => cutListRowsToCsv(rows), [rows]);

  const copyCsv = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      setCopyMessage('CSV copied.');
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = csv;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        setCopyMessage(copied ? 'CSV copied.' : 'Clipboard blocked. Copy manually from the table.');
      } catch {
        setCopyMessage('Clipboard blocked. Copy manually from the table.');
      }
    }
    window.setTimeout(() => setCopyMessage(null), 1800);
  };

  if (status === 'draft') {
    return <p className={styles.infillComputedNote}>Complete required shape fields to generate the cut list estimate.</p>;
  }

  if (!rows.length) {
    return <p className={styles.infillComputedNote}>No cut list rows yet.</p>;
  }

  return (
    <div className={styles.infillCutList}>
      <div className={styles.infillCutListHeader}>
        <p className={styles.infillComputedNote}>Read-only estimate. Not an authoritative BOM.</p>
        <button type="button" className={styles.infillIconButton} onClick={copyCsv}>
          Copy as CSV
        </button>
      </div>

      <div className={styles.infillCutListTable} role="table" aria-label="Infill cut list estimate">
        <div className={styles.infillCutListHead} role="row">
          <span role="columnheader">Part</span>
          <span role="columnheader">Qty</span>
          <span role="columnheader">Length/Range</span>
          <span role="columnheader">Notes</span>
        </div>
        {rows.map((row, idx) => (
          <div key={`${row.part}-${idx}`} className={styles.infillCutListRow} role="row">
            <span role="cell">{row.part}</span>
            <span role="cell">{row.qty}</span>
            <span role="cell">{formatLengthValue(row.lengthM)}</span>
            <span role="cell">{row.notes ?? '-'}</span>
          </div>
        ))}
      </div>

      {copyMessage ? <p className={styles.infillComputedNote}>{copyMessage}</p> : null}
    </div>
  );
}
