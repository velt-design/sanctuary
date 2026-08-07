import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardView from './DashboardView';
import type { DashboardData } from '@/lib/dashboard/types';

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('./_components/DashboardTasksCard.client', () => ({
  default: (props: { initialTasks?: Array<{ title: string; completedAt?: string | null }>; loading?: boolean }) => (
    <section
      aria-label="My Tasks"
      aria-busy={props.loading}
      data-dashboard-card-state={props.loading ? 'loading' : 'ready'}
      data-portal-shell-region="dashboard-tasks"
    >
      <h2>My Tasks</h2>
      {props.loading ? <div data-dashboard-loading-rows="true">Updating personal tasks...</div> : null}
      {(props.initialTasks ?? []).map((task) => (
        <div key={task.title} style={{ textDecoration: task.completedAt ? 'line-through' : undefined }}>
          {task.title}
        </div>
      ))}
    </section>
  ),
}));

const data: DashboardData = {
  updatedAtIso: '2026-04-02T00:00:00.000Z',
  kpis: {
    newLeads: 2,
    quotesToSend: 1,
    installsThisWeek: 3,
  },
  projectWorkQueue: [
    {
      projectId: 'proj_123',
      projectName: 'Beach House',
      stage: 'contacted',
      group: 'today',
      actionKind: 'workItem',
      title: 'Send first enquiry email',
      reason: 'This project work is due today.',
      dueAt: '2026-04-02T09:00:00.000Z',
      priority: 'NORMAL',
      blockedReason: null,
      effectiveAssignee: { kind: 'unassigned' },
      workItemId: '11111111-1111-4111-8111-111111111111',
      workItemRowVersion: 1,
      stateRowVersion: 1,
      sourceType: 'LEAD_CADENCE',
      sourceKey: 'lead:first-email:project:v1',
      subjectKind: 'PROJECT',
      subjectId: '22222222-2222-4222-8222-222222222222',
      href: '/staff/projects/proj_123?tab=activity',
    },
  ],
  projectWorkQueueAvailable: true,
  schedule: {
    startingSoon: [],
    crewAvailability: [],
    hrefBoard: '/staff/schedule?view=board',
    hrefGantt: '/staff/schedule?view=gantt',
  },
  siteVisits: {
    unscheduledCount: 0,
    today: [],
    next7: [],
    hrefSiteVisits: '/staff/schedule?view=site-visits',
  },
  pipelineCounts: {},
  recentEstimates: [
    {
      estimateId: 'est_123',
      projectId: 'proj_123',
      projectName: 'Beach House',
      versionLabel: 'V3',
      status: 'draft',
      customerPriceIncGst: 143750,
      updatedAt: '2026-04-02T09:00:00.000Z',
      href: '/staff/projects/proj_123?tab=estimates&estimateId=est_123',
    },
  ],
  recentActivity: [
    {
      id: 'note_1',
      type: 'project_note',
      at: '2026-04-02T10:00:00.000Z',
      body: 'Client prefers a darker roof finish.',
      projectId: 'proj_123',
      projectName: 'Beach House',
      authorDisplayName: 'Alex',
      authorEmail: 'alex@example.com',
      href: '/staff/projects/proj_123',
    },
  ],
  personalTasks: [
    {
      id: 'task_1',
      title: 'Call supplier',
      completedAt: null,
      createdAt: '2026-04-02T09:00:00.000Z',
      updatedAt: '2026-04-02T09:00:00.000Z',
    },
  ],
};

describe('DashboardView', () => {
  it('renders the concept-led operational dashboard sections', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} />);

    expect(markup).toContain('Dashboard');
    expect(markup).toContain('data-portal-page-shell="dashboard"');
    expect(markup).toContain('data-portal-page-shell-ready="true"');
    expect(markup).toContain('Welcome back');
    expect(markup).toContain('Quick actions');
    expect(markup).toContain('Project portfolio');
    expect(markup).toContain('Recent Estimates');
    expect(markup).toContain('Work Queue');
    expect(markup).toContain('Send first enquiry email');
    expect(markup).toContain('Owner: Unassigned');
    expect(markup).toContain('When:');
    expect(markup).toContain('Recent Activity');
    expect(markup).toContain('Beach House');
    expect(markup).toContain('Project note');
    expect(markup).toContain('Client prefers a darker roof finish.');
    expect(markup).toContain('My Tasks');
    expect(markup).toContain('Call supplier');
  });

  it('renders recent activity with category, project, note, and author hierarchy', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} />);

    const labelIndex = markup.lastIndexOf('Project note');
    const projectIndex = markup.indexOf('Beach House', labelIndex);
    const noteIndex = markup.indexOf('Client prefers a darker roof finish.', projectIndex);
    const authorIndex = markup.indexOf('Added by Alex', noteIndex);

    expect(labelIndex).toBeGreaterThan(-1);
    expect(projectIndex).toBeGreaterThan(-1);
    expect(noteIndex).toBeGreaterThan(-1);
    expect(authorIndex).toBeGreaterThan(-1);
    expect(labelIndex).toBeLessThan(projectIndex);
    expect(projectIndex).toBeLessThan(noteIndex);
    expect(noteIndex).toBeLessThan(authorIndex);
  });

  it('prioritizes the overview before the ordered operations row', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} />);

    const portfolioIndex = markup.indexOf('Project portfolio');
    const activityIndex = markup.indexOf('Recent Activity');
    const queueIndex = markup.indexOf('Work Queue');
    const estimatesIndex = markup.indexOf('Recent Estimates');
    const tasksIndex = markup.indexOf('My Tasks');

    expect(portfolioIndex).toBeGreaterThan(-1);
    expect(estimatesIndex).toBeGreaterThan(-1);
    expect(queueIndex).toBeGreaterThan(-1);
    expect(activityIndex).toBeGreaterThan(-1);
    expect(tasksIndex).toBeGreaterThan(-1);
    expect(portfolioIndex).toBeLessThan(queueIndex);
    expect(queueIndex).toBeLessThan(activityIndex);
    expect(activityIndex).toBeLessThan(estimatesIndex);
    expect(estimatesIndex).toBeLessThan(tasksIndex);
  });

  it('does not render retired exceptions, installs, or misleading quote labels', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} />);

    expect(markup).not.toContain('Project Exceptions');
    expect(markup).not.toContain('Installs this week');
    expect(markup).not.toContain('Upcoming Installs');
    expect(markup).not.toContain('Quotes to send');
    expect(markup).not.toContain('New Leads');
    expect(markup).not.toContain('Attention Today');
    expect(markup).not.toContain('Projects in quoting');
  });

  it('marks cached data as updating without hiding it', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} state="cached" />);

    expect(markup).toContain('data-dashboard-state="cached"');
    expect(markup).toContain('data-portal-page-shell="dashboard"');
    expect(markup).toContain('data-dashboard-background-ready="false"');
    expect(markup).toContain('Updating...');
    expect(markup).toContain('Beach House');
  });

  it('keeps known data and offers Retry after a refresh failure', () => {
    const markup = renderToStaticMarkup(
      <DashboardView data={data} state="refresh-failed" onRetry={() => undefined} />,
    );

    expect(markup).toContain('data-dashboard-state="refresh-failed"');
    expect(markup).toContain('Showing the last saved information');
    expect(markup).toContain('Retry');
    expect(markup).toContain('Beach House');
  });

  it('keeps the exact final Dashboard structure while individual values and rows load', () => {
    const markup = renderToStaticMarkup(<DashboardView state="pending" />);
    const shellOpeningTag = markup.match(/^<main[^>]*>/)?.[0] ?? '';

    expect(markup).toContain('data-portal-page-shell="dashboard"');
    expect(markup).toContain('data-portal-page-shell-ready="true"');
    expect(shellOpeningTag).not.toContain('aria-busy');
    expect(markup).toContain('data-dashboard-state="pending"');
    expect(markup).toContain('Quick actions');
    expect(markup).toContain('New project');
    expect(markup).toContain('Calculator');
    expect(markup).toContain('Schedule');
    expect(markup).toContain('aria-label="Project portfolio"');
    expect(markup).toContain('aria-label="Work Queue"');
    expect(markup).toContain('aria-label="Recent Activity"');
    expect(markup).toContain('aria-label="Recent Estimates"');
    expect(markup).toContain('aria-label="My Tasks"');
    expect(markup).toContain('data-portal-shell-region="dashboard-hero"');
    expect(markup).toContain('data-portal-shell-region="dashboard-portfolio"');
    expect(markup).toContain('data-portal-shell-region="dashboard-work-queue"');
    expect(markup).toContain('data-portal-shell-region="dashboard-recent-activity"');
    expect(markup).toContain('data-portal-shell-region="dashboard-recent-estimates"');
    expect(markup).toContain('data-portal-shell-region="dashboard-tasks"');
    expect(markup).toContain('data-project-state-counts="loading"');
    expect(markup).toContain('data-dashboard-loading-rows="true"');
    expect(markup).toContain('Updating dashboard values...');
    expect(markup).not.toContain('The latest pipeline, Project Work, estimates, activity, and personal tasks will appear here shortly.');
  });
});
