import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import InfillConfiguratorDialog from './InfillConfiguratorDialog';

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

function buttonNamed(name: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === name);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${name}`);
  return button;
}

describe('InfillConfiguratorDialog', () => {
  it('locks progression until the opening is complete and exposes the active step', () => {
    const onStageChange = vi.fn();
    const common = {
      closeOnEsc: true,
      rail: <aside>Infill selector</aside>,
      editorHeader: null,
      blockerCount: 0,
      onStageChange,
      onClose: vi.fn(),
      children: <p>Opening fields</p>,
    };
    const { rerender, unmount } = renderIntoDocument(
      <InfillConfiguratorDialog {...common} stage="opening" openingComplete={false} />,
    );

    expect(buttonNamed('1Opening').getAttribute('aria-current')).toBe('step');
    expect(buttonNamed('2Existing supports').disabled).toBe(true);
    expect(buttonNamed('Continue').disabled).toBe(true);

    rerender(<InfillConfiguratorDialog {...common} stage="opening" openingComplete />);
    expect(buttonNamed('Continue').disabled).toBe(false);
    act(() => buttonNamed('Continue').click());
    expect(onStageChange).toHaveBeenCalledWith('supports');

    unmount();
  });
});
