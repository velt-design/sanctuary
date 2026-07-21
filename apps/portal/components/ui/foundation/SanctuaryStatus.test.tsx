import { afterEach, describe, expect, it } from 'vitest';
import { EstimateStatusBadge, ProjectStageBadge, ProjectStageTracker, QuoteStatusBadge } from './SanctuaryStatus';
import type { QuoteStatus } from '@/lib/quotes/types';
import type { EstimateStatus } from '@/lib/estimates/types';
import { renderIntoDocument } from '../../../../../test/reactHarness';

describe('Sanctuary status components', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('uses the canonical nine-stage workflow and marks current progress', () => {
    const rendered = renderIntoDocument(
      <div>
        <ProjectStageBadge stage="site_visit" />
        <ProjectStageTracker currentStage="quoting" />
      </div>,
    );

    expect(rendered.container.querySelector('[data-stage="site_visit"]')?.textContent).toContain('Site Visit');
    const stages = rendered.container.querySelectorAll('ol li');
    expect(stages).toHaveLength(9);
    expect(rendered.container.querySelector('li[aria-current="step"]')?.textContent).toContain('Quoting');
    expect(rendered.container.querySelectorAll('li[data-state="completed"]')).toHaveLength(3);

    rendered.unmount();
  });

  it('renders quote and estimate presentation statuses with context', () => {
    const quoteStatuses: QuoteStatus[] = ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED'];
    const estimateStatuses: EstimateStatus[] = ['draft', 'archived'];
    const rendered = renderIntoDocument(
      <div>
        {quoteStatuses.map((status) => <QuoteStatusBadge key={status} status={status} />)}
        {estimateStatuses.map((status) => <EstimateStatusBadge key={status} status={status} />)}
      </div>,
    );

    expect(rendered.container.textContent).toContain('Accepted');
    expect(rendered.container.textContent).toContain('Declined');
    expect(rendered.container.textContent).toContain('Sent');
    expect(rendered.container.textContent).toContain('Historical');

    rendered.unmount();
  });
});
