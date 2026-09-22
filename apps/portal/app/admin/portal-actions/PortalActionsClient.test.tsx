import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import PortalActionsClient from './PortalActionsClient';

vi.mock('@/components/layout/StaffPageHeader', () => ({ default: ({ title }: { title: string }) => <h1>{title}</h1> }));
const projectId = '00000000-0000-4000-8000-000000000003';
const commandId = '00000000-0000-4000-8000-000000000005';
const grantId = '00000000-0000-4000-8000-000000000006';
const token = `spa1_${'a'.repeat(64)}`;
const expiration = () => new Date(Date.now() + 3_600_000).toISOString();
const manifest = () => {
  const expiresAt = expiration();
  return { version: 'portal_actions_v1', environment: 'staging', label: 'Synthetic audit', taskReference: 'Synthetic task',
    expiresAt, projectIds: [projectId], actions: [{ commandId, projectId, command: 'CLOSE', expectedRowVersion: 3,
      expiresAt, outcome: 'LOST_NO_RESPONSE', note: 'Approved synthetic closure', cancellationReason: 'No response' }] };
};
const goodReview = () => ({ environment: 'staging', enabled: true,
  projects: [{ projectId, name: 'Synthetic project North', stage: 'SENT', archivedAt: null, state: 'ACTIVE', rowVersion: 3, closedOutcome: null }],
  actions: [{ commandId, projectId, eligible: true, reason: null }] });
const grantRow = () => ({ id: grantId, label: 'Synthetic audit', task_reference: 'Synthetic task', environment: 'staging',
  created_at: new Date().toISOString(), expires_at: expiration(), revoked_at: null, project_count: 1, action_count: 1, committed_count: 0 });
const response = (data: unknown, status = 200) => Response.json(data, { status });
let mockFetch: ReturnType<typeof vi.fn>;
let previewReply: () => Promise<Response>;
let issueReply: () => Promise<Response>;
let revokeReply: () => Promise<Response>;
let inventory: ReturnType<typeof grantRow>[];
let rendered: ReturnType<typeof renderIntoDocument> | null;

async function flush() { await act(async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); }); }
function button(text: string) {
  const result = Array.from(rendered!.container.querySelectorAll('button')).find((node) => node.textContent === text);
  if (!result) throw new Error(`Button not found: ${text}`);
  return result;
}
async function click(text: string) { await act(async () => { button(text).click(); }); await flush(); }
async function paste(value: string) {
  const field = rendered!.container.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function render() { rendered = renderIntoDocument(<PortalActionsClient />); await flush(); }
async function review() { await paste(JSON.stringify(manifest())); await click('Review projects'); }
async function confirm() { await act(async () => { rendered!.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(); }); }
const mutationCalls = () => mockFetch.mock.calls.filter(([url, init]) => url === '/api/admin/portal-actions/grants' && init?.method === 'POST');

beforeEach(() => {
  rendered = null;
  inventory = [];
  previewReply = async () => response(goodReview());
  issueReply = async () => response({ grantId, actorUserId: projectId, environment: 'staging', version: 'portal_actions_v1', expiresAt: expiration(), token });
  revokeReply = async () => response({ grantId, revoked: true });
  mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/preview')) return previewReply();
    if (url.endsWith('/revoke')) return revokeReply();
    if (init?.method === 'POST') return issueReply();
    return response({ grants: inventory });
  });
  vi.stubGlobal('fetch', mockFetch);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => {}) } });
});
afterEach(() => { rendered?.unmount(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Portal action operator journey', () => {
  it('reviews real server names and exact actions, rechecks, then copies the credential once without storage', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    await render(); await review();
    expect(rendered!.container.textContent).toContain('Synthetic project North');
    expect(rendered!.container.textContent).toContain('Expected version 3 · Current version 3');
    expect(button('Authorise and create connection').disabled).toBe(true);
    await confirm(); await click('Authorise and create connection');
    expect(mockFetch.mock.calls.filter(([url]) => url.endsWith('/preview'))).toHaveLength(2);
    expect(mutationCalls()).toHaveLength(1);
    const sent = JSON.parse(mutationCalls()[0][1].body);
    expect(sent.actions[0]).toMatchObject({ commandId, projectId, command: 'CLOSE', expectedRowVersion: 3 });
    expect(Object.keys(sent)).not.toContain('actorUserId');
    expect(rendered!.container.textContent).toContain('approved actions have not been executed');
    expect(rendered!.container.innerHTML).not.toContain(token);
    await click('Copy connection key once');
    expect(navigator.clipboard.writeText).toHaveBeenCalledExactlyOnceWith(token);
    expect(rendered!.container.textContent).toContain('Connection key copied');
    expect(rendered!.container.textContent).not.toContain('Copy connection key once');
    expect(storage).not.toHaveBeenCalled();
  });

  it('denied preview cannot authorise and does not echo server errors', async () => {
    previewReply = async () => response({ error: 'private server detail' }, 403);
    await render(); await review();
    expect(rendered!.container.textContent).toContain('No connection was created');
    expect(rendered!.container.textContent).not.toContain('private server detail');
    expect(button('Authorise and create connection').disabled).toBe(true);
    expect(mutationCalls()).toHaveLength(0);
  });

  it('imports a file for review without creating a connection', async () => {
    await render();
    const file = new File([JSON.stringify(manifest())], 'synthetic-approval.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(manifest()) });
    const input = rendered!.container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); }); await flush();
    expect(button('Review projects').disabled).toBe(false);
    await click('Review projects');
    expect(rendered!.container.textContent).toContain('Synthetic project North');
    expect(mutationCalls()).toHaveLength(0);
  });

  it('editing an import invalidates review and clearing removes private request content', async () => {
    await render(); await review(); await confirm();
    await paste(JSON.stringify({ ...manifest(), label: 'Changed request' }));
    expect(button('Authorise and create connection').disabled).toBe(true);
    expect(rendered!.container.textContent).not.toContain('Synthetic project North');
    await click('Clear request');
    expect(rendered!.container.querySelector('textarea')!.value).toBe('');
    expect(button('Review projects').disabled).toBe(true);
  });

  it('ignores stale preview completion after the import is changed', async () => {
    let finish!: (value: Response) => void;
    previewReply = () => new Promise((resolve) => { finish = resolve; });
    await render(); await paste(JSON.stringify(manifest())); await click('Review projects');
    await paste('{}');
    await act(async () => finish(response(goodReview()))); await flush();
    expect(rendered!.container.textContent).not.toContain('Synthetic project North');
    expect(button('Authorise and create connection').disabled).toBe(true);
  });

  it.each(['conflict', 'missing', 'disabled'])('prevents issuance with %s review evidence', async (mode) => {
    const data = goodReview();
    if (mode === 'conflict') { data.actions[0].eligible = false; data.projects[0].rowVersion = 4; }
    if (mode === 'missing') data.projects = [];
    if (mode === 'disabled') data.enabled = false;
    previewReply = async () => response(data);
    await render(); await review();
    expect(button('Authorise and create connection').disabled).toBe(true);
    expect(rendered!.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.disabled).toBe(true);
  });

  it('a changed final preview requires another review and never issues', async () => {
    await render(); await review(); await confirm();
    previewReply = async () => response({ ...goodReview(), projects: [{ ...goodReview().projects[0], rowVersion: 4 }] });
    await click('Authorise and create connection');
    expect(rendered!.container.textContent).toContain('project review has changed');
    expect(mutationCalls()).toHaveLength(0);
    expect(button('Authorise and create connection').disabled).toBe(true);
  });

  it('uncertain creation is never automatically retried and directs inventory recovery', async () => {
    issueReply = async () => { throw new Error(`untrusted ${token}`); };
    await render(); await review(); await confirm(); await click('Authorise and create connection');
    expect(rendered!.container.textContent).toContain('Creation could not be confirmed');
    expect(rendered!.container.textContent).not.toContain(token);
    expect(mutationCalls()).toHaveLength(1);
    expect(button('Authorise and create connection').disabled).toBe(true);
    expect(button('Review projects').disabled).toBe(true);
  });

  it('returning reloads grant metadata without restoring the request or key', async () => {
    await render(); await review(); await confirm(); await click('Authorise and create connection');
    rendered!.unmount(); inventory = [grantRow()]; await render();
    expect(rendered!.container.textContent).toContain('Synthetic audit');
    expect(rendered!.container.querySelector('textarea')!.value).toBe('');
    expect(rendered!.container.textContent).not.toContain('Copy connection key once');
    expect(rendered!.container.innerHTML).not.toContain(token);
  });

  it('clipboard denial keeps the one-time key available for an explicit retry', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('clipboard denied'));
    await render(); await review(); await confirm(); await click('Authorise and create connection');
    await click('Copy connection key once');
    expect(rendered!.container.textContent).toContain('connection key could not be copied');
    expect(button('Copy connection key once').disabled).toBe(false);
    await click('Copy connection key once');
    expect(rendered!.container.textContent).toContain('Connection key copied');
  });

  it('returned inventory supports confirmed exact-grant revocation', async () => {
    inventory = [grantRow()]; await render();
    await click('Revoke connection');
    expect(mockFetch.mock.calls.some(([url]) => url.endsWith('/revoke'))).toBe(false);
    await click('Confirm revoke');
    const calls = mockFetch.mock.calls.filter(([url]) => url.endsWith('/revoke'));
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0][1].body)).toEqual({ grantId });
    expect(rendered!.container.textContent).toContain('Revoked');
    expect(rendered!.container.textContent).not.toContain('Revoke connection');
  });

  it('failed revocation retains the record and requires refresh before further actions', async () => {
    inventory = [grantRow()]; revokeReply = async () => response({}, 503); await render();
    await click('Revoke connection'); await click('Confirm revoke');
    expect(rendered!.container.textContent).toContain('Revocation could not be confirmed');
    expect(button('Confirm revoke').disabled).toBe(true);
    expect(rendered!.container.textContent).toContain('Active');
  });
});
