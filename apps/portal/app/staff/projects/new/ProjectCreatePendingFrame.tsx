import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { Button, ButtonLink, Input } from '@/components/ui/foundation/FoundationControls';
import { Card, PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import styles from './ProjectCreateClient.module.css';

export default function ProjectCreatePendingFrame() {
  return (
    <PageLayout
      className={styles.page}
      data-ui-foundation-consumer="project-create"
      data-portal-page-shell="project-create"
      data-portal-page-shell-ready="true"
      data-portal-page-shell-state="pending"
    >
      <StaffPageHeader
        variant="detail"
        title="New Project"
        description="Create the project record and link its primary customer contact."
        breadcrumbs={[{ label: 'Projects', href: '/staff/projects' }, { label: 'New project' }]}
        right={(
          <HeaderActions>
            <ButtonLink variant="secondary" href="/staff/projects" prefetch={false}>Projects</ButtonLink>
          </HeaderActions>
        )}
      />

      <Card title="Project details" aria-label="Project form" data-portal-shell-region="project-create-form">
        <form>
          <div className={styles.formGrid}>
            <div className={styles.fullWidth}>
              <div className={styles.contactMode} role="group" aria-label="Primary contact choice">
                <Button type="button" variant="secondary" aria-pressed="true" disabled>
                  Choose existing contact
                </Button>
                <Button type="button" variant="tertiary" aria-pressed="false" disabled>
                  Create new contact
                </Button>
              </div>
            </div>
            <Input
              id="projectContactPending"
              label="Primary contact *"
              fieldClassName={styles.fullWidth}
              placeholder="Loading contacts..."
              disabled
            />
            <Input id="projectNamePending" label="Project name *" disabled />
            <Input id="quoteRefPending" label="Quote ref" disabled />
            <Input id="regionPending" label="Region" disabled />
            <Input id="siteAddressPending" label="Site address" fieldClassName={styles.fullWidth} disabled />
          </div>
          <div className={styles.formActions}>
            <Button type="button" disabled>Create project</Button>
            <ButtonLink variant="secondary" href="/staff/projects" prefetch={false}>Cancel</ButtonLink>
          </div>
          <span className="visually-hidden" role="status">Preparing the project form</span>
        </form>
      </Card>
    </PageLayout>
  );
}
