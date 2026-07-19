import { useMemo, useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import styles from './CalculatorGrid.module.css';
import type { CutListRow, InfillComputeStatus } from './infillCompute';
import { buildInfillCutListDisplayRows } from './infillCutListPresentation';

function formatLengthValue(lengthM?: number | { min: number; max: number }): string {
  if (lengthM === undefined) return '-';
  if (typeof lengthM === 'number') return `${lengthM.toFixed(3)}m`;
  return `${lengthM.min.toFixed(3)}m to ${lengthM.max.toFixed(3)}m`;
}

function escapeCsv(value: string): string {
  if (!value.includes(',') && !value.includes('"') && !value.includes('\n')) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function cutListRowsToCsv(rows: CutListRow[]): string {
  const header = ['Group', 'Piece type', 'Role', 'Part', 'Qty', 'Cut length', 'Finished width', 'Finished height', 'Piece ID', 'Source infill', 'Allocated stock', 'Notes'];
  const lines = rows.map((row) =>
    [
      row.group === 'piece' ? 'Pieces to cut' : 'Materials to purchase',
      row.pieceType,
      row.role,
      escapeCsv(row.part),
      String(row.qty),
      escapeCsv(formatLengthValue(row.lengthM)),
      row.finishedWidthM === undefined ? '' : `${row.finishedWidthM.toFixed(3)}m`,
      row.finishedHeightM === undefined ? '' : `${row.finishedHeightM.toFixed(3)}m`,
      escapeCsv(row.pieceId ?? ''),
      escapeCsv(row.sourceInfillId ?? ''),
      escapeCsv(row.allocatedStock ?? ''),
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

  const downloadCsv = () => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'infill-cutting-and-purchase-list.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (status === 'draft') {
    return (
      <p className={styles.infillComputedNote}>
        Complete the required details or resolve the manufacturing blocker to generate the cut list.
      </p>
    );
  }

  if (!rows.length) {
    return <p className={styles.infillComputedNote}>No cut list rows yet.</p>;
  }

  const pieceRows = buildInfillCutListDisplayRows(rows, 'piece');
  const purchaseRows = buildInfillCutListDisplayRows(rows, 'purchase');

  const renderRows = (
    groupRows: ReturnType<typeof buildInfillCutListDisplayRows>,
    title: string,
    headings: { primary: string; measurement: string; detail: string },
  ) => (
    <section>
      <h4 className={styles.infillComputedTitle}>{title}</h4>
      <div className={styles.infillCutListTable} role="table" aria-label={`${title} · Infill cut list estimate`}>
        <div className={styles.infillCutListHead} role="row">
          <span role="columnheader">{headings.primary}</span>
          <span role="columnheader">Qty</span>
          <span role="columnheader">{headings.measurement}</span>
          <span role="columnheader">{headings.detail}</span>
        </div>
        {groupRows.map(({ row, description, measurement, detail }, idx) => (
          <div key={`${row.pieceId ?? row.part}-${idx}`} className={styles.infillCutListRow} role="row">
            <span className={styles.infillCutListPrimaryCell} role="cell">
              <strong>{row.part}</strong>
              {description ? <small>{description}</small> : null}
            </span>
            <span className={styles.infillCutListQuantityCell} role="cell">
              <span className={styles.infillCutListMobileLabel}>Qty</span>
              {row.qty}
            </span>
            <span className={styles.infillCutListMeasurementCell} role="cell">
              <span className={styles.infillCutListMobileLabel}>{headings.measurement}</span>
              {measurement}
            </span>
            <span className={styles.infillCutListDetailCell} role="cell">
              <span className={styles.infillCutListMobileLabel}>{headings.detail}</span>
              {detail}
            </span>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className={styles.infillCutList}>
      <div className={styles.infillCutListHeader}>
        <p className={styles.infillComputedNote}>Your cutting and purchase list.</p>
        <div className={styles.infillCutListActions}>
          <button
            type="button"
            className={styles.infillPrimaryButton}
            aria-label="Download cutting list as CSV"
            onClick={downloadCsv}
          >
            Download cutting list
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={styles.infillIconButton}>More</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className={styles.infillExportMenu}>
              <DropdownMenuItem onSelect={() => void copyCsv()}>Copy cutting list</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {pieceRows.length
        ? renderRows(pieceRows, 'Pieces to cut', {
            primary: 'Part',
            measurement: 'Finished size or cut length',
            detail: 'Allocated stock',
          })
        : null}
      {purchaseRows.length
        ? renderRows(purchaseRows, 'Materials to purchase', {
            primary: 'Material',
            measurement: 'Stock size',
            detail: 'Planned use and waste',
          })
        : null}

      {copyMessage ? <p className={styles.infillComputedNote} aria-live="polite">{copyMessage}</p> : null}
    </div>
  );
}
