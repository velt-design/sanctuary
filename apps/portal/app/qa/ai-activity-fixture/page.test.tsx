import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AiActivityFixturePage from './page';

const notFoundMock = vi.fn();
const originalFixtureFlag = process.env.ENABLE_PORTAL_QA_FIXTURES;

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

vi.mock('@/components/ai/AiActivityView', () => ({
  default: () => <main data-ai-activity-view="true">AI Activity</main>,
}));

describe('AiActivityFixturePage', () => {
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
    expect(() => AiActivityFixturePage()).toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it('renders the synthetic production view when enabled', () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';
    const html = renderToStaticMarkup(AiActivityFixturePage());
    expect(html).toContain('data-portal-qa-fixture="ai-activity"');
    expect(html).toContain('data-ai-activity-view="true"');
  });
});
