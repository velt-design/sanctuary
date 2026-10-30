'use client';

import { useSearchParams } from 'next/navigation';
import ProjectIndexToolbar from '@/app/staff/projects/ProjectIndexToolbar';
import { parseProjectIndexView } from '@/app/staff/projects/projectIndexView';
import { ButtonLink, Card, LoadingSkeleton, PageLayout } from '@/components/ui/foundation';
import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import type { PortalInstantRoute } from '@/lib/portalInstantRoutes';
import styles from './ProjectsIndexPendingFrame.module.css';
import indexStyles from '@/app/staff/projects/ProjectsIndexClient.module.css';

type ProjectsIndexPendingFrameProps = {
  instantRoute?: PortalInstantRoute;
  title?: string;
  description?: string;
  projectLabel?: string | null;
};

export default function ProjectsIndexPendingFrame({
  instantRoute = 'projects-index',
  title = 'Projects',
  description,
  projectLabel,
}: ProjectsIndexPendingFrameProps = {}) {
  const params = useSearchParams();
  const view = parseProjectIndexView(new URLSearchParams(params?.toString() ?? ''));
  if (instantRoute !== 'projects-index') {
    const visibleTitle = instantRoute === 'project-detail' && projectLabel?.trim()
      ? projectLabel.trim()
      : title;

    return (
      <main
        className={styles.page}
        data-portal-instant-shell={instantRoute}
        data-portal-instant-shell-state="pending"
        data-project-route-pending={instantRoute === 'project-detail' ? 'true' : undefined}
        aria-busy="true"
      >
        <StaffPageHeader variant="index" title={visibleTitle} />
        <div className={styles.stack}>
          <section className={styles.section} aria-label={`${visibleTitle} workspace`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Workspace</h2>
              <span className={styles.muted}>Updating…</span>
            </div>
            <div className={styles.sectionBody}>
              <p className={styles.note} role="status">{description}</p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <PageLayout width="full" density="compact" className={indexStyles.page}
      data-projects-index-state="pending" data-ui-foundation-consumer="projects-pending"
      data-projects-index-background-ready="false" aria-label="Opening projects">
      <StaffPageHeader variant="index" title="Projects" count="Loading projects"
        primaryAction={{ label: 'New project', href: '/staff/projects/new' }}
        right={<HeaderActions>
          <ButtonLink variant="tertiary" href="/staff/projects/design-packages">Drafting Queue</ButtonLink>
          <ButtonLink variant="secondary" href="/staff/projects/running-jobs">Running Jobs</ButtonLink>
        </HeaderActions>} />
      <div className={indexStyles.stack}>
        <ProjectIndexToolbar view={view} disabled onChange={() => {}} onReset={() => {}} />
        <Card title="Projects" padding="none" aria-label="Projects list" action={<span className={styles.muted}>Updating…</span>}>
          <LoadingSkeleton rows={5} columns={4} label="Updating projects…" />
        </Card>
      </div>
    </PageLayout>
  );
}
