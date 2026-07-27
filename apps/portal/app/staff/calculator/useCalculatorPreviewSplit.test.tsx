import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import {
  CALCULATOR_PREVIEW_SPLIT_STACK_BREAKPOINT_PX,
  CALCULATOR_PREVIEW_SPLIT_STORAGE_KEY,
  calculatorPreviewDefaultRightWidth,
  calculatorPreviewMaxRightWidth,
  calculatorPreviewRightWidth,
  useCalculatorPreviewSplit,
} from './useCalculatorPreviewSplit';

function Probe() {
  const split = useCalculatorPreviewSplit();
  return (
    <div ref={split.splitRef} style={split.splitStyle} data-width={split.rightWidthPx}>
      <button type="button" onKeyDown={split.onKeyDown} aria-label="Resize preview panel width" />
    </div>
  );
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('calculator preview split', () => {
  it('uses responsive untouched defaults and clamps preferences to the available frame', () => {
    expect(CALCULATOR_PREVIEW_SPLIT_STACK_BREAKPOINT_PX).toBe(1080);
    expect(calculatorPreviewDefaultRightWidth(1280)).toBe(480);
    expect(calculatorPreviewDefaultRightWidth(1279)).toBe(440);
    expect(calculatorPreviewMaxRightWidth(1120)).toBe(462);
    expect(calculatorPreviewRightWidth(1200, null)).toBe(440);
    expect(calculatorPreviewRightWidth(1120, 520)).toBe(462);
    expect(calculatorPreviewRightWidth(900, 200)).toBe(360);
  });

  it('measures a compact desktop frame without writing a preference', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 800,
      height: 800,
      left: 0,
      right: 1200,
      top: 0,
      width: 1200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const rendered = renderIntoDocument(<Probe />);
    await flushEffects();

    expect(rendered.container.querySelector('[data-width]')?.getAttribute('data-width')).toBe('440');
    expect(window.localStorage.getItem(CALCULATOR_PREVIEW_SPLIT_STORAGE_KEY)).toBeNull();
    rendered.unmount();
  });

  it('ignores the automatically written v1 preference and restores an explicit v2 preference', async () => {
    window.localStorage.setItem('sanctuary-portal:calculator:previewRightWidthPx:v1', '520');
    let rendered = renderIntoDocument(<Probe />);
    await flushEffects();
    expect(rendered.container.querySelector('[data-width]')?.getAttribute('data-width')).toBe('480');
    rendered.unmount();

    window.localStorage.setItem(CALCULATOR_PREVIEW_SPLIT_STORAGE_KEY, '416');
    rendered = renderIntoDocument(<Probe />);
    await flushEffects();
    expect(rendered.container.querySelector('[data-width]')?.getAttribute('data-width')).toBe('416');
    rendered.unmount();
  });

  it('persists only an explicit keyboard resize', async () => {
    const rendered = renderIntoDocument(<Probe />);
    await flushEffects();
    const separator = rendered.container.querySelector('button') as HTMLButtonElement;

    act(() => separator.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' })));

    expect(rendered.container.querySelector('[data-width]')?.getAttribute('data-width')).toBe('464');
    expect(window.localStorage.getItem(CALCULATOR_PREVIEW_SPLIT_STORAGE_KEY)).toBe('464');
    rendered.unmount();
  });
});
