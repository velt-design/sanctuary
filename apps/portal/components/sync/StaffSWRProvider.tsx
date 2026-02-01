'use client';

import { useMemo } from 'react';
import { SWRConfig, unstable_serialize } from 'swr';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { nowIso } from '@/lib/utils/time';
import { contactsSWRKey } from '@/lib/cache/contactsCache';
import { projectsSWRKey } from '@/lib/cache/projectsCache';
import { scheduleSnapshotSWRKey } from '@/lib/cache/scheduleSnapshotKey';
import { siteVisitsSnapshotSWRKey } from '@/lib/cache/siteVisitsCache';

const STORAGE_KEY = 'sp_query_cache_v1';

type PersistedCacheV1 = {
  v: 1;
  host: string | null;
  updatedAt: string;
  data: Record<string, unknown>;
};

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function currentHost(): string | null {
  return supabaseHostFromUrl(supabaseRuntimeUrl()) || null;
}

function readPersisted(host: string | null): PersistedCacheV1 | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const v = parsed as any;
  if (v.v !== 1) return null;
  const persistedHost = typeof v.host === 'string' ? v.host : null;
  if (host && persistedHost && persistedHost !== host) return null;
  if (!v.data || typeof v.data !== 'object') return null;
  return { v: 1, host: persistedHost, updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '', data: v.data as Record<string, unknown> };
}

function writePersisted(payload: PersistedCacheV1): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota/serialization failures
  }
}

function migrateLegacyEnvelope(raw: string | null): unknown {
  if (!raw) return null;
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const env = parsed as any;
  if (env.v !== 1) return null;
  return env.data ?? null;
}

function keysToPersist(): Set<string> {
  return new Set([
    unstable_serialize(contactsSWRKey()),
    unstable_serialize(projectsSWRKey()),
    unstable_serialize(scheduleSnapshotSWRKey()),
    unstable_serialize(siteVisitsSnapshotSWRKey()),
  ]);
}

class PersistedSWRMap extends Map<string, any> {
  private readonly host: string | null;
  private readonly persistKeys: Set<string>;
  private flushTimer: number | null = null;

  constructor(host: string | null, keys: Set<string>, seeded: Record<string, unknown>) {
    super();
    this.host = host;
    this.persistKeys = keys;
    for (const [k, v] of Object.entries(seeded)) {
      if (!this.persistKeys.has(k)) continue;
      super.set(k, { data: v });
    }
  }

  override set(key: string, value: any): this {
    super.set(key, value);
    if (this.persistKeys.has(key)) this.scheduleFlush();
    return this;
  }

  override delete(key: string): boolean {
    const res = super.delete(key);
    if (this.persistKeys.has(key)) this.scheduleFlush();
    return res;
  }

  private scheduleFlush(): void {
    if (typeof window === 'undefined') return;
    if (this.flushTimer != null) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      try {
        const data: Record<string, unknown> = {};
        for (const k of this.persistKeys) {
          const state = super.get(k);
          const v = state && typeof state === 'object' ? (state as any).data : undefined;
          if (typeof v === 'undefined') continue;
          data[k] = v;
        }
        writePersisted({ v: 1, host: this.host, updatedAt: nowIso(), data });
      } catch {
        // ignore
      }
    }, 250);
  }
}

export default function StaffSWRProvider({ children }: { children: React.ReactNode }) {
  const swrCache = useMemo(() => {
    if (typeof window === 'undefined') return new Map();

    const host = currentHost();
    const keys = keysToPersist();
    const seeded: Record<string, unknown> = {};

    const persisted = readPersisted(host);
    if (persisted) Object.assign(seeded, persisted.data);

    try {
      const legacyHost = host;
      if (legacyHost) {
        const contactsRaw = window.localStorage.getItem(`sp_cache_contacts_v1:${legacyHost}`);
        const contacts = migrateLegacyEnvelope(contactsRaw);
        if (contacts != null) {
          seeded[unstable_serialize(contactsSWRKey())] = contacts;
          window.localStorage.removeItem(`sp_cache_contacts_v1:${legacyHost}`);
        }

        const projectsRaw = window.localStorage.getItem(`sp_cache_projects_v1:${legacyHost}`);
        const projects = migrateLegacyEnvelope(projectsRaw);
        if (projects != null) {
          seeded[unstable_serialize(projectsSWRKey())] = projects;
          window.localStorage.removeItem(`sp_cache_projects_v1:${legacyHost}`);
        }
      }

      const scheduleRaw = window.localStorage.getItem('sp_cache_schedule_v1');
      const schedule = migrateLegacyEnvelope(scheduleRaw);
      if (schedule && typeof schedule === 'object') {
        seeded[unstable_serialize(scheduleSnapshotSWRKey())] = schedule;
        window.localStorage.removeItem('sp_cache_schedule_v1');
      }
    } catch {
      // ignore
    }

    const map = new PersistedSWRMap(host, keys, seeded);
    writePersisted({ v: 1, host, updatedAt: nowIso(), data: Object.fromEntries(Array.from(map.entries()).map(([k, v]) => [k, (v as any)?.data])) });
    return map;
  }, []);

  return (
    <SWRConfig
      value={{
        provider: () => swrCache as any,
        revalidateOnFocus: false,
        errorRetryCount: 1,
      }}
    >
      {children}
    </SWRConfig>
  );
}
