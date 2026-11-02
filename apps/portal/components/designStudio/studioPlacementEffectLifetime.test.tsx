import { act, StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { studioAttachmentFixture } from '../../../../test/studioAttachmentFixture';
import { studioPreparationReply } from '../../../../test/studioPlacementTestWorker';
import { createStudioSceneResolver } from '@/lib/designStudio/interaction/resolvedScene';
import { useStudioDirectPlacement } from './useStudioDirectPlacement';
import type { StudioPreparationRequest, StudioPreparationReply } from './studioPlacementPreparation';

const edit = studioAttachmentFixture(), scene = createStudioSceneResolver().resolve(edit);
class TestWorker {
  onmessage: ((event: MessageEvent<StudioPreparationReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  requests: StudioPreparationRequest[] = [];
  constructor() { workers.push(this); }
  postMessage(request: StudioPreparationRequest) { this.requests.push(request); }
  terminate() { this.terminated = true; }
  reply(stale = false) {
    const data = studioPreparationReply(this.requests.at(-1)!);
    if (stale) data.result = { kind: 'refused', reason: 'Obsolete worker result' };
    this.onmessage?.({ data } as MessageEvent<StudioPreparationReply>);
  }
}
const workers: TestWorker[] = [];
let latest: ReturnType<typeof useStudioDirectPlacement>, mounted: ReturnType<typeof renderIntoDocument> | undefined;
function Harness({ epoch = 'first' }: { epoch?: string }) {
  latest = useStudioDirectPlacement({ edit, scene, pendingScene: null, locked: false, pending: null, selectedId: 'p2', session: { identity: { scopeKey: 'synthetic:test', epoch, generation: 0 }, transact: () => ({ kind: 'refused', reason: 'No command in this preparation test' }) }, onAccepted: () => {} });
  return <p>{latest.message}</p>;
}
async function warm() {
  for (let count = 0; count < 6 && latest.readiness('p2', 'facade').kind === 'preparing'; count++) await act(async () => workers.at(-1)!.reply());
  expect(latest.readiness('p2', 'facade').kind).toBe('ready');
  expect(mounted!.container.textContent).not.toContain('Preparing connections');
}
beforeEach(() => { workers.length = 0; vi.stubGlobal('Worker', TestWorker); });
afterEach(() => { mounted?.unmount(); mounted = undefined; vi.unstubAllGlobals(); });

it.each([false, true])('warms the actual hook after effect replay=%s and rejects terminated-owner replies', async replay => {
  mounted = renderIntoDocument(replay ? <StrictMode><Harness /></StrictMode> : <Harness />);
  await act(async () => {});
  expect(workers.filter(worker => !worker.terminated)).toHaveLength(1);
  expect(workers).toHaveLength(replay ? 2 : 1);
  expect(workers.at(-1)!.requests[0].task).toMatchObject({ objectId: 'p2', method: 'facade' });
  await warm();
  if (replay) {
    expect(workers[0].terminated).toBe(true);
    await act(async () => workers[0].reply(true));
    expect(latest.readiness('p2', 'facade').kind).toBe('ready');
    expect(mounted.container.textContent).not.toContain('Obsolete');
  }
});
it('retires the old epoch irreversibly and warms a fresh scheduler without accepting its late result', async () => {
  mounted = renderIntoDocument(<Harness />);
  const old = workers[0];
  mounted.rerender(<Harness epoch="second" />);
  expect(old.terminated).toBe(true); expect(workers).toHaveLength(2);
  expect(latest.readiness('p2', 'facade').kind).toBe('preparing');
  await act(async () => old.reply(true));
  expect(latest.readiness('p2', 'facade').kind).toBe('preparing'); expect(mounted.container.textContent).not.toContain('Obsolete');
  expect(workers[1].requests[0].epoch).toBe('second'); await warm();
});
it('terminates its captured worker on unmount and never starts another from a late message', async () => {
  mounted = renderIntoDocument(<StrictMode><Harness /></StrictMode>);
  const current = workers.at(-1)!, count = workers.length;
  mounted.unmount(); mounted = undefined; expect(current.terminated).toBe(true);
  await act(async () => current.reply()); expect(workers).toHaveLength(count); expect(workers.every(worker => worker.terminated)).toBe(true);
});
