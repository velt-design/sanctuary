import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import { correspondenceFixture } from '@/app/qa/project-command-centre-fixture/correspondenceFixture';
import ProjectCorrespondenceQuery from './ProjectCorrespondenceQuery';
import { ProjectCorrespondenceWarmRead } from './ProjectCorrespondenceWarmRead';
import { ApiError } from '@/lib/repo/apiClient';

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/lib/repo/apiClient', async () => ({ ...await vi.importActual<object>('@/lib/repo/apiClient'), apiJson: mocks.api }));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(correspondenceFixture.observedAt)); mocks.api.mockReset(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const tree = (show: boolean, projectId = 'proj_1', enabled = true) => <ProjectCorrespondenceWarmRead projectId={projectId} enabled={enabled}>
  {show ? <ProjectCorrespondenceQuery projectId={projectId} /> : <span>Opening project</span>}
</ProjectCorrespondenceWarmRead>;

describe('page-scoped early correspondence read', () => {
  it('propagates an early access denial through the existing access-ending handler', async () => {
    mocks.api.mockRejectedValue(new ApiError('Forbidden', { status: 403, body: null }));
    const denied = vi.fn();
    const view = renderIntoDocument(tree(false));
    await flush();
    view.rerender(<ProjectCorrespondenceWarmRead projectId="proj_1" enabled>
      <ProjectCorrespondenceQuery projectId="proj_1" onAccessEnding={denied} />
    </ProjectCorrespondenceWarmRead>);
    await flush();
    expect(denied).toHaveBeenCalledWith(403);
    expect(view.container.textContent).not.toContain('The customer is asking');
    expect(mocks.api).toHaveBeenCalledTimes(2);
    view.unmount();
  });
  it('starts while the project shell waits, then hands off without another request', async () => {
    let resolve: (value: unknown) => void = () => {};
    mocks.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const view = renderIntoDocument(tree(false));
    await flush();
    expect(mocks.api).toHaveBeenCalledTimes(1);
    expect(view.container.textContent).not.toContain('The customer is asking');
    view.rerender(tree(true));
    await flush();
    expect(mocks.api).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ state: 'ready', context: correspondenceFixture }));
    expect(view.container.textContent).toContain('The customer is asking');
    view.unmount();
  });
  it('does not duplicate the read when the shell is already ready', async () => {
    mocks.api.mockResolvedValue({ state: 'ready', context: correspondenceFixture });
    const view = renderIntoDocument(tree(true));
    await flush();
    expect(mocks.api).toHaveBeenCalledTimes(1);
    view.unmount();
  });
  it('discards unclaimed reads after 15 seconds and reads afresh when mounted later', async () => {
    mocks.api.mockImplementationOnce(() => new Promise(() => undefined)).mockResolvedValue({ state: 'ready', context: correspondenceFixture });
    const view = renderIntoDocument(tree(false));
    await flush();
    const signal = mocks.api.mock.calls[0][1].signal;
    await act(async () => vi.advanceTimersByTime(15_001));
    expect(signal.aborted).toBe(true);
    view.rerender(tree(true));
    await flush();
    expect(mocks.api).toHaveBeenCalledTimes(2);
    view.unmount();
  });
  it.each(['changed customer', 'revoked access'])('does not display completed early evidence after %s', async reason => {
    mocks.api.mockResolvedValueOnce({ state: 'ready', context: correspondenceFixture });
    if (reason === 'revoked access') mocks.api.mockRejectedValue(new ApiError('Forbidden', { status: 403, body: null }));
    else mocks.api.mockResolvedValue({ state: 'ready', context: { ...correspondenceFixture,
      answer: { sections: correspondenceFixture.answer.sections.map(section => ({ ...section, answer: 'New customer evidence' })) } } });
    const view = renderIntoDocument(tree(false));
    await flush();
    view.rerender(tree(true));
    await flush();
    expect(mocks.api).toHaveBeenCalledTimes(2);
    expect(view.container.textContent).not.toContain('The customer is asking');
    if (reason === 'changed customer') expect(view.container.textContent).toContain('New customer evidence');
    view.unmount();
  });
  it('aborts old project reads on navigation and never shows their later response', async () => {
    let resolve: (value: unknown) => void = () => {};
    mocks.api.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue({ state: 'not_connected' });
    const view = renderIntoDocument(tree(false));
    await flush();
    const signal = mocks.api.mock.calls[0][1].signal;
    view.rerender(tree(true, 'proj_2'));
    await flush();
    await act(async () => resolve({ state: 'ready', context: correspondenceFixture }));
    expect(signal.aborted).toBe(true);
    expect(view.container.textContent).not.toContain('The customer is asking');
    view.unmount();
  });
  it('does not warm other tabs or retain a hidden-page result', async () => {
    mocks.api.mockResolvedValue({ state: 'ready', context: correspondenceFixture });
    const view = renderIntoDocument(tree(false, 'proj_1', false));
    await flush();
    expect(mocks.api).not.toHaveBeenCalled();
    view.rerender(tree(false));
    await flush();
    const signal = mocks.api.mock.calls[0][1].signal;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(signal.aborted).toBe(true);
    view.unmount();
  });
});
