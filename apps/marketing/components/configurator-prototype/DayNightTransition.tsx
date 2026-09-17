'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { dayNightTheme } from './dayNightTheme';
import { sampleDayNight, type DayNightTransition as Timeline } from './dayNightTimeline';

const Context = createContext<{ current: number }>({ current: 0 });
export const useNightAmount = () => useContext(Context);

export default function DayNightTransition({ night, children }: { night: boolean; children: ReactNode }) {
  const amount = useRef(Number(night));
  const timeline = useRef<Timeline>({ from: amount.current, target: amount.current, startedAt: 0 });
  const reduced = useRef(false);
  const surfaces = useRef<{ viewport: HTMLElement | null; roots: HTMLElement[] }>({ viewport: null, roots: [] });
  const painted = useRef<number | null>(null);
  const { invalidate, gl } = useThree();
  useLayoutEffect(() => {
    const viewport = gl.domElement.closest<HTMLElement>('[data-view]');
    const workspace = viewport?.closest<HTMLElement>('[data-night]');
    const dialog = workspace?.closest('dialog');
    const roots = [workspace, dialog].filter((node): node is HTMLElement => Boolean(node));
    surfaces.current = { viewport, roots };
    painted.current = null;
    return () => {
      viewport?.style.removeProperty('--night-amount');
      for (const root of roots) for (const key of Object.keys(dayNightTheme(0))) root.style.removeProperty(key);
    };
  }, [gl]);
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
    if (painted.current !== amount.current) {
      surfaces.current.viewport?.style.setProperty('--night-amount', String(amount.current));
      const theme = dayNightTheme(amount.current);
      for (const root of surfaces.current.roots) for (const [key, value] of Object.entries(theme)) root.style.setProperty(key, value);
      painted.current = amount.current;
    }
    if (amount.current !== timeline.current.target) invalidate();
  }, -2);
  return <Context.Provider value={amount}>{children}</Context.Provider>;
}
