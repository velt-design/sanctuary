import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardView from './DashboardView';
import type { DashboardData } from '@/lib/dashboard/types';

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('./_components/DashboardTasksCard.client', () => ({
  default: (props: { initialTasks: Array<{ title: string; completedAt?: string | null }> }) => (
    <section aria-label="My Tasks">
      <h2>My Tasks</h2>
      {props.initialTasks.map((task) => (
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
    actionsDue: 4,
    newLeads: 2,
    quotesToSend: 1,
    installsThisWeek: 3,
  },
  attention: [
    {
      key: 'overdue',
      label: 'Project actions overdue',
      count: 4,
      href: '/staff/projects?nextActionDue=true&due=overdue',
      tone: 'urgent',
    },
    {
      key: 'projects_in_quoting',
      label: 'Projects in quoting',
      count: 1,
      href: '/staff/projects?status=QUOTING',
      tone: 'neutral',
    },
  ],
  workQueue: [
    {
      projectId: 'proj_123',
      projectName: 'Beach House',
      clientName: 'Alex',
      status: 'NEW',
      nextActionLabel: null,
      nextActionDueDate: '2026-04-03',
      lastActivityAt: '2026-04-02T10:00:00.000Z',
    },
  ],
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
    const markup = renderToStaticMarkup(<DashboardView data={data} queueMode="today" />);

    expect(markup).toContain('Dashboard');
    expect(markup).toContain('Welcome back');
    expect(markup).toContain('Quick actions');
    expect(markup).toContain('Pipeline');
    expect(markup).toContain('Attention Today');
    expect(markup).toContain('Recent Estimates');
    expect(markup).toContain('Project Action Queue');
    expect(markup).toContain('Recent Activity');
    expect(markup).toContain('Beach House');
    expect(markup).toContain('Project note');
    expect(markup).toContain('Client prefers a darker roof finish.');
    expect(markup).toContain('My Tasks');
    expect(markup).toContain('Call supplier');
  });

  it('renders recent activity with category, project, note, and author hierarchy', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} queueMode="today" />);

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
    const markup = renderToStaticMarkup(<DashboardView data={data} queueMode="today" />);

    const pipelineIndex = markup.indexOf('Pipeline');
    const attentionIndex = markup.indexOf('Attention Today');
    const activityIndex = markup.indexOf('Recent Activity');
    const queueIndex = markup.indexOf('Project Action Queue');
    const estimatesIndex = markup.indexOf('Recent Estimates');
    const tasksIndex = markup.indexOf('My Tasks');

    expect(pipelineIndex).toBeGreaterThan(-1);
    expect(attentionIndex).toBeGreaterThan(-1);
    expect(estimatesIndex).toBeGreaterThan(-1);
    expect(queueIndex).toBeGreaterThan(-1);
    expect(activityIndex).toBeGreaterThan(-1);
    expect(tasksIndex).toBeGreaterThan(-1);
    expect(pipelineIndex).toBeLessThan(attentionIndex);
    expect(attentionIndex).toBeLessThan(activityIndex);
    expect(activityIndex).toBeLessThan(queueIndex);
    expect(queueIndex).toBeLessThan(estimatesIndex);
    expect(estimatesIndex).toBeLessThan(tasksIndex);
  });

  it('does not render retired exceptions, installs, or misleading quote labels', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} queueMode="today" />);

    expect(markup).not.toContain('Project Exceptions');
    expect(markup).not.toContain('Installs this week');
    expect(markup).not.toContain('Upcoming Installs');
    expect(markup).not.toContain('Quotes to send');
    expect(markup).not.toContain('New Leads');
    expect(markup).toContain('Projects in quoting');
  });

  it('marks cached data as updating without hiding it', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} queueMode="today" state="cached" />);

    expect(markup).toContain('data-dashboard-state="cached"');
    expect(markup).toContain('data-dashboard-background-ready="false"');
    expect(markup).toContain('Updating...');
    expect(markup).toContain('Beach House');
  });

  it('keeps known data and offers Retry after a refresh failure', () => {
    const markup = renderToStaticMarkup(
      <DashboardView data={data} queueMode="today" state="refresh-failed" onRetry={() => undefined} />,
    );

    expect(markup).toContain('data-dashboard-state="refresh-failed"');
    expect(markup).toContain('Showing the last saved information');
    expect(markup).toContain('Retry');
    expect(markup).toContain('Beach House');
  });
});
