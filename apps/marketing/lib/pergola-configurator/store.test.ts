import { describe, expect, it } from 'vitest';
import { createDefaultCustomerPergolaConfigurationV1 } from '@sp/configurator/core';
import { createConfiguratorStore, type ConfiguratorStoreEnvironment } from './store';
import {
  CONFIGURATOR_STORAGE_KEY,
  serializeStoredCustomerPergolaConfigurationEnvelopeV1,
} from './storage';
import { SIMPLE_COVER_HANDOFF_STORAGE_KEY } from './simpleCoverImport';

function createEnvironment(options: {
  localValue?: string | null;
  sessionValue?: string | null;
  storageUnavailable?: boolean;
  confirm?: boolean;
} = {}) {
  let localValue = options.localValue ?? null;
  const writes: string[] = [];
  const opened: unknown[] = [];
  const listeners = new Map<string, Set<(event: Event | { key: string | null; newValue: string | null }) => void>>();
  const timers = new Map<number, () => void>();
  let nextTimer = 1;
  let now = '2026-08-25T01:00:00.000Z';
  const environment: ConfiguratorStoreEnvironment = {
    localStorage: {
      getItem: () => {
        if (options.storageUnavailable) throw new Error('blocked');
        return localValue;
      },
      setItem: (_key, value) => {
        if (options.storageUnavailable) throw new Error('blocked');
        localValue = value;
        writes.push(value);
      },
    },
    sessionStorage: {
      getItem: (key) => key === SIMPLE_COVER_HANDOFF_STORAGE_KEY
        ? options.sessionValue ?? null
        : null,
    },
    now: () => now,
    createId: () => '2ac1eb32-f2f4-4f3e-8b2a-0d51d2dbb121',
    confirm: () => options.confirm ?? true,
    getScrollY: () => 0,
    setTimer: (callback) => {
      const timer = nextTimer++;
      timers.set(timer, callback);
      return timer;
    },
    clearTimer: (timer) => timers.delete(Number(timer)),
    addEventListener: (type, listener) => {
      const typeListeners = listeners.get(type) ?? new Set();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
    },
    removeEventListener: (type, listener) => listeners.get(type)?.delete(listener),
    dispatchOpenRequest: (configuration) => opened.push(configuration),
  };
  return {
    environment,
    writes,
    opened,
    setNow: (value: string) => { now = value; },
    runTimers: () => {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
    },
    emit: (type: string, event: Event | { key: string | null; newValue: string | null }) => {
      listeners.get(type)?.forEach((listener) => listener(event));
    },
    readLocal: () => localValue,
  };
}

const restored = createDefaultCustomerPergolaConfigurationV1({
  configurationId: '89cfd799-363c-4e4b-bac2-ac7409dcbc7f',
  timestamp: '2026-08-25T00:00:00.000Z',
});

describe('configurator external store', () => {
  it('survives a browser that throws while accessing the localStorage object', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => { throw new DOMException('blocked', 'SecurityError'); },
    });
    try {
      const store = createConfiguratorStore();
      expect(() => store.start()).not.toThrow();
      expect(store.getSnapshot()).toMatchObject({
        hydrated: true,
        saveStatus: 'memory_only',
      });
      store.stop();
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
    }
  });

  it('hydrates a configured document and flushes committed changes on pagehide', () => {
    const fixture = createEnvironment({
      localValue: serializeStoredCustomerPergolaConfigurationEnvelopeV1(
        restored,
        '2026-08-25T00:30:00.000Z',
      ),
    });
    const store = createConfiguratorStore();
    store.start(fixture.environment);
    expect(store.getSnapshot()).toMatchObject({ hydrated: true, configuration: restored });

    fixture.setNow('2026-08-25T02:00:00.000Z');
    store.reset();
    expect(store.getSnapshot().saveStatus).toBe('saving');
    fixture.emit('pagehide', new Event('pagehide'));
    expect(fixture.writes).toHaveLength(1);
    expect(store.getSnapshot().saveStatus).toBe('saved');
  });

  it('keeps unavailable storage in memory and exposes the required message', () => {
    const fixture = createEnvironment({ storageUnavailable: true });
    const store = createConfiguratorStore();
    store.start(fixture.environment);
    store.requestOpen();
    fixture.runTimers();
    expect(store.getSnapshot().configuration).not.toBeNull();
    expect(store.getSnapshot()).toMatchObject({
      saveStatus: 'memory_only',
      saveStatusMessage: 'Your choices are available for this visit but could not be saved on this device.',
    });
  });

  it('protects corrupt and future values from automatic overwrite', () => {
    for (const localValue of [
      '{broken',
      JSON.stringify({ storageVersion: 'sanctuary.pergola-config.v2', opaque: true }),
    ]) {
      const fixture = createEnvironment({ localValue, confirm: false });
      const store = createConfiguratorStore();
      store.start(fixture.environment);
      store.requestOpen();
      fixture.runTimers();
      expect(fixture.writes).toHaveLength(0);
      expect(fixture.readLocal()).toBe(localValue);
      expect(store.getSnapshot().saveStatus).toBe('recovery_required');
    }
  });

  it('blocks ordinary patches after a future-version cross-tab value arrives', () => {
    const fixture = createEnvironment();
    const store = createConfiguratorStore();
    store.start(fixture.environment);
    store.requestOpen();
    fixture.runTimers();
    fixture.writes.length = 0;
    fixture.emit('storage', {
      key: CONFIGURATOR_STORAGE_KEY,
      newValue: JSON.stringify({ storageVersion: 'sanctuary.pergola-config.v2', opaque: true }),
    });
    store.applyPatch({
      schemaVersion: 'customer_configuration_patch.v1',
      pergola: { family: 'gable' },
    });
    fixture.runTimers();
    expect(store.getSnapshot().configuration?.intent.pergola.family).toBe('mono');
    expect(store.getSnapshot().saveStatus).toBe('recovery_required');
    expect(fixture.writes).toHaveLength(0);
  });

  it('accepts only the newest cross-tab revision without a write loop', () => {
    const fixture = createEnvironment();
    const store = createConfiguratorStore();
    store.start(fixture.environment);
    store.requestOpen();
    fixture.runTimers();
    fixture.writes.length = 0;
    const current = store.getSnapshot().configuration!;
    const newer = { ...current, revision: current.revision + 2, updatedAt: '2026-08-25T03:00:00.000Z' };
    fixture.emit('storage', {
      key: CONFIGURATOR_STORAGE_KEY,
      newValue: serializeStoredCustomerPergolaConfigurationEnvelopeV1(
        newer,
        '2026-08-25T03:00:01.000Z',
      ),
    });
    fixture.runTimers();
    expect(store.getSnapshot().configuration?.revision).toBe(newer.revision);
    expect(store.getSnapshot().saveStatusMessage).toBe('Updated from another tab.');
    expect(fixture.writes).toHaveLength(0);
  });

  it('imports a valid Simple handoff on first open without carrying price truth', () => {
    const fixture = createEnvironment({
      sessionValue: JSON.stringify({
        schemaVersion: 'simple-cover-handoff.v1',
        status: 'priced',
        input: { widthMm: 6_000, projectionMm: 3_000, level: 'ground', connection: 'fascia' },
        calculationRef: 'opaque',
        displayedPriceIncGst: 30_000,
        configurationVersion: 4,
      }),
    });
    const store = createConfiguratorStore();
    store.start(fixture.environment);
    store.requestOpen();
    expect(store.getSnapshot().configuration).toMatchObject({
      source: { kind: 'simple_cover_import' },
      intent: { pergola: { dimensions: { lengthMm: 6_000, projectionMm: 3_000 } } },
    });
    expect(JSON.stringify(store.getSnapshot().configuration)).not.toContain('opaque');
  });
});
