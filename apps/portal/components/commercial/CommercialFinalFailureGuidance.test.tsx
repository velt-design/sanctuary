import { afterEach, describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import CommercialFinalFailureGuidance from './CommercialFinalFailureGuidance';

describe('CommercialFinalFailureGuidance', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['quote', 'Q-18', 'the prepared time above', 'DELIVERY_NEEDS_ATTENTION', 'replacement send'],
    ['invoice', 'INV-18', 'the last-attempt time', null, 'replacement delivery'],
  ] as const)('gives a safe, actionable final-failure path for a %s', (
    artifact,
    reference,
    evidence,
    errorReference,
    replacementAction,
  ) => {
    const rendered = renderIntoDocument(
      <CommercialFinalFailureGuidance
        artifact={artifact}
        reference={reference}
        evidence={evidence}
        errorReference={errorReference}
      />,
    );

    expect(rendered.container.textContent).toContain('Staff action required.');
    expect(rendered.container.textContent).toContain('cannot be retried safely');
    expect(rendered.container.textContent).toContain(replacementAction);
    expect(rendered.container.textContent).toContain(`${artifact} ${reference}`);
    expect(rendered.container.textContent).toContain(evidence);
    expect(rendered.container.textContent).toContain(`refresh this ${artifact}`);
    expect(rendered.container.querySelector('[role="alert"]')).not.toBeNull();
    rendered.unmount();
  });
});
