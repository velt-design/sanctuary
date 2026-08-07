import StaffPageHeader from '@/components/layout/StaffPageHeader';
import type { CSSProperties } from 'react';
import type { SpreadsheetColumn } from './types';
import styles from './spreadsheet.module.css';

export type SpreadsheetRouteShell = 'design-list' | 'running-jobs';

function PendingZoomControls() {
  return (
    <div className={styles.zoomDockLayer} data-active="false" data-visible="true">
      <div className={styles.zoomDock} aria-label="Sheet zoom controls">
        <button type="button" className={styles.zoomButton} disabled aria-label="Zoom out">-</button>
        <input
          className={styles.zoomSlider}
          type="range"
          min="70"
          max="130"
          value="100"
          readOnly
          disabled
          aria-label="Sheet zoom"
        />
        <button type="button" className={styles.zoomButton} disabled aria-label="Zoom in">+</button>
        <select className={styles.zoomPreset} value="100" disabled aria-label="Zoom preset">
          <option value="100">100%</option>
        </select>
        <button type="button" className={styles.fitButton} disabled>Fit visible columns</button>
        <span className={styles.zoomValue}>100%</span>
      </div>
    </div>
  );
}

export function SpreadsheetStructureGrid<TKey extends string>({
  columns,
  label,
  state,
  emptyMessage,
}: {
  columns: readonly SpreadsheetColumn<TKey>[];
  label: string;
  state: 'pending' | 'empty';
  emptyMessage?: string;
}) {
  return (
    <div
      className={styles.sheetViewport}
      data-portal-page-region="spreadsheet-grid"
      aria-busy={state === 'pending' || undefined}
    >
      <div className={styles.tableScroller} style={{ '--sheet-scale': 1 } as CSSProperties}>
        <table className={styles.table} aria-label={label}>
          <colgroup>
            <col style={{ width: 58 }} />
            {columns.map((column) => <col key={column.key} style={{ width: column.widthPx }} />)}
          </colgroup>
          <thead>
            <tr className={styles.letterRow}>
              <th className={`${styles.cornerCell} ${styles.rowNumberBandCell}`} />
              {columns.map((column) => (
                <th
                  key={`${column.key}_letter`}
                  className={`${styles.letterCell} ${column.frozen ? styles.frozenLetterCell : ''}`}
                  scope="col"
                >
                  {column.letter}
                </th>
              ))}
            </tr>
            <tr className={styles.labelsRow}>
              <th className={`${styles.rowNumberHeaderCell} ${styles.rowNumberBandCell}`} />
              {columns.map((column) => (
                <th
                  key={`${column.key}_header`}
                  className={`${styles.headerCell} ${column.frozen ? styles.frozenHeaderCell : ''}`}
                  scope="col"
                >
                  <span className={styles.headerLabel}>{column.label}</span>
                  {column.sourceLabel ? <span className={styles.headerSource}>{column.sourceLabel}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state === 'pending' ? Array.from({ length: 7 }, (_, rowIndex) => (
              <tr className={styles.row} key={rowIndex}>
                <th className={styles.rowNumberCell} scope="row">{rowIndex + 1}</th>
                {columns.map((column) => (
                  <td className={styles.bodyCell} key={column.key}>
                    <span className={styles.pendingCellValue} data-portal-value-slot="loading" aria-hidden="true" />
                  </td>
                ))}
              </tr>
            )) : (
              <tr className={styles.row}>
                <th className={styles.rowNumberCell} scope="row" />
                <td className={styles.emptyGridCell} colSpan={columns.length}>{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PendingZoomControls />
      {state === 'pending' ? <span className="visually-hidden" role="status">Loading {label.toLowerCase()}...</span> : null}
    </div>
  );
}

function SpreadsheetPendingToolbar({ route }: { route: SpreadsheetRouteShell }) {
  const isRunningJobs = route === 'running-jobs';
  return (
    <div className={styles.toolbar} data-portal-page-region="spreadsheet-filters">
      <input className={styles.toolbarInput} type="search" placeholder="Search jobs" disabled />
      <select className={styles.toolbarSelect} defaultValue="all" disabled aria-label="Year">
        <option value="all">All years</option>
      </select>
      <select className={styles.toolbarSelect} defaultValue="all" disabled aria-label={isRunningJobs ? 'Crew' : 'Designer'}>
        <option value="all">{isRunningJobs ? 'All crews' : 'All designers'}</option>
      </select>
      <select className={styles.toolbarSelect} defaultValue="all" disabled aria-label="Status">
        <option value="all">{isRunningJobs ? 'All stages' : 'All statuses'}</option>
      </select>
      <label className={styles.toolbarToggle}>
        <input type="checkbox" disabled />
        <span>Overdue only</span>
      </label>
      <label className={styles.toolbarToggle}>
        <input type="checkbox" disabled />
        <span>Show completed</span>
      </label>
      <div className={styles.meta}>
        <span>Updating {isRunningJobs ? 'jobs' : 'requests'}...</span>
        <span>Loading...</span>
      </div>
    </div>
  );
}

export default function SpreadsheetPendingFrame<TKey extends string>({
  route,
  title,
  columns,
}: {
  route: SpreadsheetRouteShell;
  title: string;
  columns: readonly SpreadsheetColumn<TKey>[];
}) {
  return (
    <main
      className={styles.page}
      data-ui-foundation-consumer="spreadsheet"
      data-portal-page-shell={route}
      data-portal-page-shell-ready="true"
      data-portal-page-shell-state="pending"
      data-portal-page-background-ready="false"
    >
      <StaffPageHeader title={title} />
      <div className={styles.stack}>
        <section className={styles.section}>
          <SpreadsheetPendingToolbar route={route} />
          <SpreadsheetStructureGrid columns={columns} label={title} state="pending" />
        </section>
      </div>
    </main>
  );
}
