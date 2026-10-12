import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchKeyboard, dispatchPointer, renderIntoDocument } from '../../../../../test/reactHarness';
import { OverflowMenu } from './OverflowMenu';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} };
}

describe('Foundation overflow menu in a scrollable table', () => {
  it('escapes the clipping owner, preserves semantics and keyboard selection, and returns focus', async () => {
    const nativeFocus = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement) {
      // JSDOM otherwise allows focusing hidden nodes, unlike the browser.
      if (this.closest<HTMLElement>('[role="menu"]')?.style.visibility === 'hidden') return;
      nativeFocus.call(this);
    });
    const select = vi.fn();
    const rendered = renderIntoDocument(<div style={{ overflow: 'auto', height: 50 }}>
      <OverflowMenu label="Invoice actions" menuLabel="INV-CT0001" items={[
        { label: 'Unavailable', disabled: true }, { label: 'Restore invoice', onSelect: select, separatorBefore: true },
      ]} />
    </div>);
    const trigger = rendered.container.querySelector('button')!;
    select.mockImplementation(() => {
      // A dialog opened by the action captures this as its return-focus target.
      expect(document.activeElement).toBe(trigger);
    });
    dispatchKeyboard(trigger, 'ArrowDown');
    const menu = document.body.querySelector('[role="menu"]')!;
    expect(menu.parentElement).toBe(document.body);
    expect(rendered.container.contains(menu)).toBe(false);
    expect(menu.getAttribute('aria-label')).toBe('INV-CT0001');
    expect(menu.querySelector('[role="separator"]')).not.toBeNull();
    const action = menu.querySelectorAll('button')[1];
    expect(document.activeElement).toBe(action);
    await act(async () => { action.click(); await Promise.resolve(); });
    expect(select).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    act(() => trigger.click());
    dispatchPointer(document.body, 'pointerdown');
    await act(async () => Promise.resolve());
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    rendered.unmount();
  });

  it('flips above the lower edge, clamps horizontally and follows table scroll and resize', () => {
    let anchor = rect(window.innerWidth - 10, window.innerHeight - 35, 30, 30);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('role') === 'menu' ? rect(0, 0, 208, 180) : anchor;
    });
    const rendered = renderIntoDocument(<div data-scroll="table" style={{ overflow: 'auto' }}><OverflowMenu visibleLabel label="Actions" items={[{ label: 'Open invoice' }]} /></div>);
    act(() => rendered.container.querySelector('button')!.click());
    const menu = document.body.querySelector<HTMLElement>('[role="menu"]')!;
    expect(menu.style.top).toBe(`${anchor.top - 8 - 180}px`);
    expect(menu.style.left).toBe(`${window.innerWidth - 208 - 8}px`);
    anchor = rect(1, 20, 30, 30);
    act(() => rendered.container.querySelector('[data-scroll]')!.dispatchEvent(new Event('scroll')));
    expect(menu.style.left).toBe('8px');
    expect(menu.style.top).toBe('58px');
    anchor = rect(200, 100, 30, 30);
    act(() => window.dispatchEvent(new Event('resize')));
    expect(menu.style.left).toBe('22px');
    expect(menu.style.top).toBe('138px');
    dispatchKeyboard(document, 'Escape');
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    rendered.unmount();
  });
});
