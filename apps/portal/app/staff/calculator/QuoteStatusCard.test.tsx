import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import QuoteStatusCard from './QuoteStatusCard';
import type { CalculatorReadinessSummary } from './calculatorReadinessSummary';

const readySummary: CalculatorReadinessSummary = {
  tone: 'ready',
  label: 'Ready to save',
  accessibleLabel: 'Ready to save',
  rootCauseCount: 0,
  blockedCheckCount: 0,
  reviewCount: 0,
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('QuoteStatusCard', () => {
  it('keeps every readiness row while separating causes from blocked checks', () => {
    const onAction = vi.fn();
    renderIntoDocument(
      <QuoteStatusCard
        readinessSummary={{
          tone: 'blocked',
          label: '1 input issue blocks Save',
          accessibleLabel: '1 input issue blocks Save. 2 readiness checks blocked.',
          rootCauseCount: 1,
          blockedCheckCount: 2,
          reviewCount: 0,
        }}
        items={[
          {
            id: 'inputs',
            label: 'Inputs valid',
            level: 'block',
            detail: '1 input issue to fix',
            actionLabel: 'View errors',
            onAction,
            causeCount: 1,
          },
          {
            id: 'engine',
            label: 'Engine ready',
            level: 'block',
            detail: 'Fix inputs to refresh result',
            blockedBy: 'inputs',
            causeCount: 0,
          },
        ]}
      />,
    );

    expect(document.querySelectorAll('[data-status-item]')).toHaveLength(2);
    expect(document.body.textContent).toContain('1 input issue blocks Save');
    expect(document.body.textContent).toContain('2 readiness checks blocked');
    expect(document.body.textContent).toContain('Blocked by input issues');
    expect(document.body.textContent).toContain('Fix inputs to refresh result');

    act(() => {
      document.querySelector<HTMLButtonElement>('button')?.click();
    });
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('uses singular blocked-check grammar', () => {
    renderIntoDocument(
      <QuoteStatusCard
        readinessSummary={{
          tone: 'waiting',
          label: 'Updating - Save waits for a current result',
          accessibleLabel:
            'Updating - Save waits for a current result. 1 readiness check blocked.',
          rootCauseCount: 0,
          blockedCheckCount: 1,
          reviewCount: 0,
        }}
        items={[
          {
            id: 'engine',
            label: 'Engine ready',
            level: 'block',
            detail: 'Updating...',
            causeCount: 0,
          },
        ]}
      />,
    );

    expect(document.body.textContent).toContain('1 readiness check blocked');
    expect(document.body.textContent).toContain('Waiting for a current result');
  });

  it('reports review and ready states without dropping their rows', () => {
    const rendered = renderIntoDocument(
      <QuoteStatusCard
        readinessSummary={{
          ...readySummary,
          tone: 'review',
          label: '1 item to review',
          accessibleLabel: '1 item to review',
          reviewCount: 1,
        }}
        items={[{ id: 'contact', label: 'Project contact', level: 'review' }]}
      />,
    );
    expect(document.body.textContent).toContain('1 to review');
    expect(document.body.textContent).toContain('Project contact');

    act(() => {
      rendered.rerender(
        <QuoteStatusCard
          readinessSummary={readySummary}
          items={[{ id: 'ready', label: 'Engine ready', level: 'ok' }]}
        />,
      );
    });
    expect(document.body.textContent).toContain('Ready to save');
    expect(document.body.textContent).toContain('Engine ready');
  });
});
