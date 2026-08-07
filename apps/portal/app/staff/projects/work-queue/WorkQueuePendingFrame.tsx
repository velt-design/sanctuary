import StaffPageHeader from '@/components/layout/StaffPageHeader';
import queueStyles from '@/components/projects/workQueue/ProjectWorkQueue.module.css';
import { Input, Select } from '@/components/ui/foundation/FoundationControls';
import { Badge, Card, PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import styles from './workQueuePage.module.css';

const PENDING_GROUPS = [
  {
    key: 'overdue',
    label: 'Overdue',
    description: 'Work that is past its confirmed due time.',
  },
  {
    key: 'today',
    label: 'Today / ready now',
    description: 'Work due today or ready for the next action.',
  },
  {
    key: 'nextSevenBusinessDays',
    label: 'Next 7 business days',
    description: 'Confirmed work coming up next.',
  },
] as const;

export function WorkQueuePendingBody() {
  return (
    <div className={styles.pendingWrapper}>
      <Card
        title="Find work"
        padding="compact"
        aria-label="Work Queue filters"
        data-portal-page-region="work-queue-filters"
      >
        <div role="search" aria-label="Search and filter" className={styles.pendingFilters}>
          <Input
            id="workQueueSearchPending"
            label="Search"
            placeholder="Project, action, reason or owner…"
            disabled
          />
          <Select id="workQueueOwnerPending" label="Owner" defaultValue="all" disabled>
            <option value="all">All owners</option>
          </Select>
          <Select id="workQueueStagePending" label="Stage" defaultValue="all" disabled>
            <option value="all">All stages</option>
          </Select>
          <Select id="workQueueDuePending" label="When" defaultValue="all" disabled>
            <option value="all">Any time</option>
          </Select>
        </div>
      </Card>

      <div
        className={queueStyles.groups}
        aria-label="Project work queue"
        aria-busy="true"
        data-portal-page-region="work-queue-list"
      >
        {PENDING_GROUPS.map((group, groupIndex) => (
          <section className={queueStyles.group} key={group.key}>
            <header className={queueStyles.groupHeader}>
              <div>
                <h2>{group.label}</h2>
                <p>{group.description}</p>
              </div>
              <Badge tone={group.key === 'overdue' ? 'warning' : 'neutral'}>
                <span className={styles.pendingCount} data-portal-value-slot="loading" aria-hidden="true" />
              </Badge>
            </header>
            <ul className={queueStyles.rows}>
              {Array.from({ length: groupIndex === 0 ? 2 : 1 }, (_, rowIndex) => (
                <li className={queueStyles.row} key={rowIndex}>
                  <div className={queueStyles.rowMain}>
                    {Array.from({ length: 4 }, (_, columnIndex) => (
                      <div className={styles.pendingCell} key={columnIndex}>
                        <span data-portal-value-slot="loading" aria-hidden="true" />
                        <span data-portal-value-slot="loading" aria-hidden="true" />
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <span className="visually-hidden" role="status">Loading project work queue</span>
      </div>
    </div>
  );
}

export default function WorkQueuePendingFrame() {
  return (
    <PageLayout
      width="full"
      density="compact"
      className={styles.page}
      data-portal-page-shell="work-queue"
      data-portal-page-shell-ready="true"
      data-project-work-queue-state="pending"
      data-project-work-queue-background-ready="false"
    >
      <StaffPageHeader
        title="Work Queue"
        variant="index"
        description="One server-confirmed operational obligation per project."
      />
      <WorkQueuePendingBody />
    </PageLayout>
  );
}
