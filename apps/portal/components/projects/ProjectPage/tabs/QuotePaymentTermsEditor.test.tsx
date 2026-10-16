import { describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import QuotePaymentTermsEditor from './QuotePaymentTermsEditor';

describe('saved quote payment schedule', () => {
  it('shows resolved amounts and meaningful terms without disabled form controls', () => {
    const setTerms = vi.fn();
    const rendered = renderIntoDocument(<QuotePaymentTermsEditor editable={false} quoteTotalIncGstCents={100001} setTerms={setTerms} terms={[
      { id: 'fixed', label: 'Consent', calculationType: 'fixed', fixedAmountIncGstCents: 20000, percentageOfRemainder: null, resolvedAmountIncGstCents: 20000 },
      { id: 'deposit', label: 'Deposit', calculationType: 'percentage', fixedAmountIncGstCents: null, percentageOfRemainder: 50, resolvedAmountIncGstCents: 40001 },
      { id: 'final', label: 'On completion', calculationType: 'percentage', fixedAmountIncGstCents: null, percentageOfRemainder: 50, resolvedAmountIncGstCents: 40000 },
    ]} />);
    expect(rendered.container.querySelectorAll('input, select')).toHaveLength(0);
    expect(rendered.container.textContent).toContain('Consent');
    expect(rendered.container.textContent).toContain('$200.00');
    expect(rendered.container.textContent).toContain('$400.01');
    expect(rendered.container.textContent).toContain('$400.00');
    expect(rendered.container.textContent).toContain('$1,000.01');
    expect(setTerms).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
