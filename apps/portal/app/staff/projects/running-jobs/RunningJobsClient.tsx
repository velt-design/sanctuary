'use client';

import type {RunningJobsResponse} from '@/lib/runningJobs/types';
import SpreadsheetPageTemplate from '@/components/spreadsheet/SpreadsheetPageTemplate';
import { useRunningJobsSpreadsheetAdapter } from './useRunningJobsSpreadsheetAdapter';

export default function RunningJobsClient({loader,readOnly=false}:{loader?:()=>Promise<RunningJobsResponse>;readOnly?:boolean}={}) {
  const adapter = useRunningJobsSpreadsheetAdapter({loader,readOnly});
  return <SpreadsheetPageTemplate adapter={adapter} />;
}
