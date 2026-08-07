import { SpreadsheetStructureGrid } from '@/components/spreadsheet/SpreadsheetPendingFrame';
import type { SpreadsheetColumn } from '@/components/spreadsheet/types';
import { JOB_PACK_SHEETS, coerceJobPackSheet } from '@/lib/jobPacks/workbook';
import ProjectPendingValue, { ProjectPendingStatus } from '../ProjectPendingValue';
import spreadsheetStyles from '@/components/spreadsheet/spreadsheet.module.css';
import styles from './JobPacksTab.module.css';

const COLUMNS = [
  { key: 'item', letter: 'A', label: 'Item', widthPx: 280, editable: false, frozen: true },
  { key: 'description', letter: 'B', label: 'Description', widthPx: 300, editable: false },
  { key: 'quantity', letter: 'C', label: 'Quantity', widthPx: 140, editable: false },
  { key: 'unit', letter: 'D', label: 'Unit', widthPx: 120, editable: false },
  { key: 'notes', letter: 'E', label: 'Notes', widthPx: 280, editable: false },
] as const satisfies readonly SpreadsheetColumn<string>[];

export default function JobPackDetailPendingFrame({
  sheet,
  onBack,
}: {
  sheet?: string | null;
  onBack?: () => void;
}) {
  const activeSheet = coerceJobPackSheet(sheet);
  const activeLabel = JOB_PACK_SHEETS.find((item) => item.key === activeSheet)?.label ?? 'Materials';

  return (
    <div
      className={styles.wrapper}
      data-portal-page-shell="project-job-pack-detail"
      data-portal-page-shell-ready="true"
      aria-busy="true"
    >
      <ProjectPendingStatus>
        Job pack structure is ready. Saved estimate and workbook values are loading.
      </ProjectPendingStatus>
      <div className={spreadsheetStyles.toolbar} aria-label="Job pack controls">
        <div className={spreadsheetStyles.toolbarPrimary}>
          <button
            type="button"
            className={spreadsheetStyles.toolbarAction}
            onClick={onBack}
            disabled={!onBack}
          >
            Back to job packs
          </button>
          <select
            className={spreadsheetStyles.toolbarSelect}
            value={activeSheet}
            disabled
            aria-label="Job pack sheet"
          >
            {JOB_PACK_SHEETS.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </div>
        <div className={spreadsheetStyles.toolbarSecondary}>
          <div className={spreadsheetStyles.toolbarMeta}>
            <ProjectPendingValue label="Loading design version" width="short" />
            <ProjectPendingValue label="Loading estimate status" width="short" />
            <ProjectPendingValue label="Loading true cost" width="medium" />
          </div>
          <button type="button" className={spreadsheetStyles.toolbarAction} disabled>
            Download PDF
          </button>
          <button type="button" className={spreadsheetStyles.toolbarAction} disabled>
            Open estimate
          </button>
        </div>
      </div>
      <div className={styles.sheetWrap}>
        <SpreadsheetStructureGrid
          columns={COLUMNS}
          label={`Job pack ${activeLabel}`}
          state="pending"
        />
      </div>
    </div>
  );
}
