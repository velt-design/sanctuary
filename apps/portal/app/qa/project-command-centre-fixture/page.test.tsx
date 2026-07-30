import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectCommandCentreFixturePage from './page';

const notFoundMock = vi.fn();
const originalFixtureFlag = process.env.ENABLE_PORTAL_QA_FIXTURES;

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

vi.mock('./ProjectCommandCentreFixtureClient', () => ({
  default: ({
    currentDesign,
  }: {
    currentDesign: { warnings: string[] };
  }) => <section>{JSON.stringify(currentDesign.warnings)}</section>,
}));

vi.mock('../projects-index-mutation-fixture/FixtureLocalFirstBoundary', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

describe('ProjectCommandCentreFixturePage', () => {
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

  it('returns not found unless portal QA fixtures are explicitly enabled', async () => {
    await expect(ProjectCommandCentreFixturePage({ searchParams: Promise.resolve({}) }))
      .rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it('renders deterministic source and price failure scenarios without customer data', async () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';
    const sourceUi = await ProjectCommandCentreFixturePage({
      searchParams: Promise.resolve({ scenario: 'missing-source' }),
    }) as ReactElement;
    const sourceMarkup = renderToStaticMarkup(sourceUi);
    expect(sourceMarkup).toContain('data-portal-qa-fixture="project-command-centre"');
    expect(sourceMarkup).toContain('data-fixture-scenario="missing-source"');
    expect(sourceMarkup).toContain('source_design_unavailable');

    const priceUi = await ProjectCommandCentreFixturePage({
      searchParams: Promise.resolve({ scenario: 'missing-price' }),
    }) as ReactElement;
    expect(renderToStaticMarkup(priceUi)).toContain('quote_price_unavailable');
  });
});
