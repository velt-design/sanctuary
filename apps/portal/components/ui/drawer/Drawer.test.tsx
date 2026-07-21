import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Drawer } from './Drawer';
import { dispatchKeyboard, dispatchPointer, renderIntoDocument } from '../../../../../test/reactHarness';

describe('Drawer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  it('traps focus, closes on escape, and returns focus', async () => {
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const rendered = renderIntoDocument(<Drawer open onClose={onClose} title="Filters"><button type="button">First</button><button type="button">Last</button></Drawer>);
    await act(async () => vi.runAllTimers());
    const buttons = document.body.querySelectorAll('[data-drawer-panel] button');
    expect(document.activeElement).toBe(buttons[0]);
    (buttons[buttons.length - 1] as HTMLElement).focus();
    dispatchKeyboard(window, 'Tab');
    expect(document.activeElement).toBe(buttons[0]);
    dispatchKeyboard(window, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    rendered.rerender(<Drawer open={false} onClose={onClose} title="Filters">{null}</Drawer>);
    expect(document.activeElement).toBe(trigger);
    rendered.unmount();
  });

  it('closes only from the backdrop itself', () => {
    const onClose = vi.fn();
    renderIntoDocument(<Drawer open onClose={onClose} title="Filters"><span>Body</span></Drawer>);
    const overlay = document.body.querySelector('[data-drawer-overlay]') as HTMLElement;
    dispatchPointer(overlay, 'mousedown');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
