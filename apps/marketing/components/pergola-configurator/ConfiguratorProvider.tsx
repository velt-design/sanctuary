'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  createConfiguratorStore,
  type ConfiguratorStore,
  type ConfiguratorStoreSnapshot,
} from '../../lib/pergola-configurator/store';

const ConfiguratorStoreContext = createContext<ConfiguratorStore | null>(null);

export function ConfiguratorProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<ConfiguratorStore | null>(null);
  if (storeRef.current === null) storeRef.current = createConfiguratorStore();
  const store = storeRef.current;

  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);

  return (
    <ConfiguratorStoreContext.Provider value={store}>
      {children}
    </ConfiguratorStoreContext.Provider>
  );
}

export function useConfiguratorStore(): ConfiguratorStore {
  const store = useContext(ConfiguratorStoreContext);
  if (!store) throw new Error('useConfiguratorStore must be used inside ConfiguratorProvider.');
  return store;
}

export function useConfiguratorSnapshot(): ConfiguratorStoreSnapshot {
  const store = useConfiguratorStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
