import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Modal from './Modal';
import { dispatchKeyboard, dispatchPointer, renderIntoDocument } from '../../../../../test/reactHarness';

describe('Modal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('focuses the dialog and closes on escape', async () => {
    const onClose = vi.fn();

    renderIntoDocument(
      <Modal open onClose={onClose} ariaLabel="Test modal">
        <div>Body</div>
      </Modal>,
    );

    await act(async () => {
      vi.runAllTimers();
    });

    const dialog = document.body.querySelector('[role="dialog"]') as HTMLDivElement | null;
    expect(dialog).not.toBeNull();
    expect(document.activeElement).toBe(dialog);

    dispatchKeyboard(window, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked', () => {
    const onClose = vi.fn();

    renderIntoDocument(
      <Modal open onClose={onClose} ariaLabel="Backdrop modal">
        <div>Body</div>
      </Modal>,
    );

    const dialog = document.body.querySelector('[role="dialog"]') as HTMLDivElement;
    const overlay = dialog.parentElement as HTMLDivElement;

    dispatchPointer(overlay, 'mousedown');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
