import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import OutlookBatchControls, { parseDispatchResults } from './OutlookBatchControls';
const api = vi.hoisted(() => vi.fn());
vi.mock('@/lib/repo/apiClient', () => ({ apiJson: api }));
const firstId = '00000000-0000-4000-8000-000000000001';
const secondId = '00000000-0000-4000-8000-000000000002';
const attemptId = '00000000-0000-4000-8000-000000000003';
afterEach(() => { vi.resetAllMocks(); sessionStorage.clear(); document.body.innerHTML = ''; });
function button(container: HTMLElement, text: string) { return [...container.querySelectorAll('button')].find(node => node.textContent === text)!; }
async function click(node: HTMLElement) { await act(async () => { node.click(); }); }
async function setResults(container: HTMLElement, value: string) {
  const node = container.querySelector<HTMLTextAreaElement>('textarea:not([readonly])')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); });
}
describe('Outlook batch operator controls', () => {
  it('recovers the same uncertain claim and blocks allocation on replay', async () => {
    api.mockRejectedValueOnce(new Error('Network interrupted')).mockResolvedValueOnce({ replayed: true, replies: [] });
    const view = renderIntoDocument(<OutlookBatchControls batchId="example-batch" />);
    await click(button(view.container, 'Start next 10'));
    const initial = JSON.parse(api.mock.calls[0][1].body);
    expect(initial.limit).toBe(10);
    await click(button(view.container, 'Recover same claim'));
    expect(JSON.parse(api.mock.calls[1][1].body).commandId).toBe(initial.commandId);
    expect(button(view.container, 'Recover same claim').disabled).toBe(true);
    expect(view.container.textContent).toContain('payload cannot be retrieved again');
    view.unmount();
  });
  it('retains failed result rows after recording successful rows sequentially', async () => {
    api.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error('Unavailable'));
    const view = renderIntoDocument(<OutlookBatchControls batchId="example-batch" />);
    const first = { intentId: firstId, attemptId, outcome: 'uncertain', note: 'Synthetic ambiguous response' };
    const second = { ...first, intentId: secondId };
    await setResults(view.container, JSON.stringify([first, second]));
    await click(button(view.container, 'Record Outlook results'));
    expect(api).toHaveBeenCalledTimes(2);
    expect(JSON.parse(view.container.querySelector('textarea')!.value)).toEqual([second]);
    expect(view.container.textContent).toContain('1 results recorded');
    view.unmount();
  });
  it('requires complete receipts and rejects duplicates before making requests', () => {
    expect(() => parseDispatchResults(JSON.stringify([{ intentId: firstId, attemptId, outcome: 'sent' }]))).toThrow();
    const row = { intentId: firstId, attemptId, outcome: 'uncertain' };
    expect(() => parseDispatchResults(JSON.stringify([row, row]))).toThrow();
    expect(() => parseDispatchResults(JSON.stringify(Array.from({ length: 11 }, () => row)))).toThrow();
    expect(api).not.toHaveBeenCalled();
  });
});
