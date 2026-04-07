import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactCreateClient from './ContactCreateClient';
import { renderIntoDocument } from '../../../../../../test/reactHarness';

const pushMock = vi.fn();
const apiJsonMock = vi.fn();

function changeValue(target: HTMLInputElement | null, value: string) {
  if (!target) throw new Error('Missing input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('Missing value setter');
  setter.call(target, value);
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children?: unknown } & Record<string, unknown>) => <a {...props}>{children ?? null}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/repo/apiClient', () => ({
  apiJson: (...args: unknown[]) => apiJsonMock(...args),
}));

describe('ContactCreateClient', () => {
  beforeEach(() => {
    apiJsonMock.mockReset();
    pushMock.mockReset();
    apiJsonMock.mockResolvedValue({
      contact: {
        id: 'ct_1',
      },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates contacts through the contacts API and redirects to the detail page', async () => {
    const rendered = renderIntoDocument(<ContactCreateClient />);

    const inputs = rendered.container.querySelectorAll('input');
    const nameInput = inputs[0] as HTMLInputElement;
    const emailInput = inputs[1] as HTMLInputElement;
    const phoneInput = inputs[2] as HTMLInputElement;
    const form = rendered.container.querySelector('form');

    await act(async () => {
      changeValue(nameInput, 'Alex Mason');
      changeValue(emailInput, 'alex@example.com');
      changeValue(phoneInput, '021');
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(apiJsonMock).toHaveBeenCalledWith(
      '/api/contacts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          displayName: 'Alex Mason',
          email: 'alex@example.com',
          phone: '021',
        }),
      }),
    );
    expect(pushMock).toHaveBeenCalledWith('/staff/contacts/ct_1');

    rendered.unmount();
  });
});
