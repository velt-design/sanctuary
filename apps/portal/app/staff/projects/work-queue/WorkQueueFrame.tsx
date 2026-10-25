import type {ReactNode} from 'react';
import StaffPageHeader from '@/components/layout/StaffPageHeaderSurface';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import styles from './workQueuePage.module.css';
export type WorkQueuePageEvidence={state:string;count?:string;admin:ReactNode;notices:ReactNode};
export default function WorkQueueFrame({state,count,admin,notices,children}:WorkQueuePageEvidence&{children:ReactNode}){
  return <PageLayout width="full" density="compact" className={styles.page} data-project-work-queue-state={state}
    data-project-work-queue-background-ready={state==='fresh'?'true':'false'}>
    <StaffPageHeader title="Work Queue" variant="index" description="One server-confirmed operational obligation per project." count={count}/>
    {admin}{notices}{children}
  </PageLayout>;
}
