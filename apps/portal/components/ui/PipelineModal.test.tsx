import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PipelineModal } from './PipelineModal';
import { renderIntoDocument } from '../../../../test/reactHarness';

describe('PipelineModal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders title, description, actions, and the back affordance', () => {
    const onOpenChange = vi.fn();
    const onBack = vi.fn();

    renderIntoDocument(
      <PipelineModal
        open
        onOpenChange={onOpenChange}
        title="Stage complete"
        description="Review the follow-up actions."
        onBack={onBack}
        actions={<button type="button">Confirm</button>}
      >
        <div>Pipeline content</div>
      </PipelineModal>,
    );

    expect(document.body.textContent).toContain('Stage complete');
    expect(document.body.textContent).toContain('Review the follow-up actions.');
    expect(document.body.textContent).toContain('Pipeline content');
    expect(document.body.textContent).toContain('Confirm');

    const backButton = document.body.querySelector('button[aria-label="Back"]') as HTMLButtonElement;
    const closeButton = document.body.querySelector('button[aria-label="Close"]') as HTMLButtonElement;

    act(() => {
      backButton.click();
      closeButton.click();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
