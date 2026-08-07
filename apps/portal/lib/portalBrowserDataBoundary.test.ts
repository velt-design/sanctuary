import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  delMock,
  discardAllMock,
  clearOwnerMock,
  getOwnerMock,
  stopRuntimeMock,
} = vi.hoisted(() => ({
  delMock: vi.fn(),
  discardAllMock: vi.fn(),
  clearOwnerMock: vi.fn(),
  getOwnerMock: vi.fn(),
  stopRuntimeMock: vi.fn(),
}));

vi.mock('idb-keyval', () => ({ del: delMock }));
vi.mock('@/lib/localFirst/store', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/localFirst/store')>();
  return {
    ...original,
    discardAllLocalFirstState: discardAllMock,
    clearLocalFirstStoreOwner: clearOwnerMock,
    getLocalFirstStoreOwner: getOwnerMock,
  };
});
vi.mock('@/lib/localFirst/runtime', () => ({ stopLocalFirstRuntime: stopRuntimeMock }));

import {
  purgePortalLegacyUnscopedBrowserData,
  purgePortalOwnerBrowserData,
} from './portalBrowserDataBoundary';

function mapStorage(initial: Array<[string, string]>) {
  const values = new Map(initial);
  return {
    values,
    storage: {
      get length() {
        return values.size;
      },
      key(index: number) {
        return Array.from(values.keys())[index] ?? null;
      },
      removeItem(key: string) {
        values.delete(key);
      },
    },
  };
}

describe('portal browser-data owner boundary', () => {
  beforeEach(() => {
    delMock.mockReset().mockResolvedValue(undefined);
    discardAllMock.mockReset().mockResolvedValue(undefined);
    clearOwnerMock.mockReset();
    getOwnerMock.mockReset().mockReturnValue('user-a');
    stopRuntimeMock.mockReset();
  });

  it('purges the departing owner drafts, caches, and sensitive legacy storage', async () => {
    const local = mapStorage([
      ['sanctuary-portal:portal-role-cache:v1', 'user-a'],
      ['sanctuary:quote-delivery:quote-a:send', 'intent-a'],
      ['sp_contacts_v1', 'customer-a'],
      ['sp_projects_v1', 'project-a'],
      ['sp_schedule_items_v1', 'schedule-a'],
      ['sp_installers_v1', 'installer-a'],
      ['sp.schedule.board.hiddenCrewIds.v1', 'crew-a'],
      ['sanctuary-portal:theme:v1:user-a', 'theme-a'],
      ['sanctuary-portal:theme:v1:user-b', 'theme-b'],
      ['sanctuary-portal:calculator:uiMode:v1', 'advanced'],
    ]);
    const session = mapStorage([
      ['sanctuary-portal:calculator:draft:v2:user-a:project-a:new', 'draft-a'],
      ['sanctuary-portal:calculator:draft:v2:user-b:project-b:new', 'draft-b'],
      ['sanctuary-portal:calculator:draft:v1:legacy:new', 'legacy-draft'],
    ]);

    await purgePortalOwnerBrowserData('user-a', {
      localStorage: local.storage,
      sessionStorage: session.storage,
    });

    expect(stopRuntimeMock).toHaveBeenCalledWith({ clearOwner: false });
    expect(discardAllMock).toHaveBeenCalledOnce();
    expect(clearOwnerMock).toHaveBeenCalledOnce();
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-local-first:v2:user-a');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-react-query:v4:user-a');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-local-first-v1');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-react-query');
    expect(local.values.get('sanctuary-portal:calculator:uiMode:v1')).toBe('advanced');
    expect(local.values.has('sanctuary:quote-delivery:quote-a:send')).toBe(false);
    expect(local.values.has('sp_contacts_v1')).toBe(false);
    expect(local.values.has('sanctuary-portal:theme:v1:user-a')).toBe(false);
    expect(local.values.get('sanctuary-portal:theme:v1:user-b')).toBe('theme-b');
    expect(session.values.has('sanctuary-portal:calculator:draft:v2:user-a:project-a:new')).toBe(false);
    expect(session.values.get('sanctuary-portal:calculator:draft:v2:user-b:project-b:new')).toBe('draft-b');
    expect(session.values.has('sanctuary-portal:calculator:draft:v1:legacy:new')).toBe(false);
  });

  it('clears legacy unscoped data without deleting the freshly verified owner drafts', async () => {
    const local = mapStorage([
      ['sp_contacts_v1', 'departing-customer'],
      ['sp_projects_v1', 'departing-project'],
      ['sanctuary-portal:theme:v1:user-b', 'current-theme'],
    ]);
    const session = mapStorage([
      ['sanctuary-portal:calculator:draft:v1:legacy:new', 'legacy-draft'],
      ['sanctuary-portal:calculator:draft:v2:user-b:project:new', 'current-draft'],
    ]);

    await purgePortalLegacyUnscopedBrowserData({
      localStorage: local.storage,
      sessionStorage: session.storage,
    });

    expect(local.values.has('sp_contacts_v1')).toBe(false);
    expect(local.values.get('sanctuary-portal:theme:v1:user-b')).toBe('current-theme');
    expect(session.values.has('sanctuary-portal:calculator:draft:v1:legacy:new')).toBe(false);
    expect(session.values.get('sanctuary-portal:calculator:draft:v2:user-b:project:new')).toBe('current-draft');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-local-first-v1');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-react-query');
    expect(delMock).not.toHaveBeenCalledWith('sanctuary-portal-local-first:v2:user-b');
  });

  it('removes persisted owner stores even when that owner is not mounted', async () => {
    getOwnerMock.mockReturnValue('user-b');

    await purgePortalOwnerBrowserData('user-a', {
      localStorage: mapStorage([]).storage,
      sessionStorage: mapStorage([]).storage,
    });

    expect(stopRuntimeMock).not.toHaveBeenCalled();
    expect(discardAllMock).not.toHaveBeenCalled();
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-local-first:v2:user-a');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-react-query:v4:user-a');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-local-first-v1');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-react-query');
  });

  it('fails closed when an owner-scoped persisted cache cannot be cleared', async () => {
    delMock.mockImplementation((key: unknown) => key === 'sanctuary-portal-react-query:v4:user-a'
      ? Promise.reject(new Error('indexeddb unavailable'))
      : Promise.resolve());

    await expect(purgePortalOwnerBrowserData('user-a', {
      localStorage: mapStorage([]).storage,
      sessionStorage: mapStorage([]).storage,
    })).rejects.toThrow('Unable to clear all portal data for the departing user.');

    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-local-first:v2:user-a');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-react-query:v4:user-a');
  });

  it('fails closed when a shipped unscoped legacy cache cannot be cleared', async () => {
    delMock.mockImplementation((key: unknown) => key === 'sanctuary-portal-react-query'
      ? Promise.reject(new Error('legacy indexeddb unavailable'))
      : Promise.resolve());

    await expect(purgePortalOwnerBrowserData('user-a', {
      localStorage: mapStorage([]).storage,
      sessionStorage: mapStorage([]).storage,
    })).rejects.toThrow('Unable to clear all portal data for the departing user.');

    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-local-first:v2:user-a');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-react-query:v4:user-a');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-local-first-v1');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-react-query');
  });

  it('still attempts IndexedDB cleanup when browser storage is unavailable', async () => {
    const inaccessibleStorage = {
      get length(): number {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
      key: vi.fn(() => null),
      removeItem: vi.fn(() => {
        throw new DOMException('Storage blocked', 'SecurityError');
      }),
    };

    await expect(purgePortalOwnerBrowserData('user-a', {
      localStorage: inaccessibleStorage,
      sessionStorage: inaccessibleStorage,
    })).rejects.toThrow('Unable to clear all portal data for the departing user.');

    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-local-first:v2:user-a');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-react-query:v4:user-a');
  });

  it('releases the mounted owner even when discarding its local-first state fails', async () => {
    discardAllMock.mockRejectedValueOnce(new Error('discard unavailable'));

    await expect(purgePortalOwnerBrowserData('user-a', {
      localStorage: mapStorage([]).storage,
      sessionStorage: mapStorage([]).storage,
    })).rejects.toThrow('Unable to clear all portal data for the departing user.');

    expect(clearOwnerMock).toHaveBeenCalledOnce();
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-local-first:v2:user-a');
    expect(delMock).toHaveBeenCalledWith('sanctuary-portal-react-query:v4:user-a');
  });
});
