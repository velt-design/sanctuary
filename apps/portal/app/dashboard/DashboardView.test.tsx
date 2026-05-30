import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardView from './DashboardView';
import type { DashboardData } from '@/lib/dashboard/types';

vi.mock('./_components/DashboardTasksCard.client', () => ({
  default: (props: { initialTasks: Array<{ title: string; completedAt?: string | null }> }) => (
    <section aria-label="Tasks">
      <h2>Tasks</h2>
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
  attention: [],
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
  it('renders pipeline, kpis, recent activity, and personal tasks', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} />);

    expect(markup).toContain('Dashboard');
    expect(markup).toContain('Pipeline');
    expect(markup).toContain('Actions due');
    expect(markup).toContain('Recent Activity');
    expect(markup).toContain('Beach House');
    expect(markup).toContain('Project note');
    expect(markup).toContain('Client prefers a darker roof finish.');
    expect(markup).toContain('Tasks');
    expect(markup).toContain('Call supplier');
  });

  it('renders recent activity as project-first note cards', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} />);

    const projectIndex = markup.indexOf('Beach House');
    const noteIndex = markup.indexOf('Client prefers a darker roof finish.');
    const labelIndex = markup.indexOf('Project note');

    expect(projectIndex).toBeGreaterThan(-1);
    expect(noteIndex).toBeGreaterThan(-1);
    expect(labelIndex).toBeGreaterThan(-1);
    expect(projectIndex).toBeLessThan(noteIndex);
  });

  it('prioritizes pipeline before kpis and activity before tasks', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} />);

    const pipelineIndex = markup.indexOf('Pipeline');
    const kpiIndex = markup.indexOf('Actions due');
    const activityIndex = markup.indexOf('Recent Activity');
    const tasksIndex = markup.indexOf('Tasks');

    expect(pipelineIndex).toBeGreaterThan(-1);
    expect(kpiIndex).toBeGreaterThan(-1);
    expect(activityIndex).toBeGreaterThan(-1);
    expect(tasksIndex).toBeGreaterThan(-1);
    expect(pipelineIndex).toBeLessThan(kpiIndex);
    expect(activityIndex).toBeLessThan(tasksIndex);
  });

  it('does not render the retired operational dashboard sections', () => {
    const markup = renderToStaticMarkup(<DashboardView data={data} />);

    expect(markup).not.toContain('Attention');
    expect(markup).not.toContain('Work Queue');
    expect(markup).not.toContain('Install schedule');
    expect(markup).not.toContain('Site visits');
  });
});
