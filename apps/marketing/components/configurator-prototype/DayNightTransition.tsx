'use client';

import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import type { NightPresentation } from './useDayNightPresentation';

const Context = createContext<{ current: number }>({ current: 0 });
export const useNightAmount = () => useContext(Context);

export default function DayNightTransition({ presentation, children }: { presentation: NightPresentation; children: ReactNode }) {
  const { invalidate } = useThree();
  useLayoutEffect(() => {
    presentation.listeners.add(invalidate);
    invalidate();
    return () => { presentation.listeners.delete(invalidate); };
  }, [presentation, invalidate]);
  return <Context.Provider value={presentation}>{children}</Context.Provider>;
}
