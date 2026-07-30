import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { LoadingSkeleton, PageLayout } from '@/components/ui/foundation';
import styles from './workQueuePage.module.css';

export default function ProjectWorkQueueLoading() {
  return (
    <PageLayout width="full" density="compact" className={styles.page}>
      <StaffPageHeader
        title="Work Queue"
        variant="index"
        description="One current operational obligation per project."
      />
      <LoadingSkeleton rows={7} columns={4} label="Loading project work queue" />
    </PageLayout>
  );
}
