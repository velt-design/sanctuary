import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/ui/toast/ToastProvider';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ImportsClient from './ImportsClient';

const { readJsonFileMock } = vi.hoisted(() => ({
  readJsonFileMock: vi.fn(),
}));

vi.mock('@/lib/export/json', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/export/json')>();
  return { ...actual, readJsonFile: readJsonFileMock };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [file],
  });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('ImportsClient parsing state', () => {
  afterEach(() => {
    readJsonFileMock.mockReset();
    document.body.innerHTML = '';
  });

  it('keeps the latest selected batch when an older parse finishes last', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    readJsonFileMock.mockImplementation((file: File) => (
      file.name === 'first.json' ? first.promise : second.promise
    ));
    const rendered = renderIntoDocument(
      <ToastProvider>
        <ImportsClient />
      </ToastProvider>,
    );
    const input = rendered.container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('Import file control was not rendered');

    act(() => selectFile(input, new File(['{}'], 'first.json', { type: 'application/json' })));
    act(() => selectFile(input, new File(['{}'], 'second.json', { type: 'application/json' })));

    second.resolve([{ id: 'contact-2', displayName: 'Second', email: '', phone: '', createdAt: '', updatedAt: '' }]);
    await flush();
    expect(rendered.container.textContent).toContain('second.json');

    first.resolve([{ id: 'contact-1', displayName: 'First', email: '', phone: '', createdAt: '', updatedAt: '' }]);
    await flush();
    expect(rendered.container.textContent).toContain('second.json');
    expect(rendered.container.textContent).not.toContain('first.json');
    rendered.unmount();
  });
});
