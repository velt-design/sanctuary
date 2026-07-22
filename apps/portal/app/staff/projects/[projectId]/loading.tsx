import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { Card, LoadingSkeleton, PageLayout } from '@/components/ui/foundation';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';

export default function ProjectDetailLoading() {
  return (
    <PageLayout width="full" className={styles.page} data-project-route-pending="true">
      <StaffPageHeader
        variant="detail"
        eyebrow="Projects"
        title="Opening project..."
        description="Preparing the project summary in the background."
        back={{ label: 'Back to Projects', href: '/staff/projects' }}
      />
      <Card padding="compact" aria-label="Project loading">
        <LoadingSkeleton rows={5} columns={4} label="Loading project" />
      </Card>
    </PageLayout>
  );
}
