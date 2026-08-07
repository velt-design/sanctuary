import { Button, Card } from '@/components/ui/foundation';
import ProjectPendingValue, {
  ProjectPendingStatus,
} from '../../ProjectPendingValue';
import ProjectOverviewLayout from './ProjectOverviewLayout';
import styles from './ProjectOverviewPendingFrame.module.css';

const ORIENTATION_FIELDS = [
  ['Journey', 'Loading journey'],
  ['Operational state', 'Loading operational state'],
  ['Customer', 'Loading customer'],
  ['Site', 'Loading project site'],
  ['Reference', 'Loading project reference'],
  ['Freshness', 'Loading server freshness'],
] as const;

export function ProjectOrientationPendingCard() {
  return (
    <Card
      title="Project context"
      padding="none"
      data-project-overview-shell="orientation"
      aria-busy="true"
    >
      <div className={styles.orientationGrid}>
        {ORIENTATION_FIELDS.map(([label, loadingLabel]) => (
          <div className={styles.orientationItem} key={label}>
            <span className={styles.label}>{label}</span>
            <ProjectPendingValue label={loadingLabel} width="medium" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ProjectWorkPendingCard() {
  return (
    <Card
      eyebrow="Next project action"
      title="Project work"
      padding="compact"
      data-project-overview-shell="project-work"
      data-project-work-section="true"
      data-project-work-model="pending"
      aria-busy="true"
    >
      <div className={styles.workBody}>
        <div className={styles.workLead}>
          <span className={styles.label}>Do this next</span>
          <h3 className={styles.workTitle}>
            <ProjectPendingValue label="Loading next project action" width="long" />
          </h3>
          <ProjectPendingValue label="Loading why this action is next" width="full" />
        </div>
        <div className={styles.workMeta}>
          {[
            ['Owner', 'Loading action owner'],
            ['Due', 'Loading action due time'],
            ['Area', 'Loading action area'],
          ].map(([label, loadingLabel]) => (
            <div className={styles.metaItem} key={label}>
              <span className={styles.label}>{label}</span>
              <ProjectPendingValue label={loadingLabel} width="medium" />
            </div>
          ))}
        </div>
        <Button type="button" disabled>
          Loading next action
        </Button>
      </div>
    </Card>
  );
}

export function ProjectCommercialPendingCard() {
  return (
    <Card
      eyebrow="Commercial position"
      title="Current design & commercial"
      padding="none"
      data-project-overview-shell="commercial"
      aria-busy="true"
    >
      <div className={styles.commercialGrid}>
        {[
          ['Customer price', 'Loading customer price'],
          ['Quote', 'Loading current quote'],
          ['Design', 'Loading current design'],
          ['Source estimate', 'Loading source estimate'],
        ].map(([label, loadingLabel]) => (
          <div className={styles.commercialItem} key={label}>
            <span className={styles.label}>{label}</span>
            <ProjectPendingValue label={loadingLabel} width="medium" />
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        <Button type="button" size="small" variant="secondary" disabled>
          View source design
        </Button>
        <Button type="button" size="small" variant="secondary" disabled>
          View quotes
        </Button>
      </div>
    </Card>
  );
}

export function ProjectRecentPendingCard() {
  return (
    <Card
      title="Recent notes and events"
      padding="none"
      data-recent-notes-events="true"
      data-project-overview-shell="recent"
      aria-busy="true"
    >
      <div className={styles.recentGrid}>
        <section className={styles.recentPanel} aria-label="Team notes">
          <h3 className={styles.recentTitle}>Team notes</h3>
          <ProjectPendingValue label="Loading recent team notes" width="full" />
          <ProjectPendingValue label="Loading another recent team note" width="long" />
        </section>
        <section className={styles.recentPanel} aria-label="Recent system events">
          <h3 className={styles.recentTitle}>Recent system events</h3>
          <div className={styles.eventLine}>
            <ProjectPendingValue label="Loading recent event type" width="short" />
            <ProjectPendingValue label="Loading recent event detail" width="long" />
          </div>
        </section>
      </div>
    </Card>
  );
}

export default function ProjectOverviewPendingFrame() {
  return (
    <div
      data-project-overview="true"
      data-portal-page-shell="project-overview"
      data-portal-page-shell-ready="true"
    >
      <ProjectPendingStatus>
        Project structure is ready. Customer and live project values are loading.
      </ProjectPendingStatus>
      <ProjectOverviewLayout
        state="pending"
        orientation={<ProjectOrientationPendingCard />}
        projectWork={<ProjectWorkPendingCard />}
        commercial={<ProjectCommercialPendingCard />}
        recent={<ProjectRecentPendingCard />}
      />
    </div>
  );
}
