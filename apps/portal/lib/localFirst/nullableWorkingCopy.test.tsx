import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { useLocalWorkingCopy } from './useLocalWorkingCopy';
import { useAliasedEntitySyncState } from './useEntitySyncState';
const fixture = vi.hoisted(() => ({ snapshot: {hydrated:true}, peek: vi.fn(), alias: vi.fn(), sync: vi.fn(), write: vi.fn(), clear: vi.fn(), ready:vi.fn().mockResolvedValue(undefined) }));
vi.mock('./store', () => ({
  subscribeToLocalFirstStore: () => () => undefined, getLocalFirstStoreSnapshot: () => fixture.snapshot,
  ensureLocalFirstStoreReady: fixture.ready, getLocalFirstWorkingCopy: fixture.peek,
  getAliasedLocalFirstEntitySyncState: fixture.alias, getLocalFirstEntitySyncState: fixture.sync,
  writeLocalFirstWorkingCopy: fixture.write, clearLocalFirstWorkingCopy: fixture.clear,
}));
let copy: ReturnType<typeof useLocalWorkingCopy<string>>;
function Probe({entityKey}:{entityKey:string|null}) {
 copy = useLocalWorkingCopy(entityKey, 'server value');
 const state = useAliasedEntitySyncState(entityKey, id => id, entityKey);
 return <p>{copy.value}/{state.status}</p>;
}
afterEach(() => { document.body.innerHTML=''; vi.clearAllMocks(); });
describe('unknown local-first entity identity', () => {
 it('does not look up, reveal or write a private entity before identity exists', async () => {
  fixture.peek.mockReturnValue({data:'private marker'});
  const view=renderIntoDocument(<Probe entityKey={null}/>);
  expect(view.container.textContent).toContain('server value'); expect(view.container.textContent).not.toContain('private marker');
  expect(fixture.ready).not.toHaveBeenCalled(); expect(fixture.peek).not.toHaveBeenCalled(); expect(fixture.alias).not.toHaveBeenCalled(); expect(fixture.sync).not.toHaveBeenCalled();
  expect(copy.hydrated).toBe(false);
  await expect(copy.setWorkingCopy('new draft')).rejects.toThrow('verified entity');
  await copy.clearWorkingCopy(); expect(fixture.write).not.toHaveBeenCalled(); expect(fixture.clear).not.toHaveBeenCalled();
  view.unmount();
 });
 it('retains the ordinary matching working copy, alias and save behavior once identity is real', async () => {
  fixture.peek.mockReturnValue({data:'matching private draft'}); fixture.alias.mockReturnValue({status:'offline'});
  const view=renderIntoDocument(<Probe entityKey={null}/>);
  view.rerender(<Probe entityKey="contact:details:ct_fixture"/>);
  expect(view.container.textContent).toContain('matching private draft/offline');
  expect(fixture.alias).toHaveBeenCalledWith('contact:details:ct_fixture',expect.any(Function),'contact:details:ct_fixture');
  await act(async()=>{await copy.setWorkingCopy('edited draft'); await copy.clearWorkingCopy();});
  expect(fixture.write).toHaveBeenCalledWith({entityKey:'contact:details:ct_fixture',data:'edited draft',baseUpdatedAt:undefined});
  expect(fixture.clear).toHaveBeenCalledWith('contact:details:ct_fixture'); view.unmount();
 });
});
