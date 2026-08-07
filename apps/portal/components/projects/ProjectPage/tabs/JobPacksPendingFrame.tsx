import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/foundation';
import ProjectPendingValue from '../ProjectPendingValue';
import styles from '../ProjectPagePendingFrame.module.css';

const JOB_PACK_COLUMNS = ['Design', 'Quote', 'Generated', 'Status'] as const;

export default function JobPacksPendingFrame() {
  return (
    <div
      className={styles.jobPacks}
      data-portal-page-shell="project-job-packs"
      data-portal-page-shell-ready="true"
      aria-busy="true"
    >
      <div className={styles.jobPacksHeader}>
        <h2>Job Packs</h2>
        <p>Generated job packs and their source designs.</p>
      </div>
      <Table aria-label="Job packs">
        <TableHeader>
          <TableRow>
            {JOB_PACK_COLUMNS.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }, (_, rowIndex) => (
            <TableRow key={rowIndex} data-portal-table-row="loading">
              {JOB_PACK_COLUMNS.map((column) => (
                <TableCell key={column}>
                  <ProjectPendingValue label={`Loading ${column.toLowerCase()}`} width="medium" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
