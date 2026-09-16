import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import { correspondenceFixture } from '@/app/qa/project-command-centre-fixture/correspondenceFixture';
import { ApiError } from '@/lib/repo/apiClient';
import ProjectCorrespondenceQuery from './ProjectCorrespondenceQuery';

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/lib/repo/apiClient', async () => ({ ...await vi.importActual<object>('@/lib/repo/apiClient'), apiJson: mocks.api }));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(correspondenceFixture.observedAt)); mocks.api.mockReset(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });
const flush = async () => { await act(async () => { await Promise.resolve(); }); };

describe('private correspondence lifecycle', () => {
  it('requests AI only after the separate interpretation action', async () => {
    mocks.api.mockResolvedValueOnce({ state: 'available' })
      .mockResolvedValueOnce({ state: 'ready', context: { ...correspondenceFixture, analysisAvailable: false } })
      .mockResolvedValueOnce({ state: 'ready', context: { ...correspondenceFixture, analysisAvailable: true } });
    const view = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush();
    await act(async () => { (view.container.querySelector('button') as HTMLButtonElement).click(); });
    expect(mocks.api.mock.calls[1][0]).not.toContain('analyze');
    const analyze = Array.from(view.container.querySelectorAll('button')).find(button => button.textContent === 'Ask AI to interpret these emails')!;
    expect(analyze).toBeDefined();
    await act(async () => { analyze.click(); });
    expect(mocks.api.mock.calls[2][0]).toContain('?analyze=true');
    expect(view.container.textContent).toContain('AI interpretation and suggestions');
    view.unmount();
  });
  it('loads availability only and rechecks access before labelling an expired summary', async () => {
    mocks.api.mockResolvedValueOnce({ state: 'available' }).mockResolvedValueOnce({ state: 'ready', context: correspondenceFixture }).mockResolvedValueOnce({ state: 'available' });
    const view = renderIntoDocument(<ProjectCorrespondenceQuery projectId="proj_1" />);
    await flush();
    expect(mocks.api).toHaveBeenCalledTimes(1);
    expect(mocks.api.mock.calls[0][1].method).toBe('GET');
    expect(view.container.textContent).not.toContain('The customer is asking');
    await act(async () => { (view.container.querySelector('button') as HTMLButtonElement).click(); });
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
    await act(async () => { (view.container.querySelector('button') as HTMLButtonElement).click(); });
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
    await act(async () => { (view.container.querySelector('button') as HTMLButtonElement).click(); });
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
    await act(async () => { (view.container.querySelector('button') as HTMLButtonElement).click(); });
    const signal = mocks.api.mock.calls[1][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { resolve({ state: 'ready', context: correspondenceFixture }); });
    expect(document.body.textContent).not.toContain('The customer is asking');
  });
});
