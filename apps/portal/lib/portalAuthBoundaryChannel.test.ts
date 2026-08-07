import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  publishPortalAuthBoundary,
  subscribeToPortalAuthBoundary,
} from './portalAuthBoundaryChannel';

class TestBroadcastChannel {
  static instances: TestBroadcastChannel[] = [];
  readonly listeners = new Set<(event: MessageEvent) => void>();
  readonly postMessage = vi.fn();
  readonly close = vi.fn();

  constructor(readonly name: string) {
    TestBroadcastChannel.instances.push(this);
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  emit(data: unknown) {
    for (const listener of this.listeners) listener({ data } as MessageEvent);
  }
}

describe('portal auth boundary channel', () => {
  afterEach(() => {
    TestBroadcastChannel.instances = [];
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('publishes an owner-scoped lock over BroadcastChannel and storage', () => {
    vi.stubGlobal('BroadcastChannel', TestBroadcastChannel);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    publishPortalAuthBoundary('user-a', 'signed-out');

    const channel = TestBroadcastChannel.instances[0];
    expect(channel.name).toBe('sanctuary-portal-auth-boundary-v1');
    expect(channel.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'user-a',
      reason: 'signed-out',
    }));
    expect(setItem).toHaveBeenCalledWith(
      'sanctuary-portal:auth-boundary:v1',
      expect.stringContaining('"ownerId":"user-a"'),
    );
    expect(channel.close).toHaveBeenCalled();
  });

  it('delivers destructive boundaries after suspension and ignores malformed events', () => {
    vi.stubGlobal('BroadcastChannel', TestBroadcastChannel);
    const listener = vi.fn();
    const unsubscribe = subscribeToPortalAuthBoundary(listener);
    const channel = TestBroadcastChannel.instances[0];

    channel.emit({
      ownerId: 'user-a',
      reason: 'access-lost',
      sentAt: Date.now(),
      sourceId: 'another-tab',
      token: 'fresh',
    });
    channel.emit({
      ownerId: 'user-a',
      reason: 'signed-out',
      sentAt: Date.now() - 31_000,
      sourceId: 'another-tab',
      token: 'stale',
    });
    channel.emit({ ownerId: 'user-a' });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ token: 'fresh' }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ token: 'stale' }));
    unsubscribe();
    expect(channel.close).toHaveBeenCalled();
  });

  it('does not deliver this tab\'s own published boundary to its subscriber', () => {
    vi.stubGlobal('BroadcastChannel', TestBroadcastChannel);
    const listener = vi.fn();
    const unsubscribe = subscribeToPortalAuthBoundary(listener);
    const subscriber = TestBroadcastChannel.instances[0];

    publishPortalAuthBoundary('user-a', 'role-changed');
    const publisher = TestBroadcastChannel.instances[1];
    const published = publisher.postMessage.mock.calls[0]?.[0];
    subscriber.emit(published);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
