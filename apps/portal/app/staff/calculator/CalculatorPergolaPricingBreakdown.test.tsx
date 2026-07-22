import { describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorPergolaPricingBreakdown from './CalculatorPergolaPricingBreakdown';

describe('CalculatorPergolaPricingBreakdown', () => {
  it('shows named pergola costs, discounted customer prices, and shared site costs', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPergolaPricingBreakdown
        quoteDiscountPct="10"
        result={{
          pergolas: [
            { id: 'p1', label: 'Front patio', module_count: 2, totals: { cost_ex_gst: 100 } },
            { id: 'p2', label: 'Pool cover', module_count: 1, totals: { cost_ex_gst: 200 } },
          ],
          shared: { totals: { cost_ex_gst: 40 } },
        } as any}
      />,
    );

    expect(container.textContent).toContain('Front patio2$100$129');
    expect(container.textContent).toContain('Pool cover1$200$259');
    expect(container.textContent).toContain('Shared site costs—$40$52');
    expect(container.textContent).toContain('after 10% discount');
    unmount();
  });
});
