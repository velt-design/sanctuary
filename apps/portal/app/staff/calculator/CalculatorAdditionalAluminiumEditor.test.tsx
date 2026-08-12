import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorAdditionalAluminiumEditor from './CalculatorAdditionalAluminiumEditor';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CalculatorAdditionalAluminiumEditor', () => {
  it('loads pricebook choices and forwards row actions', () => {
    const onAddRow = vi.fn();
    const onUpdateRow = vi.fn();
    const onRemoveRow = vi.fn();

    renderIntoDocument(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CalculatorAdditionalAluminiumEditor
          state={{ rows: [{ id: 'row-1', profile: '', stockLengthM: '', quantity: '1' }] }}
          catalogueItems={[
            { profile: '100x50', stockLengthsM: [4, 5, 6] },
            { profile: '200x50', stockLengthsM: [6] },
          ]}
          onAddRow={onAddRow}
          onUpdateRow={onUpdateRow}
          onRemoveRow={onRemoveRow}
          onUpdateFinish={vi.fn()}
        />
      </QueryClientProvider>,
    );
    const profile = document.querySelector('[aria-label="Additional aluminium 1 profile"]') as HTMLSelectElement;
    expect(Array.from(profile.options).map((option) => option.textContent)).toContain('200x50');
    act(() => {
      profile.value = '200x50';
      profile.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onUpdateRow).toHaveBeenCalledWith('row-1', { profile: '200x50', stockLengthM: '6' });

    act(() => (document.querySelector('[aria-label="Remove additional aluminium 1"]') as HTMLButtonElement).click());
    act(() => Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Add aluminium'))?.click());
    expect(onRemoveRow).toHaveBeenCalledWith('row-1');
    expect(onAddRow).toHaveBeenCalledOnce();
  });
});
