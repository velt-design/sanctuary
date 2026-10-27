import type {ReactNode} from 'react';
import StaffPageHeader from '@/components/layout/StaffPageHeaderSurface';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import styles from './workQueuePage.module.css';
import ReadStatus from '@/components/page-state/ReadStatus';
export type WorkQueuePageEvidence={state:string;count?:string;admin:ReactNode;notices:ReactNode;noticeTitle?:string;retry?:()=>void};
export default function WorkQueueFrame({state,count,admin,notices,noticeTitle,retry,children}:WorkQueuePageEvidence&{children:ReactNode}){
  return <PageLayout width="full" density="compact" className={styles.page} data-project-work-queue-state={state}
    data-project-work-queue-background-ready={state==='fresh'?'true':'false'}>
    <StaffPageHeader title="Work Queue" variant="index" description="One server-confirmed operational obligation per project." count={count} right={
    <ReadStatus title={noticeTitle??(state==='fresh'?'Queue current':state==='unavailable'||state==='not-ready'?'Queue unavailable':state==='error'?'Queue could not load':'Reading work queue…')}
      tone={state==='error'||state==='unavailable'||state==='not-ready'?'error':noticeTitle&&state!=='cached'?'warning':'neutral'}
      onRetry={state==='refresh-failed'?retry:undefined}
      details={noticeTitle?notices:undefined}/>} />
    {children}{admin}
  </PageLayout>;
}
