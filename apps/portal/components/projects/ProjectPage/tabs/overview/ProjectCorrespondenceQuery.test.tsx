import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import { correspondenceFixture } from '@/app/qa/project-command-centre-fixture/correspondenceFixture';
import { ApiError } from '@/lib/repo/apiClient';
import ProjectCorrespondenceQuery from './ProjectCorrespondenceQuery';

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/lib/repo/apiClient', async () => ({ ...await vi.importActual<object>('@/lib/repo/apiClient'), apiJson: mocks.api }));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(correspondenceFixture.observedAt)); mocks.api.mockReset(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); document.body.innerHTML = ''; });
const flush = async () => { await act(async () => { await Promise.resolve(); }); };

describe('private correspondence lifecycle', () => {
  it.each([true, false])('measures committed evidence and only labels a matching document clock (%s)', async direct => {
    vi.stubEnv('NEXT_PUBLIC_PORTAL_EMAIL_TIMING', 'true');
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ name: direct ? location.href : 'https://example.test/another-project' } as PerformanceEntry]);
    let resolve: (reply: unknown) => void = () => {};
    mocks.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const view = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush();
    expect(view.container.querySelector('output')).toBeNull();
    clock = 1500;
    const context = { ...correspondenceFixture, messages: [{ id: 'mail-one', subject: 'Project response', from: 'customer@example.test',
      sentAt: correspondenceFixture.observedAt, receivedAt: correspondenceFixture.observedAt, observedAt: correspondenceFixture.observedAt,
      url: 'https://outlook.office.com/mail/id/one', bodyText: 'Customer response', truncated: false, association: 'customer_address_only' }] };
    await act(async () => resolve({ state: 'ready', context }));
    expect(view.container.querySelector('article')).not.toBeNull();
    const timing = view.container.querySelector('output')!;
    expect(timing.getAttribute('data-email-mount-ms')).toBe('1500');
    expect(timing.getAttribute('data-email-document-ms')).toBe(direct ? '1500' : null);
    expect(timing.hasAttribute('hidden')).toBe(true);
    view.unmount();
  });
  it('removes expired saved mail while a refresh is still waiting', async () => {
    const context = { ...correspondenceFixture, snapshot: { checkedAt: correspondenceFixture.observedAt,
      expiresAt: new Date(Date.now() + 1000).toISOString(), state: 'recent', nextAttemptAt: null } };
    mocks.api.mockResolvedValueOnce({ state: 'ready', context }).mockImplementationOnce(() => new Promise(() => undefined));
    const view = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush();
    const refresh = Array.from(view.container.querySelectorAll('button')).find(button => button.textContent === 'Check again')!;
    await act(async () => { refresh.click(); });
    expect(view.container.textContent).toContain('The customer is asking');
    await act(async () => { vi.advanceTimersByTime(1001); });
    expect(view.container.textContent).not.toContain('The customer is asking');
    view.unmount();
  });
  it('returns to authorized recent saved emails without another mailbox refresh', async () => {
    const context = { ...correspondenceFixture, snapshot: { checkedAt: correspondenceFixture.observedAt,
      expiresAt: new Date(Date.now() + 23 * 60 * 60_000).toISOString(), state: 'recent', nextAttemptAt: null } };
    mocks.api.mockResolvedValue({ state: 'ready', context });
    const first = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush(); first.unmount();
    const returned = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush();
    expect(returned.container.textContent).toContain('The customer is asking');
    expect(returned.container.textContent).toContain('Emails checked');
    expect(mocks.api.mock.calls.map(call => call[1].method)).toEqual(['GET', 'GET']);
    returned.unmount();
  });
  it.each([401, 403, 404])('never reads mail when initial access returns %s', async status => {
    mocks.api.mockRejectedValueOnce(new ApiError('Denied', { status, body: null }));
    const view = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush();
    expect(mocks.api).toHaveBeenCalledTimes(1);
    expect(mocks.api.mock.calls[0][1].method).toBe('GET');
    expect(view.container.textContent).toContain('Conversations unavailable');
    view.unmount();
  });
  it('does not read mail when correspondence is disabled', async () => {
    mocks.api.mockResolvedValueOnce({ state: 'not_connected' });
    const view = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush();
    expect(mocks.api).toHaveBeenCalledTimes(1);
    view.unmount();
  });
  it('rechecks and reloads on return without persisting private mail or invoking AI', async () => {
    mocks.api.mockResolvedValueOnce({ state: 'available' }).mockResolvedValueOnce({ state: 'ready', context: correspondenceFixture })
      .mockResolvedValueOnce({ state: 'available' }).mockResolvedValueOnce({ state: 'ready', context: correspondenceFixture });
    const first = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush(); first.unmount();
    const returned = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    expect(returned.container.textContent).not.toContain('The customer is asking');
    await flush();
    expect(returned.container.textContent).toContain('The customer is asking');
    expect(mocks.api.mock.calls.map(call => call[1].method)).toEqual(['GET', 'POST', 'GET', 'POST']);
    expect(mocks.api.mock.calls.every(call => !call[0].includes('analyze'))).toBe(true);
    returned.unmount();
  });
  it('restores an open message after the expiry access check without retaining visible evidence during the check', async () => {
    const context = { ...correspondenceFixture, messages: [{ id: 'mail-one', subject: 'Project response', from: 'customer@example.test',
      sentAt: correspondenceFixture.observedAt, receivedAt: correspondenceFixture.observedAt, observedAt: correspondenceFixture.observedAt,
      url: 'https://outlook.office.com/mail/id/one', bodyText: 'Read this full customer response. '.repeat(30), truncated: false, association: 'customer_address_only' }] };
    let resolveAccess: (value: unknown) => void = () => undefined;
    mocks.api.mockResolvedValueOnce({ state: 'available' }).mockResolvedValueOnce({ state: 'ready', context })
      .mockImplementationOnce(() => new Promise(resolve => { resolveAccess = resolve; }));
    const view = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush();
    const details = view.container.querySelector('article details') as HTMLDetailsElement;
    await act(async () => { details.open = true; details.dispatchEvent(new Event('toggle')); });
    await act(async () => { vi.advanceTimersByTime(120001); });
    expect(view.container.querySelector('article')).toBeNull();
    await act(async () => { resolveAccess({ state: 'available' }); });
    expect((view.container.querySelector('article details') as HTMLDetailsElement).open).toBe(true);
    expect(view.container.textContent).toContain('Earlier conversation summary');
    view.unmount();
  });
  it('requests AI only after the separate interpretation action', async () => {
    mocks.api.mockResolvedValueOnce({ state: 'available' })
      .mockResolvedValueOnce({ state: 'ready', context: { ...correspondenceFixture, analysisAvailable: false } })
      .mockResolvedValueOnce({ state: 'ready', context: { ...correspondenceFixture, analysisAvailable: true } });
    const view = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush();
    expect(mocks.api.mock.calls[1][0]).not.toContain('analyze');
    const analyze = Array.from(view.container.querySelectorAll('button')).find(button => button.textContent === 'Ask AI to interpret these emails')!;
    expect(analyze).toBeDefined();
    await act(async () => { analyze.click(); });
    expect(mocks.api.mock.calls[2][0]).toContain('?analyze=true');
    expect(view.container.textContent).toContain('AI interpretation and suggestions');
    view.unmount();
  });
  it('reads mail on opening after availability, then only rechecks access at expiry', async () => {
    mocks.api.mockResolvedValueOnce({ state: 'available' }).mockResolvedValueOnce({ state: 'ready', context: correspondenceFixture }).mockResolvedValueOnce({ state: 'available' });
    const view = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush();
    expect(mocks.api).toHaveBeenCalledTimes(2);
    expect(mocks.api.mock.calls[0][1].method).toBe('GET');
    expect(mocks.api.mock.calls[1][1]).toMatchObject({ method: 'POST', skipSaveTracking: true, cache: 'no-store' });
    expect(view.container.textContent).toContain('The customer is asking');
    await act(async () => { vi.advanceTimersByTime(120001); });
    expect(view.container.textContent).toContain('The customer is asking');
    expect(view.container.textContent).toContain('Earlier conversation summary');
    expect(mocks.api.mock.calls.map(call => call[1].method)).toEqual(['GET', 'POST', 'GET']);
    view.unmount();
  });
  it('hides evidence while away and restores it only after access recheck without a model refresh', async () => {
    mocks.api.mockResolvedValueOnce({ state: 'available' }).mockResolvedValueOnce({ state: 'ready', context: correspondenceFixture }).mockResolvedValueOnce({ state: 'available' });
    const view = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(view.container.textContent).not.toContain('The customer is asking');
    expect(mocks.api).toHaveBeenCalledTimes(2);
    visibility.mockReturnValue('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(view.container.textContent).toContain('The customer is asking');
    expect(mocks.api.mock.calls.map(call => call[1].method)).toEqual(['GET', 'POST', 'GET']);
    view.unmount();
  });
  it('does not restore private evidence if access ended while viewing the source', async () => {
    mocks.api.mockResolvedValueOnce({ state: 'available' }).mockResolvedValueOnce({ state: 'ready', context: correspondenceFixture })
      .mockRejectedValueOnce(new ApiError('Denied', { status: 403, body: null }));
    const view = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    visibility.mockReturnValue('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(view.container.textContent).not.toContain('The customer is asking');
    expect(view.container.textContent).toContain('Conversations unavailable');
    view.unmount();
  });
  it.each([401, 403, 404])('discards earlier evidence when a refresh returns %s', async status => {
    mocks.api.mockResolvedValueOnce({ state: 'available' }).mockResolvedValueOnce({ state: 'ready', context: correspondenceFixture })
      .mockRejectedValueOnce(new ApiError('Denied', { status, body: null }));
    const onAccessEnding = vi.fn();
    const view = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" onAccessEnding={onAccessEnding} />);
    await flush();
    await act(async () => { (view.container.querySelector('button') as HTMLButtonElement).click(); });
    expect(view.container.textContent).not.toContain('The customer is asking');
    expect(onAccessEnding).toHaveBeenCalledWith(status);
    view.unmount();
  });
  it('aborts a pending check on unmount and ignores its late private result', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mocks.api.mockResolvedValueOnce({ state: 'available' }).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const view = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush();
    const signal = mocks.api.mock.calls[1][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { resolve({ state: 'ready', context: correspondenceFixture }); });
    expect(document.body.textContent).not.toContain('The customer is asking');
  });
});
