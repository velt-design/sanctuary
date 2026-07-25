import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EmailPreviewWorkbenchFixturePage from './page';

const notFoundMock = vi.fn();
const originalFixtureFlag = process.env.ENABLE_PORTAL_QA_FIXTURES;

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

vi.mock('@/app/staff/email-previews/EmailPreviewWorkbenchPage', () => ({
  default: () => (
    <main data-email-preview-workbench="true">Enquiry email workbench</main>
  ),
}));

describe('EmailPreviewWorkbenchFixturePage', () => {
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
    expect(() => EmailPreviewWorkbenchFixturePage()).toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it('renders the data-free workbench mirror when enabled', () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';
    expect(
      renderToStaticMarkup(EmailPreviewWorkbenchFixturePage()),
    ).toContain('data-email-preview-workbench="true"');
  });
});
