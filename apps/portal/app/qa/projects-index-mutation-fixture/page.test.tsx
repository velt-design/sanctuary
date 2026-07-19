import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectsIndexMutationFixturePage from './page';

const notFoundMock = vi.fn();
const originalFixtureFlag = process.env.ENABLE_PORTAL_QA_FIXTURES;

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

vi.mock('./ProjectsIndexMutationFixtureClient', () => ({
  default: () => <div data-project-mutation-fixture="ready">Mutation fixture</div>,
}));

vi.mock('./ProjectDetailsMutationFixtureClient', () => ({
  default: () => <div data-project-details-mutation-fixture="ready">Detail mutation fixture</div>,
}));

vi.mock('./ContactDetailsMutationFixtureClient', () => ({
  default: () => <div data-contact-details-mutation-fixture="ready">Contact mutation fixture</div>,
}));

vi.mock('./FixtureLocalFirstBoundary', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('./ProjectTaskMutationFixtureClient', () => ({
  default: () => <div data-project-task-mutation-fixture="ready">Task mutation fixture</div>,
}));

describe('ProjectsIndexMutationFixturePage', () => {
  beforeEach(() => {
    delete process.env.ENABLE_PORTAL_QA_FIXTURES;
    notFoundMock.mockReset();
    notFoundMock.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
  });

  afterEach(() => {
    if (originalFixtureFlag === undefined) {
      delete process.env.ENABLE_PORTAL_QA_FIXTURES;
    } else {
      process.env.ENABLE_PORTAL_QA_FIXTURES = originalFixtureFlag;
    }
  });

  it('returns not found unless portal QA fixtures are explicitly enabled', () => {
    expect(() => ProjectsIndexMutationFixturePage()).toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('renders only sample mutation data when the fixture flag is enabled', () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';

    const ui = ProjectsIndexMutationFixturePage() as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-portal-qa-fixture="projects-index-mutation"');
    expect(markup).toContain('data-project-mutation-fixture="ready"');
    expect(markup).toContain('data-project-details-mutation-fixture="ready"');
    expect(markup).toContain('data-contact-details-mutation-fixture="ready"');
    expect(markup).toContain('data-project-task-mutation-fixture="ready"');
  });
});
