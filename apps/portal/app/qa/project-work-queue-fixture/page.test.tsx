import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectWorkQueueFixturePage from './page';

const notFoundMock = vi.fn();
const originalFixtureFlag = process.env.ENABLE_PORTAL_QA_FIXTURES;

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

vi.mock('@/components/projects/workQueue/ProjectWorkQueueList', () => ({
  default: ({ entries }: { entries: unknown[] }) => (
    <div data-work-queue-list="true">{entries.length} projects</div>
  ),
}));

describe('ProjectWorkQueueFixturePage', () => {
  beforeEach(() => {
    delete process.env.ENABLE_PORTAL_QA_FIXTURES;
    notFoundMock.mockReset();
    notFoundMock.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
  });

  afterEach(() => {
    if (originalFixtureFlag === undefined) delete process.env.ENABLE_PORTAL_QA_FIXTURES;
    else process.env.ENABLE_PORTAL_QA_FIXTURES = originalFixtureFlag;
  });

  it('returns not found unless portal QA fixtures are explicitly enabled', () => {
    expect(() => ProjectWorkQueueFixturePage()).toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it('renders five synthetic queue groups without loading durable records', () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';

    const html = renderToStaticMarkup(ProjectWorkQueueFixturePage());

    expect(html).toContain('data-portal-qa-fixture="project-work-queue"');
    expect(html).toContain('5 projects');
    expect(html).toContain('Synthetic data only');
  });
});
