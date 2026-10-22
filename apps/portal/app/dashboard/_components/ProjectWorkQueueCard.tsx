import PortalIndexLink from '@/components/navigation/PortalIndexLink';
import { ProjectStageBadge } from '@/components/ui/foundation/SanctuaryStatus';
import {
  effectiveAssigneeLabel,
  queueDueLabel,
  queueEntryStage,
  type WorkQueueEntryView,
} from '@/components/projects/workQueue/workQueuePresentation';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import type { ProjectWorkQueueEntry } from '@/lib/projects/workItems/types';
import dash from '../dashboard.module.css';

import {ProjectWorkQueueSurface} from './DashboardCardSurfaces';

export function ProjectWorkQueueCardRows({items}:{items:ProjectWorkQueueEntry[]}){return (          <ul className={dash.queueList}>
            {items.map((rawEntry) => {
              const entry = rawEntry as WorkQueueEntryView;
              const stage = normalizePipelineStageKey(queueEntryStage(entry));
              return (
                <li key={entry.projectId}>
                  <PortalIndexLink className={dash.queueRow} href={entry.href}>
                    <span className={dash.queueAction}>{entry.title}</span>
                    <span className={dash.queueProject}>
                      <strong>{entry.projectName}</strong>
                      <small>{entry.reason}</small>
                    </span>
                    {stage ? <ProjectStageBadge stage={stage} compact /> : <span />}
                    <span className={dash.queueAccountability}>
                      <span className={dash.queueOwner}>Owner: {effectiveAssigneeLabel(entry, [])}</span>
                      <span className={dash.queueDue} data-state={entry.group}>When: {queueDueLabel(entry)}</span>
                    </span>
                  </PortalIndexLink>
                </li>
              );
            })}
          </ul>);}

export default function ProjectWorkQueueCard({items,available,pending=false}:{items: ProjectWorkQueueEntry[];available:boolean;pending?:boolean;}){
 return <ProjectWorkQueueSurface rows={items?.length?<ProjectWorkQueueCardRows items={items}/>:undefined} hasItems={Boolean(items?.length)} available={available} pending={pending}/>;
}
