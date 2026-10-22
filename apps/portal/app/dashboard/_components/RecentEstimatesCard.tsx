import PortalIndexLink from '@/components/navigation/PortalIndexLink';
import { Badge } from '@/components/ui/foundation/FoundationSurfaces';
import { PORTAL_TIME_ZONE } from '@/lib/format/portalDateTime';
import type { DashboardRecentEstimate } from '@/lib/dashboard/types';
import dash from '../dashboard.module.css';

const nzd = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  maximumFractionDigits: 0,
});

function updatedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: PORTAL_TIME_ZONE,
    day: 'numeric',
    month: 'short',
  }).format(date);
}

import {RecentEstimatesSurface} from './DashboardCardSurfaces';

export function RecentEstimatesCardRows({items}:{items:DashboardRecentEstimate[]}){return (          <ul className={dash.operationalList}>
            {items.map((item) => (
              <li key={item.estimateId}>
                <PortalIndexLink className={`${dash.operationalRow} ${dash.estimateRow}`} href={item.href}>
                  <span className={dash.rowPrimary}>
                    <strong>{item.projectName}</strong>
                    <small><Badge>{item.versionLabel}</Badge> <span>Draft</span></small>
                  </span>
                  <span className={dash.estimateMeta}>
                    <strong>{item.customerPriceIncGst === null ? 'Price unavailable' : nzd.format(item.customerPriceIncGst)}</strong>
                    <time dateTime={item.updatedAt}>{updatedLabel(item.updatedAt)}</time>
                  </span>
                </PortalIndexLink>
              </li>
            ))}
          </ul>);}

export default function RecentEstimatesCard({items,pending=false}:{items: DashboardRecentEstimate[]|null;pending?:boolean;}){
 return <RecentEstimatesSurface rows={items?.length?<RecentEstimatesCardRows items={items}/>:undefined} hasItems={Boolean(items?.length)} known={items!==null} pending={pending}/>;
}
