'use client';
import PortalIndexLink from '@/components/navigation/PortalIndexLink';
import type { VisitSnapshot } from '@/lib/siteVisits/contract';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { Button } from '@/components/ui/foundation/FoundationControls';
import type {ReactNode} from 'react';



export type TodayVisitsSurfaceProps = {data?:VisitSnapshot;details?:ReactNode;pending:boolean;readFailed:boolean;onRetry:()=>void};
export default function TodayVisitsSurface({data,details,pending,onRetry}:TodayVisitsSurfaceProps){
  return <Card title="Today’s site visits" padding="compact" action={<PortalIndexLink href="/staff/site-visits">View agenda</PortalIndexLink>}>
    {!data?pending?<p role="status">Reading today’s site visits…</p>:<p>Site visits unavailable. <Button variant="quiet" onClick={onRetry}>Retry</Button></p>:<>
      {details}
    </>}
  </Card>;
}
