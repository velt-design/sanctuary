import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import DimensionControl from './DimensionControl';

it('selects the value immediately and commits valid dimensions without losing the last valid value', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  function Harness() {
    const [value, update] = React.useState(6000);
    return <DimensionControl axis="width" label="Width" min={1500} max={10000} value={value} onChange={update}/>;
  }
  try {
    await React.act(async () => root.render(<Harness/>));
    const input = host.querySelector<HTMLInputElement>('input[inputmode=decimal]')!;
    await React.act(async () => input.focus());
    expect([input.selectionStart,input.selectionEnd]).toEqual([0,3]);
    const change = async (value: string) => {
      await React.act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);
        input.dispatchEvent(new Event('input',{bubbles:true}));
      });
      await React.act(async () => input.blur());
    };
    await change('7.26'); expect(input.value).toBe('7.3');
    await React.act(async () => input.focus()); await change('invalid');
    expect(input.value).toBe('7.3'); expect(host.textContent).toContain('Enter a size in metres.');
    await React.act(async () => input.focus()); await change('20');
    expect(input.value).toBe('10.0'); expect(host.textContent).toContain('Choose 1.5 m–10.0 m.');
  } finally { await React.act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
