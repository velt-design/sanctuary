import {
  applyCustomerConfigurationPatchV1,
  createDefaultCustomerPergolaConfigurationV1,
  type CustomerConfigurationPatchV1,
  type CustomerPergolaConfigurationV1,
} from '@sp/configurator/core';
import {
  compareConfigurationFreshness,
  CONFIGURATOR_STORAGE_KEY,
  readStoredCustomerPergolaConfiguration,
  serializeStoredCustomerPergolaConfigurationEnvelopeV1,
  type ConfiguratorStorage,
} from './storage';
import {
  importSimpleCoverHandoffV1,
  SIMPLE_COVER_HANDOFF_STORAGE_KEY,
} from './simpleCoverImport';

const SAVE_DELAY_MS = 250;
const STORAGE_UNAVAILABLE_MESSAGE = 'Your choices are available for this visit but could not be saved on this device.';
const INVALID_STORAGE_MESSAGE = 'Your saved pergola could not be read. Reset it explicitly to start again.';
const FUTURE_STORAGE_MESSAGE = 'This device has a pergola saved by a newer version. It has not been changed.';
const RESET_CONFIRMATION = 'Start a new pergola? Your saved configuration on this device will be replaced.';
const RECOVERY_CONFIRMATION = 'Replace the unreadable saved pergola on this device and start again?';

type ConfiguratorSaveStatus = 'idle' | 'saving' | 'saved' | 'memory_only' | 'recovery_required';

export type ConfiguratorStoreSnapshot = {
  hydrated: boolean;
  engaged: boolean;
  configuration: CustomerPergolaConfigurationV1 | null;
  saveStatus: ConfiguratorSaveStatus;
  saveStatusMessage: string | null;
};

const SERVER_SNAPSHOT: ConfiguratorStoreSnapshot = {
  hydrated: false,
  engaged: false,
  configuration: null,
  saveStatus: 'idle',
  saveStatusMessage: null,
};

type ConfiguratorTimer = ReturnType<typeof setTimeout> | number;

type ConfiguratorStorageEvent = {
  key: string | null;
  newValue: string | null;
};

export type ConfiguratorStoreEnvironment = {
  localStorage: ConfiguratorStorage;
  sessionStorage: Pick<Storage, 'getItem'>;
  now: () => string;
  createId: () => string;
  confirm: (message: string) => boolean;
  getScrollY: () => number;
  setTimer: (callback: () => void, delayMs: number) => ConfiguratorTimer;
  clearTimer: (timer: ConfiguratorTimer) => void;
  addEventListener: (
    type: 'storage' | 'pagehide' | 'scroll' | 'click',
    listener: (event: ConfiguratorStorageEvent | Event) => void,
  ) => void;
  removeEventListener: (
    type: 'storage' | 'pagehide' | 'scroll' | 'click',
    listener: (event: ConfiguratorStorageEvent | Event) => void,
  ) => void;
  dispatchOpenRequest: (configuration: CustomerPergolaConfigurationV1) => void;
};

function createBrowserEnvironment(): ConfiguratorStoreEnvironment {
  return {
    // Access the Storage objects lazily. Some privacy modes throw from the
    // window.localStorage/sessionStorage getters before getItem is called.
    localStorage: {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    },
    sessionStorage: {
      getItem: (key) => window.sessionStorage.getItem(key),
    },
    now: () => new Date().toISOString(),
    createId: () => window.crypto.randomUUID(),
    confirm: (message) => window.confirm(message),
    getScrollY: () => window.scrollY,
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (timer) => window.clearTimeout(timer as number),
    addEventListener: (type, listener) => window.addEventListener(type, listener as EventListener),
    removeEventListener: (type, listener) => window.removeEventListener(type, listener as EventListener),
    dispatchOpenRequest: (configuration) => window.dispatchEvent(new CustomEvent(
      'sanctuary:configurator-open-requested',
      { detail: { configuration } },
    )),
  };
}

export type ConfiguratorStore = ReturnType<typeof createConfiguratorStore>;

export function createConfiguratorStore() {
  let snapshot: ConfiguratorStoreSnapshot = SERVER_SNAPSHOT;
  let environment: ConfiguratorStoreEnvironment | null = null;
  let pendingSave: ConfiguratorTimer | null = null;
  let protectedStoredValue = false;
  const listeners = new Set<() => void>();

  const emit = (patch: Partial<ConfiguratorStoreSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };

  const markStorageUnavailable = () => {
    protectedStoredValue = false;
    emit({ saveStatus: 'memory_only', saveStatusMessage: STORAGE_UNAVAILABLE_MESSAGE });
  };

  const flush = () => {
    if (
      !environment
      || !snapshot.configuration
      || protectedStoredValue
      || pendingSave === null
    ) return;
    if (pendingSave !== null) {
      environment.clearTimer(pendingSave);
      pendingSave = null;
    }
    try {
      environment.localStorage.setItem(
        CONFIGURATOR_STORAGE_KEY,
        serializeStoredCustomerPergolaConfigurationEnvelopeV1(
          snapshot.configuration,
          environment.now(),
        ),
      );
      emit({ saveStatus: 'saved', saveStatusMessage: 'Saved on this device.' });
    } catch {
      markStorageUnavailable();
    }
  };

  const scheduleSave = () => {
    if (!environment || protectedStoredValue) return;
    if (pendingSave !== null) environment.clearTimer(pendingSave);
    emit({ saveStatus: 'saving', saveStatusMessage: 'Saving to this device…' });
    pendingSave = environment.setTimer(flush, SAVE_DELAY_MS);
  };

  const replaceConfiguration = (
    configuration: CustomerPergolaConfigurationV1,
    allowProtectedOverwrite = false,
  ) => {
    if (protectedStoredValue && !allowProtectedOverwrite) return;
    protectedStoredValue = false;
    emit({ configuration });
    scheduleSave();
  };

  const readSimpleCoverImport = (): CustomerPergolaConfigurationV1 | null => {
    if (!environment) return null;
    try {
      const serialized = environment.sessionStorage.getItem(SIMPLE_COVER_HANDOFF_STORAGE_KEY);
      if (!serialized) return null;
      return importSimpleCoverHandoffV1(JSON.parse(serialized) as unknown, {
        configurationId: environment.createId(),
        timestamp: environment.now(),
      });
    } catch {
      return null;
    }
  };

  const handleStorage = (event: ConfiguratorStorageEvent | Event) => {
    const storageEvent = event as ConfiguratorStorageEvent;
    if (storageEvent.key !== CONFIGURATOR_STORAGE_KEY) return;
    const result = readStoredCustomerPergolaConfiguration(storageEvent.newValue);
    if (result.status === 'current') {
      if (
        snapshot.configuration === null
        || compareConfigurationFreshness(result.envelope.document, snapshot.configuration) > 0
      ) {
        protectedStoredValue = false;
        if (pendingSave !== null && environment) environment.clearTimer(pendingSave);
        pendingSave = null;
        emit({
          configuration: result.envelope.document,
          saveStatus: 'saved',
          saveStatusMessage: 'Updated from another tab.',
        });
      }
      return;
    }
    if (result.status === 'future-version' || result.status === 'invalid') {
      protectedStoredValue = true;
      if (pendingSave !== null && environment) environment.clearTimer(pendingSave);
      pendingSave = null;
      emit({
        saveStatus: 'recovery_required',
        saveStatusMessage: result.status === 'future-version'
          ? FUTURE_STORAGE_MESSAGE
          : INVALID_STORAGE_MESSAGE,
      });
    }
  };

  const handlePageHide = () => flush();
  const handleEngagement = () => {
    if (!snapshot.engaged) emit({ engaged: true });
  };
  const handleScroll = () => {
    if (environment && environment.getScrollY() >= 120) handleEngagement();
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start(nextEnvironment: ConfiguratorStoreEnvironment = createBrowserEnvironment()) {
      if (environment) return;
      environment = nextEnvironment;
      try {
        const result = readStoredCustomerPergolaConfiguration(
          environment.localStorage.getItem(CONFIGURATOR_STORAGE_KEY),
        );
        if (result.status === 'current') {
          emit({
            hydrated: true,
            configuration: result.envelope.document,
            saveStatus: 'saved',
            saveStatusMessage: 'Saved on this device.',
          });
          if (result.needsCanonicalWrite) {
            environment.localStorage.setItem(CONFIGURATOR_STORAGE_KEY, result.canonicalSerialized);
          }
        } else if (result.status === 'future-version' || result.status === 'invalid') {
          protectedStoredValue = true;
          emit({
            hydrated: true,
            saveStatus: 'recovery_required',
            saveStatusMessage: result.status === 'future-version'
              ? FUTURE_STORAGE_MESSAGE
              : INVALID_STORAGE_MESSAGE,
          });
        } else {
          emit({ hydrated: true });
        }
      } catch {
        emit({ hydrated: true });
        markStorageUnavailable();
      }
      environment.addEventListener('storage', handleStorage);
      environment.addEventListener('pagehide', handlePageHide);
      environment.addEventListener('scroll', handleScroll);
      // Wait for activation to complete before mounting a fixed dock. Rendering it
      // during pointerdown can move the element beneath the pointer before click.
      // Keyboard activation of links and buttons also emits click.
      environment.addEventListener('click', handleEngagement);
      handleScroll();
    },
    stop() {
      if (!environment) return;
      environment.removeEventListener('storage', handleStorage);
      environment.removeEventListener('pagehide', handlePageHide);
      environment.removeEventListener('scroll', handleScroll);
      environment.removeEventListener('click', handleEngagement);
      if (pendingSave !== null) environment.clearTimer(pendingSave);
      pendingSave = null;
      environment = null;
    },
    markEngaged: handleEngagement,
    requestOpen() {
      if (!environment) return;
      if (snapshot.configuration) {
        environment.dispatchOpenRequest(snapshot.configuration);
        return;
      }
      if (protectedStoredValue && !environment.confirm(RECOVERY_CONFIRMATION)) return;
      const timestamp = environment.now();
      const configuration = readSimpleCoverImport() ?? createDefaultCustomerPergolaConfigurationV1({
        configurationId: environment.createId(),
        timestamp,
      });
      replaceConfiguration(configuration, protectedStoredValue);
      environment.dispatchOpenRequest(configuration);
    },
    applyPatch(patch: CustomerConfigurationPatchV1) {
      if (!environment || !snapshot.configuration) return;
      replaceConfiguration(applyCustomerConfigurationPatchV1(snapshot.configuration, patch, {
        updatedAt: environment.now(),
      }));
    },
    reset() {
      if (!environment || !environment.confirm(RESET_CONFIRMATION)) return;
      replaceConfiguration(createDefaultCustomerPergolaConfigurationV1({
        configurationId: environment.createId(),
        timestamp: environment.now(),
      }), true);
    },
    flush,
  };
}
