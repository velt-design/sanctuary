import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import ProductChoices from './ProductChoices';
import { INITIAL_PRODUCT_SELECTION } from './productSelection';

it('supports keyboard and sequential navigation without losing selected options', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  function Harness() {
    const [selection, setSelection] = React.useState(INITIAL_PRODUCT_SELECTION);
    return <ProductChoices selection={selection} update={patch => setSelection(old => ({ ...old, ...patch }))} ready issue={null}/>;
  }
  try {
    await React.act(async () => root.render(<Harness/>));
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    await React.act(async () => tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('#product-panel-0')?.getAttribute('inert')).toBe('');
    const solid = host.querySelectorAll<HTMLInputElement>('input[name=product-roof]')[1];
    await React.act(async () => solid.click());
    const next = [...host.querySelectorAll('button')].find(b => b.textContent?.startsWith('Next:'))!;
    await React.act(async () => next.click());
    expect(document.activeElement).toBe(tabs[2]);
    await React.act(async () => tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
    expect(solid.checked).toBe(true);
    expect(tabs[1].textContent).toContain('Solid + timber');
    expect(host.querySelectorAll('[role=tabpanel]')).toHaveLength(3);
  } finally { await React.act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});

it('keeps side templates and gable direction selected without a redundant diagram', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  function Harness() {
    const [selection, setSelection] = React.useState(INITIAL_PRODUCT_SELECTION);
    return <ProductChoices imageFamily="gable" selection={selection} update={patch => setSelection(old => ({ ...old, ...patch }))} ready issue={null}/>;
  }
  try {
    await React.act(async () => root.render(<Harness/>));
    const directions = host.querySelectorAll<HTMLInputElement>('input[name=product-gable-direction]');
    await React.act(async () => directions[1].click());
    expect(directions[1].checked).toBe(true);
    const tabs = host.querySelectorAll<HTMLButtonElement>('[role=tab]');
    await React.act(async () => tabs[2].click());
    await React.act(async () => host.querySelectorAll<HTMLInputElement>('input[name=product-sides]')[1].click());
    expect(host.querySelector('svg[role=img]')).toBeNull();
    expect(host.querySelectorAll<HTMLInputElement>('input[name=product-sides]')[1].checked).toBe(true);
    await React.act(async () => host.querySelectorAll<HTMLInputElement>('input[name=product-sides]')[3].click());
    expect(host.querySelectorAll<HTMLInputElement>('input[name=product-sides]')[3].checked).toBe(true);
    await React.act(async () => tabs[0].click());
    expect(directions[1].checked).toBe(true);
  } finally { await React.act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
