import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import EmailReviewEditor from './EmailReviewEditor';
import { createFixtureApi, fixtureItems } from '../../app/qa/email-review-fixture/fixtureApi';
import { replySubject, safeEvidenceUrl } from './api';
import { contextChanges } from './contextChanges';

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });
function button(container: HTMLElement, text: string) {
  const node = [...container.querySelectorAll('button')].find(node => node.textContent === text);
  if (!node) throw new Error(`Missing button ${text}`);
  return node;
}
async function click(node: HTMLElement) { await act(async () => { node.click(); }); }
async function type(node: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); });
}
describe('Email review editor', () => {
  it('requires both checks, persists approval, and does not invoke any sending transport', async () => {
    const api = createFixtureApi(); const saved = vi.fn(); const command = vi.spyOn(api, 'command');
    const view = renderIntoDocument(<EmailReviewEditor item={fixtureItems()[0]} api={api} onSaved={saved} onDirty={() => undefined} />);
    expect(button(view.container, 'Approve draft').disabled).toBe(true);
    const checks = view.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    await click(checks[0]); expect(button(view.container, 'Approve draft').disabled).toBe(true);
    await click(checks[1]); await click(button(view.container, 'Approve draft'));
    expect(command).toHaveBeenCalledWith('example-batch', 'example-draft-1', expect.objectContaining({ action: 'approve', prerequisitesConfirmed: true, threadConfirmed: true }));
    expect(saved.mock.calls[0][0].status).toBe('approved'); expect(view.container.textContent).toContain('No email has been sent');
    view.unmount();
  });
  it('saving edits removes an existing approval and resets confirmation', async () => {
    const api = createFixtureApi(); const saved = vi.fn();
    const view = renderIntoDocument(<EmailReviewEditor item={fixtureItems()[1]} api={api} onSaved={saved} onDirty={() => undefined} />);
    await type(view.container.querySelector('textarea')!, 'A revised email.');
    expect(button(view.container, 'Approve draft').disabled).toBe(true);
    await click(button(view.container, 'Save edits'));
    expect(saved.mock.calls[0][0]).toMatchObject({ body: 'A revised email.', status: 'draft' });
    expect([...view.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(node => !node.checked)).toBe(true);
    view.unmount();
  });
  it('keeps local text on conflict and explicitly rebases before another save', async () => {
    const api = createFixtureApi(); api.conflictNext();
    const view = renderIntoDocument(<EmailReviewEditor item={fixtureItems()[0]} api={api} onSaved={() => undefined} onDirty={() => undefined} />);
    await type(view.container.querySelector('textarea')!, 'My unsaved wording.');
    await click(button(view.container, 'Save edits'));
    expect(view.container.querySelector('textarea')!.value).toBe('My unsaved wording.');
    expect(button(view.container, 'Save edits').disabled).toBe(true);
    await click(button(view.container, 'Load latest saved version'));
    expect(view.container.textContent).toContain('Synthetic edit from another reviewer');
    await click(button(view.container, 'Keep my edits'));
    await click(button(view.container, 'Save edits'));
    expect((await api.item('example-batch', 'example-draft-1')).body).toBe('My unsaved wording.');
    view.unmount();
  });
  it('blocks approval without a conversation and requires a skip note', async () => {
    const api = createFixtureApi(); const saved = vi.fn();
    const view = renderIntoDocument(<EmailReviewEditor item={fixtureItems()[4]} api={api} onSaved={saved} onDirty={() => undefined} />);
    expect(button(view.container, 'Approve draft').disabled).toBe(true); expect(button(view.container, 'Skip with note').disabled).toBe(true);
    const note = [...view.container.querySelectorAll<HTMLInputElement>('input')].find(node => node.labels?.[0]?.textContent?.includes('Review note'))!;
    await type(note, 'Correct conversation is unavailable.'); await click(button(view.container, 'Skip with note'));
    expect(saved.mock.calls[0][0].status).toBe('skipped'); view.unmount();
  });
  it('requires current context acknowledgment and save before approval', async () => {
    const api = createFixtureApi(); const saved = vi.fn();
    const view = renderIntoDocument(<EmailReviewEditor item={fixtureItems()[3]} api={api} onSaved={saved} onDirty={() => undefined} />);
    expect(view.container.textContent).toContain('Project work state was updated (revision 1 → 2)');
    expect(button(view.container, 'Approve draft').disabled).toBe(true);
    await click(view.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
    await click(button(view.container, 'Save edits'));
    expect(saved.mock.calls[0][0].contextChanged).toBe(false); expect(button(view.container, 'Approve draft').disabled).toBe(true); view.unmount();
  });
  it('identifies contact name and assignment changes without exposing contact identifiers', () => {
    const item = fixtureItems()[0];
    const changed = { ...item, contextChanged: true, currentProjectContext: { ...item.currentProjectContext, contactName: 'Updated example contact', contactId: 'different-private-id' } };
    const view = renderIntoDocument(<EmailReviewEditor item={changed} api={createFixtureApi()} onSaved={() => undefined} onDirty={() => undefined} />);
    expect(view.container.textContent).toContain('Contact name: Example customer 1 → Updated example contact');
    expect(view.container.textContent).toContain('Contact assignment changed');
    expect(view.container.textContent).not.toContain('different-private-id');
    expect(contextChanges(item.currentProjectContext, item.currentProjectContext)).toEqual([]);
    view.unmount();
  });
  it('locks drafts already assigned to dispatch', () => {
    const view = renderIntoDocument(<EmailReviewEditor item={{ ...fixtureItems()[0], dispatchId: 'example-dispatch' }} api={createFixtureApi()} onSaved={() => undefined} onDirty={() => undefined} />);
    expect(button(view.container, 'Save edits').disabled).toBe(true); expect(button(view.container, 'Approve draft').disabled).toBe(true); view.unmount();
  });
});
describe('Synthetic persistence and safe links', () => {
  it('resumes saved review after creating another adapter and pages 25 at a time', async () => {
    const memory = new Map<string, string>(); const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
    const first = createFixtureApi(storage);
    await first.command('example-batch', 'example-draft-1', { commandId: 'example-command', expectedRevision: 1, action: 'skip', note: 'Example reason' });
    const resumed = createFixtureApi(storage);
    expect((await resumed.item('example-batch', 'example-draft-1')).status).toBe('skipped');
    expect((await resumed.page('example-batch', 1, 'all', '')).items).toHaveLength(25);
    expect((await resumed.page('example-batch', 2, 'all', '')).items).toHaveLength(5);
  });
  it('rejects active evidence URLs and preserves actual reply subjects', () => {
    expect(safeEvidenceUrl('javascript:alert(1)')).toBeUndefined(); expect(safeEvidenceUrl('https://example.invalid')).toBe('https://example.invalid/');
    expect(replySubject('re: Existing')).toBe('re: Existing'); expect(replySubject('New')).toBe('Re: New');
  });
});
