import { ExternalLink } from 'lucide-react';
import ProjectsIndexLink from '@/components/navigation/ProjectsIndexLink';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import {
  Badge,
  ButtonLink,
  Card,
  PageLayout,
  TabNavigation,
} from '@/components/ui/foundation';
import {
  getAvailableProjectTabs,
  isProjectNavigationTabSelected,
  isProjectTabKey,
  type ProjectNavigationTabKey,
  type ProjectTabKey,
} from '@/lib/projects/projectTabs';
import ProjectCalculatorPendingFrame from './tabs/ProjectCalculatorPendingFrame';
import ProjectCommercialPendingFrame from './tabs/CommercialPendingFrames';
import ProjectOverviewPendingFrame from './tabs/overview/ProjectOverviewPendingFrame';
import ProjectPendingValue, {
  ProjectPendingStatus,
} from './ProjectPendingValue';
import projectStyles from './ProjectPage.module.css';
import styles from './ProjectPagePendingFrame.module.css';
import JobPackDetailPendingFrame from './tabs/JobPackDetailPendingFrame';
import JobPacksPendingFrame from './tabs/JobPacksPendingFrame';

function resolvedTab(tab: string | null | undefined): ProjectTabKey {
  return isProjectTabKey(tab) ? tab : 'activity';
}

export default function ProjectPagePendingFrame({
  activeTab: activeTabProp = 'activity',
  projectId,
  onTabSelect,
  onCommercialViewSelect,
  quoteDetail = false,
  quotePreview = false,
  quoteId,
  jobPackDetail = false,
  jobPackSheet,
  jobPackEstimateId,
  onQuoteDetailBack,
  onQuotePreviewSelect,
  onJobPackDetailBack,
}: {
  activeTab?: string | null;
  projectId?: string | null;
  onTabSelect?: (tab: ProjectNavigationTabKey) => void;
  onCommercialViewSelect?: (view: 'quotes' | 'invoices') => void;
  quoteDetail?: boolean;
  quotePreview?: boolean;
  quoteId?: string | null;
  jobPackDetail?: boolean;
  jobPackSheet?: string | null;
  jobPackEstimateId?: string | null;
  onQuoteDetailBack?: () => void;
  onQuotePreviewSelect?: (preview: boolean) => void;
  onJobPackDetailBack?: () => void;
}) {
  const activeTab = resolvedTab(activeTabProp);
  const showJobPacks = activeTab === 'job-packs';
  const tabs = getAvailableProjectTabs(showJobPacks);
  const selectedNavigationKey =
    tabs.find((item) => isProjectNavigationTabSelected(item.navigationKey, activeTab))?.navigationKey
    ?? 'activity';
  const designWorkbenchHref = projectId
    ? `/staff/projects/${encodeURIComponent(projectId)}/design-workbench`
    : '/staff/projects';

  return (
    <PageLayout
      width="full"
      className={projectStyles.page}
      data-ui-foundation-consumer="project-detail"
      data-project-id={projectId || undefined}
      data-project-quote-id={quoteId || undefined}
      data-project-estimate-id={jobPackEstimateId || undefined}
      data-project-route-pending="true"
      data-project-shell-ready="true"
      data-project-snapshot-state="pending"
      data-portal-page-shell="project-detail"
      data-portal-page-shell-ready="true"
    >
      <ProjectPendingStatus>
        Project page structure is ready. Project, customer and operational values are loading.
      </ProjectPendingStatus>
      <div
        className={projectStyles.pageFrame}
        data-project-page-frame="true"
        data-project-masthead-sticky="true"
      >
        <div
          className={`${projectStyles.pageFrameMastheadSlot} ${projectStyles.pageFrameMastheadSlotSticky}`}
          data-project-masthead-slot="fixed"
          data-project-masthead-slot-sticky="true"
          data-portal-route-region="project-header"
        >
          <Card className={projectStyles.masthead} padding="none" aria-label="Project summary">
            <div className={projectStyles.mastheadBody} data-project-header-row="command">
              <StaffPageHeader
                className={`${projectStyles.mastheadHeader} ${styles.pendingTitle}`}
                variant="detail"
                title="Opening project..."
                titleAccessory={<Badge tone="neutral">Updating</Badge>}
                meta={(
                  <span className={styles.owner}>
                    <strong>Owner</strong>
                    <ProjectPendingValue label="Loading project owner" width="short" />
                  </span>
                )}
                right={(
                  <div className={projectStyles.mastheadActions}>
                    <ProjectsIndexLink href="/staff/projects" variant="secondary" size="small">
                      Projects
                    </ProjectsIndexLink>
                    <ButtonLink
                      href={designWorkbenchHref}
                      prefetch={false}
                      size="small"
                      leadingIcon={<ExternalLink aria-hidden="true" />}
                      disabled={!projectId}
                    >
                      Design Workbench
                    </ButtonLink>
                  </div>
                )}
              />
            </div>
            <div data-project-header-row="tabs">
              <TabNavigation
                ariaLabel="Project sections"
                items={tabs.map((item) => ({
                  key: item.navigationKey,
                  label: item.label,
                  controls: 'project-tab-content',
                }))}
                selectedKey={selectedNavigationKey}
                onSelect={(nextTab) => onTabSelect?.(nextTab)}
                disabled={!onTabSelect}
              />
            </div>
          </Card>
        </div>

        <div className={projectStyles.pageFrameBody}>
          <section className={projectStyles.fullWidthShell} data-project-page-shell="true">
            <section
              id="project-tab-content"
              className={`${projectStyles.projectTabSurface} ${activeTab === 'estimates' ? projectStyles.tabSectionWorkspace : ''}`}
              aria-label="Project tab content"
              role="tabpanel"
              data-project-active-tab={activeTab}
              data-portal-route-region="project-tab"
            >
              <div
                className={`${projectStyles.projectTabBody} ${activeTab === 'estimates' ? projectStyles.sectionBodyWorkspace : ''}`}
                data-project-tab-body={activeTab}
                data-project-tab-shell-ready="true"
              >
                {activeTab === 'activity' ? <ProjectOverviewPendingFrame /> : null}
                {activeTab === 'estimates' ? <ProjectCalculatorPendingFrame /> : null}
                {activeTab === 'quotes' || activeTab === 'invoices' ? (
                  <ProjectCommercialPendingFrame
                    view={activeTab}
                    onViewSelect={onCommercialViewSelect}
                    quoteDetail={quoteDetail}
                    quotePreview={quotePreview}
                    onQuoteDetailBack={onQuoteDetailBack}
                    onQuotePreviewSelect={onQuotePreviewSelect}
                  />
                ) : null}
                {activeTab === 'job-packs'
                  ? jobPackDetail
                    ? (
                        <JobPackDetailPendingFrame
                          sheet={jobPackSheet}
                          onBack={onJobPackDetailBack}
                        />
                      )
                    : <JobPacksPendingFrame />
                  : null}
              </div>
            </section>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
