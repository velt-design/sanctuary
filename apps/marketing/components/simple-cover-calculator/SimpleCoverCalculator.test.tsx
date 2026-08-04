import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimpleCoverInput, SimpleCoverPricedResult } from '@/lib/simpleCoverCalculator';
import SimpleCoverCalculator from './SimpleCoverCalculator';

let root: Root | null = null;

beforeAll(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function priced(input: SimpleCoverInput): SimpleCoverPricedResult {
  const postCount = Math.max(2, Math.ceil(input.widthMm / 4_000) + 1);
  return {
    ok: true,
    status: 'priced',
    input,
    areaM2: input.widthMm * input.projectionMm / 1_000_000,
    postCount,
    postSpacingMm: Math.round(input.widthMm / (postCount - 1)),
    plan: {
      postPositions: Array.from(
        { length: postCount },
        (_, index) => .05 / (input.widthMm / 1_000) + (index / (postCount - 1)) * (1 - .1 / (input.widthMm / 1_000)),
      ),
      rafterPositions: [25, 1_512.5, 3_000, 4_487.5, 5_975].map((position) => position / 6_000),
    },
    price: { fromIncGst: 24_250, currency: 'NZD' },
    configuration: { versionNumber: 9 },
  };
}

function mockPricingFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const input = JSON.parse(String(init?.body)) as SimpleCoverInput;
    return { json: async () => priced(input) } as Response;
  });
}

async function render() {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<SimpleCoverCalculator />));
  return container;
}

async function settlePrice() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
}

function setRange(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('SimpleCoverCalculator', () => {
  it('server-renders a labelled, keyboard-operable public contract', () => {
    document.body.innerHTML = renderToStaticMarkup(<SimpleCoverCalculator />);

    const width = document.querySelector('#simple-cover-width') as HTMLInputElement;
    const projection = document.querySelector('#simple-cover-projection') as HTMLInputElement;
    expect(document.querySelector('h2')?.textContent).toContain('Shape the cover');
    expect(width).toMatchObject({ min: '1000', max: '10000', step: '100', value: '6000' });
    expect(projection).toMatchObject({ min: '1000', max: '6000', step: '100', value: '3000' });
    expect(document.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain('6.0 m wide by 3.0 m');
    expect(document.body.textContent).toContain('Concept plan, not a construction drawing.');
    expect(document.querySelectorAll('button')).toHaveLength(0);
    expect(document.querySelectorAll('input[inputmode="decimal"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-terminal="true"]')).toHaveLength(4);
    expect(document.querySelectorAll('[data-plan-rafter]')).toHaveLength(11);
    expect(document.querySelectorAll('[data-plan-post]')).toHaveLength(3);
    expect(document.querySelector('[data-plan-header]')?.textContent).not.toContain('18.0 m²');
  });

  it('loads a live published price and updates dimensions without a submit action', async () => {
    const fetchMock = mockPricingFetch();
    const container = await render();
    await settlePrice();

    expect(fetchMock).toHaveBeenCalledWith('/api/simple-cover-price', expect.objectContaining({ method: 'POST', cache: 'no-store' }));
    expect(container.textContent).toContain('From $24,250');
    expect(container.textContent).toContain('GST and standard installation included.');
    expect(container.textContent).toContain('Live pricing set v9');

    const width = container.querySelector('#simple-cover-width') as HTMLInputElement;
    await act(async () => setRange(width, '6100'));
    expect(container.textContent).toContain('6.1 m');
    expect(container.querySelector('[data-result-state="loading"]')).not.toBeNull();
    await settlePrice();
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({ widthMm: 6_100 });
  });

  it('retains out-of-range-for-Simple inputs, removes price and gives the exact custom route', async () => {
    const fetchMock = mockPricingFetch();
    const container = await render();
    await settlePrice();
    fetchMock.mockClear();

    const projection = container.querySelector('#simple-cover-projection') as HTMLInputElement;
    await act(async () => setRange(projection, '6000'));

    expect(container.textContent).toContain('36.0 m² exceeds the 30 m² ground-level Simple cover limit.');
    expect(container.textContent).not.toContain('From $');
    expect(container.querySelector('[data-result-state="custom"]')).not.toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toContain('source_component=public_calculator');
    await settlePrice();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a safe unavailable state and preserves the design', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('private configuration detail'));
    const container = await render();
    await settlePrice();

    expect(container.querySelector('[data-result-state="unavailable"]')).not.toBeNull();
    expect(container.textContent).toContain('Your design is still here.');
    expect(container.textContent).toContain('18.0 m²');
    expect(container.textContent).not.toContain('private configuration detail');
    expect(container.querySelectorAll('[data-plan-rafter]')).toHaveLength(11);
  });

  it('accepts precise dimensions without step buttons', async () => {
    mockPricingFetch();
    const container = await render();
    await settlePrice();

    const widthMetres = container.querySelector('input[inputmode="decimal"]') as HTMLInputElement;
    await act(async () => widthMetres.focus());
    expect(widthMetres.selectionStart).toBe(0);
    expect(widthMetres.selectionEnd).toBe(widthMetres.value.length);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(widthMetres, '4.74');
      widthMetres.dispatchEvent(new Event('input', { bubbles: true }));
      widthMetres.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => widthMetres.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));

    expect((container.querySelector('#simple-cover-width') as HTMLInputElement).value).toBe('4700');
    expect(widthMetres.value).toBe('4.7');
  });
});
