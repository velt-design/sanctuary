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

  it('traps tab focus and restores the invoking control', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const rendered = renderIntoDocument(
      <Modal open onClose={() => undefined} ariaLabel="Focus modal"><button type="button">First</button><button type="button">Last</button></Modal>,
    );
    await act(async () => vi.runAllTimers());
    const buttons = document.body.querySelectorAll('[data-modal-panel] button');
    expect(document.activeElement).toBe(buttons[0]);
    (buttons[1] as HTMLElement).focus();
    dispatchKeyboard(window, 'Tab');
    expect(document.activeElement).toBe(buttons[0]);
    rendered.rerender(<Modal open={false} onClose={() => undefined} ariaLabel="Focus modal">{null}</Modal>);
    expect(document.activeElement).toBe(trigger);
    rendered.unmount();
  });
});
