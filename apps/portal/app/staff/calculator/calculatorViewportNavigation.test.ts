import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  findCalculatorVerticalScrollOwner,
  revealAndFocusCalculatorTarget,
  scheduleCalculatorLayoutTask,
} from './calculatorViewportNavigation';

function rect(top: number, bottom: number, width = 300): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    right: width,
    bottom,
    width,
    height: bottom - top,
    toJSON: () => ({}),
  } as DOMRect;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('calculator viewport navigation', () => {
  it('finds the nearest vertical scroll owner', () => {
    const clippedAncestor = document.createElement('div');
    clippedAncestor.style.overflowY = 'hidden';
    Object.defineProperties(clippedAncestor, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 1000 },
    });
    const owner = document.createElement('div');
    owner.style.overflowY = 'auto';
    Object.defineProperties(owner, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 900 },
    });
    const target = document.createElement('input');
    owner.appendChild(target);
    clippedAncestor.appendChild(owner);
    document.body.appendChild(clippedAncestor);

    expect(findCalculatorVerticalScrollOwner(target)).toBe(owner);
  });

  it('falls back to the document scroll owner', () => {
    const target = document.createElement('input');
    document.body.appendChild(target);

    expect(findCalculatorVerticalScrollOwner(target)).toBe(
      document.scrollingElement ?? document.documentElement,
    );
  });

  it('positions the complete field tile before focusing its control', () => {
    const owner = document.createElement('div');
    owner.style.overflowY = 'auto';
    Object.defineProperties(owner, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1200 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    owner.getBoundingClientRect = () => rect(100, 500);

    const tile = document.createElement('div');
    tile.dataset.calculatorField = 'lengthM';
    tile.getBoundingClientRect = () => rect(700 - owner.scrollTop, 790 - owner.scrollTop);
    const target = document.createElement('input');
    target.id = 'lengthM';
    tile.appendChild(target);
    owner.appendChild(tile);
    document.body.appendChild(owner);
    const focus = vi.spyOn(target, 'focus');

    expect(revealAndFocusCalculatorTarget(target)).toBe(owner);
    expect(owner.scrollTop).toBeGreaterThan(0);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(tile.getBoundingClientRect().top).toBeGreaterThanOrEqual(116);
    expect(tile.getBoundingClientRect().bottom).toBeLessThanOrEqual(484);
  });

  it('accounts for contiguous sticky chrome and focuses a custom field descendant', () => {
    const mobileBar = document.createElement('div');
    mobileBar.dataset.portalMobileTopBar = '';
    mobileBar.style.position = 'fixed';
    mobileBar.getBoundingClientRect = () => rect(0, 56);
    const masthead = document.createElement('div');
    masthead.dataset.projectMastheadSlotSticky = 'true';
    masthead.style.position = 'sticky';
    masthead.getBoundingClientRect = () => rect(56, 159);
    const commandBar = document.createElement('div');
    commandBar.dataset.calculatorCommandBar = '';
    commandBar.style.position = 'sticky';
    commandBar.getBoundingClientRect = () => rect(159, 293);

    const tile = document.createElement('div');
    tile.dataset.calculatorField = 'flashings';
    tile.getBoundingClientRect = () => rect(120, 210);
    const customTarget = document.createElement('div');
    customTarget.id = 'flashings';
    const precedingSelect = document.createElement('select');
    const invalidInput = document.createElement('input');
    invalidInput.setAttribute('aria-invalid', 'true');
    customTarget.append(precedingSelect, invalidInput);
    tile.appendChild(customTarget);
    document.body.append(mobileBar, masthead, commandBar, tile);
    const precedingFocus = vi.spyOn(precedingSelect, 'focus');
    const focus = vi.spyOn(invalidInput, 'focus');

    revealAndFocusCalculatorTarget(customTarget);

    expect(precedingFocus).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.documentElement.scrollTop).toBeLessThan(0);
  });

  it('reveals the invalid row when a composite field is taller than the viewport', () => {
    const owner = document.createElement('div');
    owner.style.overflowY = 'auto';
    Object.defineProperties(owner, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1400 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    owner.getBoundingClientRect = () => rect(100, 500);

    const tile = document.createElement('div');
    tile.dataset.calculatorField = 'flashings';
    tile.getBoundingClientRect = () => rect(
      100 - owner.scrollTop,
      1100 - owner.scrollTop,
    );
    const customTarget = document.createElement('div');
    customTarget.id = 'flashings';
    const firstRowControl = document.createElement('select');
    const invalidRow = document.createElement('div');
    invalidRow.dataset.calculatorFocusRegion = '';
    invalidRow.getBoundingClientRect = () => rect(
      850 - owner.scrollTop,
      950 - owner.scrollTop,
    );
    const invalidInput = document.createElement('input');
    invalidInput.setAttribute('aria-invalid', 'true');
    invalidRow.appendChild(invalidInput);
    customTarget.append(firstRowControl, invalidRow);
    tile.appendChild(customTarget);
    owner.appendChild(tile);
    document.body.appendChild(owner);

    revealAndFocusCalculatorTarget(customTarget);

    expect(document.activeElement).toBe(invalidInput);
    expect(owner.scrollTop).toBeGreaterThan(0);
    expect(invalidRow.getBoundingClientRect().top).toBeGreaterThanOrEqual(116);
    expect(invalidRow.getBoundingClientRect().bottom).toBeLessThanOrEqual(484);
  });

  it('falls back when focus options are unsupported', () => {
    const target = document.createElement('input');
    document.body.appendChild(target);
    const focus = vi.spyOn(target, 'focus')
      .mockImplementationOnce(() => {
        throw new TypeError('focus options unsupported');
      })
      .mockImplementationOnce(() => undefined);

    revealAndFocusCalculatorTarget(target);

    expect(focus).toHaveBeenNthCalledWith(1, { preventScroll: true });
    expect(focus).toHaveBeenNthCalledWith(2);
  });

  it('waits for two layout frames and supports cancellation', () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      nextFrame += 1;
      callbacks.set(nextFrame, callback);
      return nextFrame;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frame) => {
      callbacks.delete(frame);
    });
    const task = vi.fn();

    const cancel = scheduleCalculatorLayoutTask(task);
    callbacks.get(1)?.(0);
    expect(task).not.toHaveBeenCalled();
    callbacks.get(2)?.(0);
    expect(task).toHaveBeenCalledOnce();

    const cancelledTask = vi.fn();
    const cancelNext = scheduleCalculatorLayoutTask(cancelledTask);
    callbacks.get(3)?.(0);
    cancelNext();
    callbacks.get(4)?.(0);
    expect(cancelledTask).not.toHaveBeenCalled();

    cancel();
  });
});
