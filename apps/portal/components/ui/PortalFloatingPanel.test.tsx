import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchKeyboard, dispatchPointer, renderIntoDocument } from '../../../../test/reactHarness';
import { PortalMenu, PortalPopover } from './PortalFloatingPanel';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('PortalMenu', () => {
  it('portals the menu, skips disabled actions, selects an item, and returns focus', async () => {
    const onFirst = vi.fn();
    const onLast = vi.fn();
    const rendered = renderIntoDocument(
      <PortalMenu
        label="Example actions"
        trigger="Actions"
        items={[
          { id: 'first', label: 'First action', onSelect: onFirst },
          { id: 'disabled', label: 'Disabled action', onSelect: vi.fn(), disabled: true },
          { id: 'last', label: 'Last action', onSelect: onLast, separatorBefore: true },
        ]}
      />,
    );
    const trigger = rendered.container.querySelector('button') as HTMLButtonElement;

    act(() => trigger.click());

    const menu = document.body.querySelector('[role="menu"]') as HTMLDivElement;
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    expect(menu.parentElement).toBe(document.body);
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(items[0]);
    expect(items[1].disabled).toBe(true);
    expect(menu.querySelectorAll('[role="separator"]')).toHaveLength(1);

    dispatchKeyboard(menu, 'ArrowDown');
    expect(document.activeElement).toBe(items[2]);
    dispatchKeyboard(menu, 'Home');
    expect(document.activeElement).toBe(items[0]);
    dispatchKeyboard(menu, 'End');
    expect(document.activeElement).toBe(items[2]);

    await act(async () => {
      items[2].click();
      await Promise.resolve();
    });
    expect(onFirst).not.toHaveBeenCalled();
    expect(onLast).toHaveBeenCalledOnce();
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    rendered.unmount();
  });

  it('closes on Escape and outside pointer interaction', async () => {
    const rendered = renderIntoDocument(
      <PortalMenu
        label="Example actions"
        trigger="Actions"
        items={[{ id: 'first', label: 'First action', onSelect: vi.fn() }]}
      />,
    );
    const trigger = rendered.container.querySelector('button') as HTMLButtonElement;

    act(() => trigger.click());
    dispatchKeyboard(document, 'Escape');
    await act(async () => Promise.resolve());
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    act(() => trigger.click());
    dispatchPointer(document.body, 'pointerdown');
    await act(async () => Promise.resolve());
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    rendered.unmount();
  });

  it('opens from either arrow direction and supports item typeahead', () => {
    const rendered = renderIntoDocument(
      <PortalMenu
        label="Example actions"
        trigger="Actions"
        items={[
          { id: 'alpha', label: 'Alpha action', onSelect: vi.fn() },
          { id: 'beta', label: 'Beta action', onSelect: vi.fn() },
        ]}
      />,
    );
    const trigger = rendered.container.querySelector('button') as HTMLButtonElement;

    dispatchKeyboard(trigger, 'ArrowUp');
    let items = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    expect(document.activeElement).toBe(items[1]);

    dispatchKeyboard(document, 'Escape');
    dispatchKeyboard(trigger, 'ArrowDown');
    items = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    expect(document.activeElement).toBe(items[0]);

    dispatchKeyboard(document.body.querySelector('[role="menu"]') as HTMLDivElement, 'b');
    expect(document.activeElement).toBe(items[1]);
    rendered.unmount();
  });
});

describe('PortalPopover', () => {
  it('uses dialog semantics for interactive controls and returns focus on Escape', async () => {
    const rendered = renderIntoDocument(
      <PortalPopover label="User settings" trigger="Open settings" triggerAriaLabel="User menu">
        <label>
          Preset
          <select defaultValue="default">
            <option value="default">Default</option>
          </select>
        </label>
        <button type="button">Save</button>
      </PortalPopover>,
    );
    const trigger = rendered.container.querySelector('button') as HTMLButtonElement;

    act(() => trigger.click());

    const dialog = document.body.querySelector('[role="dialog"]') as HTMLDivElement;
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('User settings');
    expect(dialog.querySelector('[role="menuitem"]')).toBeNull();
    expect(dialog.contains(document.activeElement)).toBe(true);

    dispatchKeyboard(document, 'Escape');
    await act(async () => Promise.resolve());
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    rendered.unmount();
  });
});
