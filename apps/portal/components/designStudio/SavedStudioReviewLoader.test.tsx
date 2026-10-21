import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import SavedStudioReviewLoader from './SavedStudioReviewLoader';

const mocks = vi.hoisted(() => ({ api: vi.fn(), saved: vi.fn(), website: vi.fn(), actorId: 'actor' as string | undefined }));
vi.mock('@/lib/repo/apiClient', () => ({ apiJson: mocks.api }));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => ({ user: mocks.actorId ? { id: mocks.actorId } : null, role: 'staff' }) }));
vi.mock('./studioLeafLoading', () => ({ loadSavedStudioReview: mocks.saved, loadStudioWebsiteReview: mocks.website }));
const review = () => ({ estimate: { id: 'est_one', projectId: 'proj_one' }, websiteComposition: { pergolas: [] } });
const Website = (props: Record<string, unknown>) => <div data-testid="website">{JSON.stringify(props)}</div>;
const Saved = (props: Record<string, unknown>) => <div data-testid="saved">{JSON.stringify(props)}</div>;
const mounted: ReturnType<typeof renderIntoDocument>[] = [];
beforeEach(() => {
  vi.resetAllMocks(); mocks.actorId = 'actor';
  mocks.api.mockResolvedValue({ review: review() });
  mocks.saved.mockResolvedValue(Saved); mocks.website.mockResolvedValue(Website);
});
afterEach(() => mounted.splice(0).forEach(value => value.unmount()));
async function mount(quoteVersionId?: string) {
  const rendered = renderIntoDocument(<SavedStudioReviewLoader projectId="proj_one" estimateId="est_one" quoteVersionId={quoteVersionId} />);
  mounted.push(rendered); await act(async () => {}); return rendered.container;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

it('preloads leaves with the API read and waits for the selected website leaf', async () => {
  const data = deferred<{ review: ReturnType<typeof review> }>(), leaf = deferred<typeof Website>();
  mocks.api.mockReturnValue(data.promise); mocks.website.mockReturnValue(leaf.promise);
  const container = await mount();
  expect(mocks.api).toHaveBeenCalledTimes(1);
  expect(mocks.saved).toHaveBeenCalledTimes(1); expect(mocks.website).toHaveBeenCalledTimes(1);
  await act(async () => data.resolve({ review: review() }));
  expect(container.textContent).toContain('Opening saved design');
  await act(async () => leaf.resolve(Website));
  expect(JSON.parse(container.querySelector('[data-testid="website"]')!.textContent!)).toEqual({ review: review(), actorId: 'actor' });
});

it.each(['website', 'saved'] as const)('retries a failed %s leaf while retaining the selected review identity', async kind => {
  mocks[kind].mockResolvedValueOnce(null);
  const container = await mount(kind === 'saved' ? 'qv_frozen' : undefined);
  expect(container.textContent).toContain('The design review could not be opened');
  await act(async () => (container.querySelector('button') as HTMLButtonElement).click());
  expect(mocks[kind]).toHaveBeenCalledTimes(2);
  expect(container.querySelector(`[data-testid="${kind}"]`)).not.toBeNull();
  expect(mocks.api.mock.calls[1][0]).toBe(`/api/projects/proj_one/estimates/est_one/studio-review${kind === 'saved' ? '?quoteVersionId=qv_frozen' : ''}`);
});

it('loads only the saved review for an exact quote version and preserves navigation props', async () => {
  const container = await mount('qv_frozen');
  expect(mocks.website).not.toHaveBeenCalled();
  expect(JSON.parse(container.querySelector('[data-testid="saved"]')!.textContent!)).toEqual({
    review: review(), projectId: 'proj_one', editHref: '/staff/design-studio/proj_one/est_one/edit',
    revisionHref: '/staff/design-studio/proj_one/est_one/edit?intent=revision',
  });
});

it('does not let unused website code block a legacy saved review', async () => {
  mocks.website.mockReturnValue(new Promise(() => {}));
  mocks.api.mockResolvedValue({ review: { ...review(), websiteComposition: null } });
  expect((await mount()).querySelector('[data-testid="saved"]')).not.toBeNull();
});

it('discards a pending website completion after changing to an exact quote version', async () => {
  const leaf = deferred<typeof Website>(); mocks.website.mockReturnValue(leaf.promise);
  await mount();
  const signal = mocks.api.mock.calls[0][1].signal as AbortSignal;
  await act(async () => mounted[0].rerender(<SavedStudioReviewLoader projectId="proj_one" estimateId="est_one" quoteVersionId="qv_frozen" />));
  expect(signal.aborted).toBe(true);
  await act(async () => leaf.resolve(Website));
  expect(mounted[0].container.querySelector('[data-testid="website"]')).toBeNull();
  expect(mounted[0].container.querySelector('[data-testid="saved"]')).not.toBeNull();
});

it('does not fetch or preload before staff identity is available', async () => {
  mocks.actorId = undefined;
  expect((await mount()).textContent).toContain('Opening saved design');
  expect(mocks.api).not.toHaveBeenCalled(); expect(mocks.saved).not.toHaveBeenCalled(); expect(mocks.website).not.toHaveBeenCalled();
});

it('preserves source validation and does not wait for a leaf after a data failure', async () => {
  mocks.website.mockReturnValue(new Promise(() => {}));
  mocks.api.mockResolvedValue({ review: { ...review(), estimate: { id: 'wrong', projectId: 'proj_one' } } });
  const container = await mount();
  expect(container.textContent).toContain('Your saved design could not be loaded');
  expect(container.querySelector('[data-testid="website"]')).toBeNull();
});

it('cancels pending completion on sign-out and unmount', async () => {
  const leaf = deferred<typeof Website>(); mocks.website.mockReturnValue(leaf.promise);
  await mount(); const signal = mocks.api.mock.calls[0][1].signal as AbortSignal;
  mocks.actorId = undefined;
  await act(async () => mounted[0].rerender(<SavedStudioReviewLoader projectId="proj_one" estimateId="est_one" />));
  expect(signal.aborted).toBe(true);
  await act(async () => leaf.resolve(Website));
  expect(mounted[0].container.querySelector('[data-testid="website"]')).toBeNull();
  mounted.pop()!.unmount();
});
