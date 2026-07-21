import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ProjectExceptionsCard from './ProjectExceptionsCard';

describe('ProjectExceptionsCard', () => {
  it('uses the server total when the returned project list is capped', () => {
    const projects = Array.from({ length: 50 }, (_, index) => ({
      projectId: `proj-${index}`,
      projectName: `Project ${index}`,
      stage: 'new',
      reasons: ['no_action' as const],
      href: `/staff/projects/proj-${index}`,
    }));
    const markup = renderToStaticMarkup(
      <ProjectExceptionsCard
        data={{
          counts: { selection_conflict: 0, no_action: 946, missing_owner: 0 },
          projects,
          totalProjects: 946,
          generatedAt: '2026-07-21T00:00:00.000Z',
        }}
        pending={false}
        failed={false}
      />,
    );

    expect(markup).toContain('+940 more projects');
    expect(markup).not.toContain('+44 more projects');
  });
});
