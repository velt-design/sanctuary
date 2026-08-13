import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import AccessClient from './AccessClient';

const crew = {
  id: 'crew-1',
  name: 'North crew',
  color: '#F15A24',
  is_active: false,
  sort_order: 1,
  calendar_region: 'Auckland',
  base_available_date: null,
  scheduled_item_count: 0,
};
const secondCrew = {
  ...crew,
  id: 'crew-2',
  name: 'South crew',
  sort_order: 2,
};

function renderAccess() {
  return renderIntoDocument(
    <ToastProvider>
      <AccessClient />
    </ToastProvider>,
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('AccessClient crew state', () => {
  let finishPatch: ((response: Response) => void) | null;

  beforeEach(() => {
    finishPatch = null;
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return new Promise<Response>((resolve) => {
          finishPatch = resolve;
        });
      }
      return Response.json({ crews: [crew, secondCrew] });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('rolls back only the failed status field and preserves edits typed while it saves', async () => {
    const rendered = renderAccess();
    await flush();
    const nameInput = Array.from(rendered.container.querySelectorAll<HTMLInputElement>('input[type="text"]'))
      .find((input) => input.value === 'South crew');
    const status = rendered.container.querySelector<HTMLInputElement>('tbody input[type="checkbox"]');
    if (!nameInput || !status) throw new Error('Crew controls were not rendered');

    act(() => {
      status.click();
    });
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(nameInput, 'South crew edited during save');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      finishPatch?.(Response.json({ error: 'Crew update failed' }, { status: 500 }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(nameInput.value).toBe('South crew edited during save');
    expect(status.checked).toBe(false);
    rendered.unmount();
  });
});
