import { describe, expect, it } from 'vitest';
import {
  beginPortalCleanupQuarantine,
  completePortalCleanupQuarantine,
  portalCleanupQuarantineStorageKey,
  readPortalCleanupQuarantine,
} from './portalCleanupQuarantine';

function memoryStorage(options: { blocked?: boolean } = {}) {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem(key: string) {
        if (options.blocked) throw new DOMException('blocked', 'SecurityError');
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (options.blocked) throw new DOMException('blocked', 'SecurityError');
        values.set(key, value);
      },
      removeItem(key: string) {
        if (options.blocked) throw new DOMException('blocked', 'SecurityError');
        values.delete(key);
      },
    },
  };
}

function memoryCookieDocument() {
  const values = new Map<string, string>();
  return {
    values,
    document: {
      get cookie() {
        return Array.from(values, ([key, value]) => `${key}=${value}`).join('; ');
      },
      set cookie(serialized: string) {
        const [pair] = serialized.split(';');
        const separator = pair.indexOf('=');
        const key = pair.slice(0, separator);
        const value = pair.slice(separator + 1);
        if (/Max-Age=0(?:;|$)/i.test(serialized)) values.delete(key);
        else values.set(key, value);
      },
    },
  };
}

describe('portal cleanup quarantine', () => {
  it('survives a reload and clears both durable copies only after completion', () => {
    const local = memoryStorage();
    const cookie = memoryCookieDocument();
    const marker = beginPortalCleanupQuarantine('user-a', local.storage, cookie.document);

    expect(readPortalCleanupQuarantine(local.storage, cookie.document)).toEqual(marker);
    expect(local.values.has(portalCleanupQuarantineStorageKey)).toBe(true);
    expect(cookie.values.size).toBe(1);

    completePortalCleanupQuarantine(marker, local.storage, cookie.document);

    expect(readPortalCleanupQuarantine(local.storage, cookie.document)).toBeNull();
    expect(local.values.size).toBe(0);
    expect(cookie.values.size).toBe(0);
  });

  it('uses the same-origin cookie when localStorage is blocked', () => {
    const local = memoryStorage({ blocked: true });
    const cookie = memoryCookieDocument();

    const marker = beginPortalCleanupQuarantine('user-a', local.storage, cookie.document);

    expect(readPortalCleanupQuarantine(null, cookie.document)).toEqual(marker);
    completePortalCleanupQuarantine(marker, null, cookie.document);
    expect(readPortalCleanupQuarantine(null, cookie.document)).toBeNull();
  });

  it('strengthens a legacy-only entry marker when that owner departs mid-cleanup', () => {
    const local = memoryStorage();
    const cookie = memoryCookieDocument();
    const entryMarker = beginPortalCleanupQuarantine(null, local.storage, cookie.document);

    const ownerMarker = beginPortalCleanupQuarantine('user-a', local.storage, cookie.document);

    expect(ownerMarker.token).toBe(entryMarker.token);
    expect(ownerMarker.departingOwnerId).toBe('user-a');
    expect(() => completePortalCleanupQuarantine(entryMarker, local.storage, cookie.document))
      .toThrow('changed before cleanup completed');
    expect(readPortalCleanupQuarantine(local.storage, cookie.document)).toEqual(ownerMarker);
  });

  it('fails closed when neither reload-safe marker store is writable', () => {
    const local = memoryStorage({ blocked: true });
    expect(() => beginPortalCleanupQuarantine('user-a', local.storage, null))
      .toThrow('could not persist');
  });
});
