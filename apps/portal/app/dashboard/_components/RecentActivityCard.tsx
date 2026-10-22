import PortalIndexLink from '@/components/navigation/PortalIndexLink';
import type { DashboardRecentActivityItem } from '@/lib/dashboard/types';
import { PORTAL_TIME_ZONE } from '@/lib/format/portalDateTime';
import { projectNoteAuthorDisplayName } from '@/lib/projectNotes/types';
import dash from '../dashboard.module.css';
import { Badge } from '@/components/ui/foundation/FoundationSurfaces';

function authorLabel(item: DashboardRecentActivityItem): string {
  const resolved = projectNoteAuthorDisplayName({
    authorDisplayName: item.authorDisplayName,
    authorEmail: item.authorEmail,
  });
  if (resolved) return resolved;
  if (item.authorEmail?.trim()) return item.authorEmail.split('@')[0] || item.authorEmail;
  return 'Unknown';
}

function activityTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: PORTAL_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

import {RecentActivitySurface} from './DashboardCardSurfaces';

export function RecentActivityCardRows({items}:{items:DashboardRecentActivityItem[]}){return (          <ul className={dash.activityList}>
            {items.slice(0, 6).map((item) => (
              <li key={item.id}>
                <PortalIndexLink href={item.href} className={dash.activityItem}>
                  <div className={dash.activityHeaderRow}>
                    <Badge tone="success" edge className={dash.activityTypePill}>Project note</Badge>
                    <span className={dash.activityTime}>{activityTimeLabel(item.at)}</span>
                  </div>
                  <div className={dash.activityProject}>{item.projectName}</div>
                  <div className={dash.activityBody}>{item.body}</div>
                  <div className={dash.activityFooter}>Added by {authorLabel(item)}</div>
                </PortalIndexLink>
              </li>
            ))}
          </ul>);}

export default function RecentActivityCard({items,pending=false}:{items: DashboardRecentActivityItem[]|null;pending?:boolean;}){
 return <RecentActivitySurface rows={items?.length?<RecentActivityCardRows items={items}/>:undefined} hasItems={Boolean(items?.length)} known={items!==null} pending={pending}/>;
}
