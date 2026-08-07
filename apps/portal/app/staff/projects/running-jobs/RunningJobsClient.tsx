'use client';

import SpreadsheetPageTemplate from '@/components/spreadsheet/SpreadsheetPageTemplate';
import { useRunningJobsSpreadsheetAdapter } from './useRunningJobsSpreadsheetAdapter';

export default function RunningJobsClient() {
  const adapter = useRunningJobsSpreadsheetAdapter();
  return <SpreadsheetPageTemplate adapter={adapter} routeShell="running-jobs" />;
}
