import type { ReactNode } from 'react';
import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import ListCountBanner from '@/components/ui/listBanner/ListCountBanner';
import { ButtonLink, Card, PageLayout } from '@/components/ui/foundation';
import styles from './ProjectsIndexClient.module.css';

type ProjectsIndexFrameState = 'pending' | 'cached' | 'fresh' | 'refresh-failed' | 'unavailable';

export default function ProjectsIndexFrame({
  state,
  backgroundReady,
  totalCount,
  visibleCount,
  truncated = false,
  rangeLabel,
  filters,
  list,
  additionalContent,
}: {
  state: ProjectsIndexFrameState;
  backgroundReady: boolean;
  totalCount: number | null;
  visibleCount: number;
  truncated?: boolean;
  rangeLabel?: ReactNode;
  filters: ReactNode;
  list: ReactNode;
  additionalContent?: ReactNode;
}) {
  return (
    <PageLayout
      width="full"
      density="compact"
      className={styles.page}
      data-portal-page-shell="projects"
      data-portal-page-shell-ready="true"
      data-projects-index-state={state}
      data-projects-index-background-ready={backgroundReady ? 'true' : 'false'}
    >
      <StaffPageHeader
        title="Projects"
        variant="index"
        description="Search, update and continue work across the project pipeline."
        count={totalCount === null ? 'Projects updating' : `${totalCount} projects`}
        primaryAction={{ label: 'New project', href: '/staff/projects/new', prefetch: false }}
        right={
          <HeaderActions>
            <ButtonLink variant="tertiary" href="/staff/projects/design-packages" prefetch={false}>
              Drafting Queue
            </ButtonLink>
            <ButtonLink variant="secondary" href="/staff/projects/running-jobs" prefetch={false}>
              Running Jobs
            </ButtonLink>
          </HeaderActions>
        }
      />

      <ListCountBanner
        totalCount={totalCount}
        visibleCount={visibleCount}
        entityLabelSingular="project"
        entityLabelPlural="projects"
        truncated={truncated}
      />

      <div className={styles.stack}>
        <Card title="Filters" padding="compact" aria-label="Filters" data-portal-shell-region="projects-filters">
          {filters}
        </Card>

        <Card
          title="All Projects"
          padding="none"
          aria-label="Projects list"
          data-portal-shell-region="projects-list"
          action={
            <div className={styles.muted} suppressHydrationWarning>
              {rangeLabel}
            </div>
          }
        >
          {list}
        </Card>
      </div>

      {additionalContent}
    </PageLayout>
  );
}
