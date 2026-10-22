import type { ReactNode } from 'react';
import type { DashboardParts } from '@/lib/dashboard/dashboardParts';
import type { DashboardData } from '@/lib/dashboard/types';
import stateStyles from '@/components/page-state/PageState.module.css';
import PipelineCountsSurface,{type JourneyCounts} from './_components/PipelineCountsSurface';

import dash from './dashboard.module.css';
import DashboardHero from './_components/DashboardHero';

import {ProjectWorkQueueSurface,RecentActivitySurface,RecentEstimatesSurface} from './_components/DashboardCardSurfaces';

export default function DashboardFrame({
  data, parts={},
  state = 'fresh',
  onRetry,visits,tasksCard,cardRows,portfolioCounts,
}: {
  portfolioCounts?:JourneyCounts;cardRows?:{work:ReactNode;activity:ReactNode;estimates:ReactNode};data: DashboardData|null;parts?:Partial<DashboardParts>;visits:ReactNode;tasksCard:ReactNode;
  state?: 'pending' | 'cached' | 'fresh' | 'refresh-failed' | 'unavailable';
  onRetry?: () => void;
}) {
  const pipeline=parts.pipelineCounts??data;
  const states=parts.projectStateCounts??data;
  const work=parts.projectWorkQueue??data;
  const activity=parts.recentActivity??data;
  const estimates=parts.recentEstimates??data;
  const pending=(known:unknown)=>!known&&state!=='refresh-failed'&&state!=='unavailable';
  return (
    <main
      className={dash.page}
      data-ui-foundation-consumer="dashboard"
      data-dashboard-state={state}
      data-dashboard-background-ready={state === 'fresh' ? 'true' : 'false'}
    >
      <DashboardHero updatedAtIso={parts.snapshot?.updatedAtIso??data?.updatedAtIso??new Date().toISOString()} />

      <div className={dash.content}>
        {state === 'cached' ? (
          <div className={dash.refreshStatus} role="status">Updating...</div>
        ) : null}
        {state === 'refresh-failed' ? (
          <div className={`${stateStyles.inlineNotice} ${dash.refreshNotice}`} role="status">
            <span>{Object.keys(parts).length?'Some Dashboard sections could not load. Complete sections remain available.':data?'Could not refresh the dashboard. Showing the last saved information.':'Could not load the dashboard. Retry to read the current information.'}</span>
            {onRetry ? (
              <button type="button" className={stateStyles.secondaryAction} onClick={onRetry}>Retry</button>
            ) : null}
          </div>
        ) : null}

        <div className={dash.layout}>
          <PipelineCountsSurface
            journeyCounts={portfolioCounts} pending={pending(pipeline)} statePending={pending(states)}
            countsAvailable={(state !== 'refresh-failed' || Boolean(parts.pipelineCounts)) && pipeline?.pipelineCountsScope === 'open_enquiry_proposal_v1' && pipeline?.pipelineCountsAvailable === true}
            stateCounts={states?.projectStateCounts}
            stateCountsAvailable={Boolean(states)&&states?.projectStateCountsAvailable !== false}
          />

          <div className={dash.workspaceGrid}>
            {visits}
            <ProjectWorkQueueSurface rows={cardRows?.work} hasItems={Boolean(work?.projectWorkQueue?.length)}
              pending={pending(work)}
              available={Boolean(work)&&work?.projectWorkQueueAvailable !== false}
            />
            <RecentActivitySurface rows={cardRows?.activity} known={activity?.recentActivity!=null} hasItems={Boolean(activity?.recentActivity.length)} pending={pending(activity)} />
            <RecentEstimatesSurface rows={cardRows?.estimates} known={estimates?.recentEstimates!=null} hasItems={Boolean(estimates?.recentEstimates.length)} pending={pending(estimates)} />
            {tasksCard}
          </div>
        </div>
      </div>
    </main>
  );
}
