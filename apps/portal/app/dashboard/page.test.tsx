import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardPage from './page';

vi.mock('./DashboardClient', () => ({
  default: (props: { queueMode: string }) => (
    <main data-testid="dashboard-client" data-queue-mode={props.queueMode}>
      <h1>Dashboard</h1>
    </main>
  ),
}));

describe('DashboardPage', () => {
  it('renders the client-owned frame without waiting for a server data read', async () => {
    const ui = (await DashboardPage({
      searchParams: Promise.resolve({ queue: 'next7' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-testid="dashboard-client"');
    expect(markup).toContain('data-queue-mode="next7"');
    expect(markup).toContain('Dashboard');
  });

  it('defaults invalid queue values to today', async () => {
    const ui = (await DashboardPage({
      searchParams: Promise.resolve({ queue: 'not-real' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('data-queue-mode="today"');
  });
});
