import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import EmailReviewEditor from './EmailReviewEditor';
import { createFixtureApi, fixtureItems } from '../../app/qa/email-review-fixture/fixtureApi';
import { safeEvidenceUrl } from './api';
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
describe('simple email acceptance',()=>{
 it('accepts the displayed message without extra checks or a sending transport',async()=>{const api=createFixtureApi(),saved=vi.fn(),command=vi.spyOn(api,'command');const view=renderIntoDocument(<EmailReviewEditor item={fixtureItems()[0]} api={api} onSaved={saved} onDirty={()=>undefined}/>);expect(view.container.querySelectorAll('input[type="checkbox"],select')).toHaveLength(0);expect(button(view.container,'Accept').disabled).toBe(false);await click(button(view.container,'Accept'));expect(command).toHaveBeenCalledOnce();expect(command.mock.calls[0][2]).toMatchObject({action:'accept',to:fixtureItems()[0].to,body:fixtureItems()[0].body,expectedContextHash:fixtureItems()[0].currentContextHash});expect(command.mock.calls[0][2]).not.toHaveProperty('threadConfirmed');expect(saved.mock.calls[0][0].status).toBe('approved');expect(view.container.textContent).toContain('No email has been sent');view.unmount();});
 it('saves revisions and accepts with one action, including an editable fresh subject',async()=>{const api=createFixtureApi(),saved=vi.fn(),command=vi.spyOn(api,'command');const view=renderIntoDocument(<EmailReviewEditor item={fixtureItems()[0]} api={api} onSaved={saved} onDirty={()=>undefined}/>);await type(view.container.querySelector('textarea')!,'My revised message.');const subject=[...view.container.querySelectorAll<HTMLInputElement>('input')].find(x=>x.labels?.[0]?.textContent==='Subject')!;expect(subject.readOnly).toBe(false);await type(subject,'A new question');expect(button(view.container,'Save and accept').disabled).toBe(false);await click(button(view.container,'Save and accept'));expect(command).toHaveBeenCalledOnce();expect(saved.mock.calls[0][0]).toMatchObject({body:'My revised message.',subject:'A new question',status:'approved',revision:2,deliveryMode:'new'});view.unmount();});
 it('accepts missing conversations as fresh email with a visible unprefixed subject',async()=>{const api=createFixtureApi(),saved=vi.fn();const view=renderIntoDocument(<EmailReviewEditor item={fixtureItems()[4]} api={api} onSaved={saved} onDirty={()=>undefined}/>);const subject=[...view.container.querySelectorAll<HTMLInputElement>('input')].find(x=>x.labels?.[0]?.textContent==='Subject')!;expect(subject.value).toBe('Example pergola 5');await click(button(view.container,'Accept'));expect(saved.mock.calls[0][0]).toMatchObject({deliveryMode:'new',threadMessageId:null,subject:'Example pergola 5',status:'approved'});view.unmount();});
 it('skips without a mandatory note',async()=>{const api=createFixtureApi(),saved=vi.fn();const view=renderIntoDocument(<EmailReviewEditor item={fixtureItems()[4]} api={api} onSaved={saved} onDirty={()=>undefined}/>);expect(button(view.container,'Skip').disabled).toBe(false);await click(button(view.container,'Skip'));expect(saved.mock.calls[0][0].status).toBe('skipped');expect(saved.mock.calls[0][0].events.at(-1).note).toBeNull();view.unmount();});
 it('shows changed context and accepts against its displayed hash atomically',async()=>{const api=createFixtureApi(),saved=vi.fn();const view=renderIntoDocument(<EmailReviewEditor item={fixtureItems()[3]} api={api} onSaved={saved} onDirty={()=>undefined}/>);expect(view.container.textContent).toContain('Project work state was updated (revision 1 → 2)');await click(button(view.container,'Accept'));expect(saved.mock.calls[0][0]).toMatchObject({contextChanged:false,status:'approved',revision:2});view.unmount();});
 it('keeps edits after conflict and accepts only after loading the latest revision',async()=>{const api=createFixtureApi();api.conflictNext();const view=renderIntoDocument(<EmailReviewEditor item={fixtureItems()[0]} api={api} onSaved={()=>undefined} onDirty={()=>undefined}/>);await type(view.container.querySelector('textarea')!,'My wording.');await click(button(view.container,'Save and accept'));expect(view.container.querySelector('textarea')!.value).toBe('My wording.');expect(button(view.container,'Save and accept').disabled).toBe(true);await click(button(view.container,'Load latest saved version'));await click(button(view.container,'Keep my edits'));await click(button(view.container,'Save and accept'));expect((await api.item('example-batch','example-draft-1'))).toMatchObject({body:'My wording.',status:'approved',revision:3});view.unmount();});
 it('saves an unfinished draft without accepting and clears prior approval',async()=>{const api=createFixtureApi(),saved=vi.fn();const view=renderIntoDocument(<EmailReviewEditor item={fixtureItems()[1]} api={api} onSaved={saved} onDirty={()=>undefined}/>);await type(view.container.querySelector('textarea')!,'Still working on this.');await click(button(view.container,'Save draft'));expect(saved.mock.calls[0][0].status).toBe('draft');view.unmount();});
 it('preserves locked dispatch messages and current context details',()=>{const item=fixtureItems()[0];const view=renderIntoDocument(<EmailReviewEditor item={{...item,dispatchId:'dispatch'}} api={createFixtureApi()} onSaved={()=>undefined} onDirty={()=>undefined}/>);expect(button(view.container,'Accept').disabled).toBe(true);expect(button(view.container,'Skip').disabled).toBe(true);expect(contextChanges(item.currentProjectContext,item.currentProjectContext)).toEqual([]);view.unmount();});
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
  it('rejects active evidence URLs', () => {
    expect(safeEvidenceUrl('javascript:alert(1)')).toBeUndefined(); expect(safeEvidenceUrl('https://example.invalid')).toBe('https://example.invalid/');
  });
});
