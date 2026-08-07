import SpreadsheetPendingFrame from '@/components/spreadsheet/SpreadsheetPendingFrame';
import { RUNNING_JOBS_COLUMNS } from '@/lib/runningJobs/columns';

export default function RunningJobsPendingFrame() {
  return (
    <SpreadsheetPendingFrame
      route="running-jobs"
      title="Running Jobs"
      columns={RUNNING_JOBS_COLUMNS}
    />
  );
}
