import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import type { ProjectCommandCentreCurrentDesign } from '@/lib/projects/commandCentre/types';
import ProjectCurrentDesignCommercialCard from './ProjectCurrentDesignCommercialCard';

function base(overrides: Partial<ProjectCommandCentreCurrentDesign> = {}): ProjectCommandCentreCurrentDesign {
  return {
    source: 'estimate',
    statusLabel: 'Estimate current',
    statusTone: 'neutral',
    designState: 'available',
    design: { size: '6m x 4m', shape: 'Gable', roofing: 'Acrylic', additionalModuleCount: 0 },
    price: { source: 'estimate', totalIncGstCents: 123_456 },
    estimate: {
      id: 'est_1',
      versionLabel: 'V1',
      savedAt: '2026-07-01T00:00:00.000Z',
      isActiveDraft: true,
      isLocked: false,
      isQuoteSource: false,
      costingState: 'current',
    },
    quote: null,
    newerEstimate: null,
    latestDeclinedQuote: null,
    warnings: [],
    links: { designs: '?tab=estimates', quotes: '?tab=quotes', estimate: '?tab=estimates&estimateId=est_1', quote: null },
    ...overrides,
  };
}

describe('ProjectCurrentDesignCommercialCard', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders stored design and commercial facts without action controls', () => {
    const rendered = renderIntoDocument(<ProjectCurrentDesignCommercialCard data={base()} />);
    expect(rendered.container.textContent).toContain('6m x 4m');
    expect(rendered.container.textContent).toContain('Gable · Acrylic');
    expect(rendered.container.textContent).toContain('$1,234.56 inc GST');
    expect(rendered.container.textContent).toContain('Quote-ready estimate total');
    expect(rendered.container.textContent).toContain('Current costing');
    expect(rendered.container.querySelectorAll('button')).toHaveLength(0);
    expect(
      rendered.container
        .querySelector('a[href="/staff/design-booklets"]')
        ?.textContent,
    ).toBe('Open booklet workbench');
    rendered.unmount();
  });

  it('explains when an estimate customer price is unavailable', () => {
    const rendered = renderIntoDocument(<ProjectCurrentDesignCommercialCard data={base({
      price: { source: 'estimate', totalIncGstCents: null },
      warnings: ['estimate_price_unavailable'],
    })} />);
    expect(rendered.container.textContent).toContain('Price unavailable');
    expect(rendered.container.textContent).toContain('Estimate price unavailable');
    expect(rendered.container.textContent).toContain('resolve pricing issues before relying on a customer total');
    rendered.unmount();
  });

  it('keeps exact quote price while clearly marking its source design unavailable', () => {
    const rendered = renderIntoDocument(<ProjectCurrentDesignCommercialCard
      projectId="proj_1"
      canRecordDeposit
      onDepositRecorded={vi.fn()}
      data={base({
      source: 'accepted_quote',
      statusLabel: 'Quote accepted',
      statusTone: 'accepted',
      designState: 'source_unavailable',
      design: null,
      price: { source: 'quote', totalIncGstCents: 200_000 },
      estimate: null,
      quote: {
        id: 'qv_1',
        quoteRef: 'Q-0100',
        versionNumber: 2,
        status: 'ACCEPTED',
        createdAt: '2026-07-02T00:00:00.000Z',
        sentAt: '2026-07-02T01:00:00.000Z',
        deliveryState: 'accepted',
      },
      warnings: ['source_design_unavailable'],
      links: { designs: '?tab=estimates', quotes: '?tab=quotes', estimate: null, quote: '?tab=quotes&quoteId=qv_1' },
    })}
    />);
    expect(rendered.container.textContent).toContain('Source design unavailable');
    expect(rendered.container.textContent).toContain('$2,000 inc GST');
    expect(rendered.container.textContent).toContain('no other estimate has been substituted');
    expect(rendered.container.textContent).toContain('Record deposit received');
    rendered.unmount();
  });

  it('does not substitute an estimate value for an unavailable quote price', () => {
    const rendered = renderIntoDocument(<ProjectCurrentDesignCommercialCard data={base({
      source: 'sent_quote',
      statusLabel: 'Quote sent',
      statusTone: 'sent',
      price: { source: 'quote', totalIncGstCents: null },
      quote: {
        id: 'qv_1',
        quoteRef: 'Q-0100',
        versionNumber: 1,
        status: 'SENT',
        createdAt: '2026-07-02T00:00:00.000Z',
        sentAt: '2026-07-02T01:00:00.000Z',
        deliveryState: 'sent',
      },
      warnings: ['quote_price_unavailable'],
    })} />);
    expect(rendered.container.textContent).toContain('Price unavailable');
    expect(rendered.container.textContent).toContain('No estimate price has been substituted');
    expect(rendered.container.textContent).not.toContain('$1,235');
    rendered.unmount();
  });

  it('does not claim a declined quote fell back when no estimate is eligible', () => {
    const rendered = renderIntoDocument(<ProjectCurrentDesignCommercialCard data={base({
      source: 'none',
      statusLabel: 'No current design',
      designState: 'none',
      design: null,
      price: { source: 'none', totalIncGstCents: null },
      estimate: null,
      latestDeclinedQuote: {
        quoteVersionId: 'qv_1',
        quoteRef: 'Q-0100',
        versionNumber: 1,
        createdAt: '2026-07-02T00:00:00.000Z',
      },
      links: { designs: '?tab=estimates', quotes: '?tab=quotes', estimate: null, quote: null },
    })} />);
    expect(rendered.container.textContent).toContain('No eligible estimate is current');
    expect(rendered.container.textContent).not.toContain('falls back');
    rendered.unmount();
  });
});
