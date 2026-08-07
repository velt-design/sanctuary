'use client';

import {
  getLocalFirstStoreOwner,
  getLocalFirstStoreSnapshot,
  summarizeLocalFirstStoreState,
} from './store';

const CHANNEL_NAME = 'sanctuary-portal-local-first-boundary-v1';
const DEFAULT_CHECK_TIMEOUT_MS = 180;

type RetainedWorkStatus = 'clear' | 'retained' | 'unknown';

type CheckRequest = {
  type: 'PORTAL_RETAINED_WORK_CHECK';
  ownerId: string;
  token: string;
};

type CheckResponse = {
  type: 'PORTAL_RETAINED_WORK_STATUS';
  ownerId: string;
  status: RetainedWorkStatus;
  token: string;
};

function retainedWorkStatus(ownerId: string): RetainedWorkStatus | null {
  if (getLocalFirstStoreOwner() !== ownerId) return null;
  const snapshot = getLocalFirstStoreSnapshot();
  if (!snapshot.hydrated) return 'unknown';
  const summary = summarizeLocalFirstStoreState(snapshot.state);
  return summary.pendingCount > 0
    || summary.conflictCount > 0
    || summary.errorCount > 0
    || summary.workingCopyCount > 0
    ? 'retained'
    : 'clear';
}

function isCheckRequest(value: unknown): value is CheckRequest {
  const candidate = value as Partial<CheckRequest> | null;
  return Boolean(
    candidate
      && candidate.type === 'PORTAL_RETAINED_WORK_CHECK'
      && typeof candidate.ownerId === 'string'
      && candidate.ownerId
      && typeof candidate.token === 'string'
      && candidate.token,
  );
}

function isCheckResponse(value: unknown): value is CheckResponse {
  const candidate = value as Partial<CheckResponse> | null;
  return Boolean(
    candidate
      && candidate.type === 'PORTAL_RETAINED_WORK_STATUS'
      && typeof candidate.ownerId === 'string'
      && candidate.ownerId
      && typeof candidate.token === 'string'
      && candidate.token
      && (
        candidate.status === 'clear'
        || candidate.status === 'retained'
        || candidate.status === 'unknown'
      ),
  );
}

export function installPortalRetainedWorkResponder(): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  let channel: BroadcastChannel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return () => {};
  }
  const handleMessage = (event: MessageEvent) => {
    if (!isCheckRequest(event.data)) return;
    const status = retainedWorkStatus(event.data.ownerId);
    if (!status) return;
    channel.postMessage({
      type: 'PORTAL_RETAINED_WORK_STATUS',
      ownerId: event.data.ownerId,
      status,
      token: event.data.token,
    } satisfies CheckResponse);
  };
  channel.addEventListener('message', handleMessage);
  return () => channel.close();
}

export async function queryPortalOwnerRetainedWork(
  ownerId: string,
  timeoutMs = DEFAULT_CHECK_TIMEOUT_MS,
): Promise<RetainedWorkStatus> {
  if (!ownerId || typeof BroadcastChannel === 'undefined') return 'unknown';
  let channel: BroadcastChannel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return 'unknown';
  }

  const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return new Promise<RetainedWorkStatus>((resolve) => {
    let settled = false;
    let responseCount = 0;
    let uncertain = false;
    const finish = (status: RetainedWorkStatus) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      channel.close();
      resolve(status);
    };
    const handleMessage = (event: MessageEvent) => {
      if (!isCheckResponse(event.data)) return;
      if (event.data.ownerId !== ownerId || event.data.token !== token) return;
      responseCount += 1;
      if (event.data.status === 'retained') {
        finish('retained');
      } else if (event.data.status === 'unknown') {
        uncertain = true;
      }
    };
    channel.addEventListener('message', handleMessage);
    const timer = window.setTimeout(() => {
      finish(responseCount > 0 && !uncertain ? 'clear' : 'unknown');
    }, Math.max(25, Math.min(timeoutMs, 1_000)));
    channel.postMessage({
      type: 'PORTAL_RETAINED_WORK_CHECK',
      ownerId,
      token,
    } satisfies CheckRequest);
  });
}
