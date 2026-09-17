'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { sampleDayNight, type DayNightTransition as Timeline } from './dayNightTimeline';

const Context = createContext<{ current: number }>({ current: 0 });
export const useNightAmount = () => useContext(Context);

export default function DayNightTransition({ night, children }: { night: boolean; children: ReactNode }) {
  const amount = useRef(Number(night));
  const timeline = useRef<Timeline>({ from: amount.current, target: amount.current, startedAt: 0 });
  const reduced = useRef(false);
  const { invalidate, gl } = useThree();
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reduced.current = preference.matches; invalidate(); };
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, [invalidate]);
  useEffect(() => {
    timeline.current = { from: amount.current, target: Number(night), startedAt: performance.now() };
    invalidate();
  }, [night, invalidate]);
  useFrame(() => {
    amount.current = sampleDayNight(timeline.current, performance.now(), reduced.current);
    const viewport = gl.domElement.closest<HTMLElement>('[data-view]');
    viewport?.style.setProperty('--night-amount', String(amount.current));
    if (amount.current !== timeline.current.target) invalidate();
  }, -2);
  return <Context.Provider value={amount}>{children}</Context.Provider>;
}
