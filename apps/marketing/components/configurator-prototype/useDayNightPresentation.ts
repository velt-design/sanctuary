'use client';

import { createContext, useContext, useLayoutEffect, useRef, type RefObject } from 'react';
import { dayNightTheme } from './dayNightTheme';
import { sampleDayNight } from './dayNightTimeline';

export type NightPresentation = { current: number; listeners: Set<() => void> };
export const JourneyNightPresentation = createContext<NightPresentation | null>(null);

// The interface owns the clock so lazy loading or losing WebGL cannot reset it.
export function useDayNightPresentation(night: boolean, viewport: RefObject<HTMLDivElement | null>, local = false) {
  const inherited = useContext(JourneyNightPresentation);
  const presentation = useRef<NightPresentation>({ current: Number(night), listeners: new Set() });
  useLayoutEffect(() => {
    if (inherited) return;
    const node = viewport.current;
    const workspace = node?.closest<HTMLElement>('[data-night]');
    const roots = local ? [] : [workspace, workspace?.closest('dialog')].filter((root): root is HTMLElement => Boolean(root));
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timeline = { from: presentation.current.current, target: Number(night), startedAt: performance.now() };
    let frame = 0;
    const paint = () => {
      const amount = sampleDayNight(timeline, performance.now(), preference.matches);
      presentation.current.current = amount;
      node?.style.setProperty('--night-amount', String(amount));
      const theme = dayNightTheme(amount);
      for (const root of roots) for (const [key, value] of Object.entries(theme)) root.style.setProperty(key, value);
      // Queue palette progress before subscriber render frames to keep both in step.
      if (amount !== timeline.target) frame = requestAnimationFrame(paint);
      for (const listener of presentation.current.listeners) listener();
    };
    const preferenceChanged = () => { cancelAnimationFrame(frame); paint(); };
    paint();
    preference.addEventListener('change', preferenceChanged);
    return () => { cancelAnimationFrame(frame); preference.removeEventListener('change', preferenceChanged); };
  }, [night, viewport, local, inherited]);
  useLayoutEffect(() => {
    if (inherited) return;
    const node = viewport.current;
    const workspace = node?.closest<HTMLElement>('[data-night]');
    const roots = local ? [] : [workspace, workspace?.closest('dialog')].filter((root): root is HTMLElement => Boolean(root));
    return () => {
      node?.style.removeProperty('--night-amount');
      for (const root of roots) for (const key of Object.keys(dayNightTheme(0))) root.style.removeProperty(key);
    };
  }, [viewport, local, inherited]);
  return inherited ?? presentation.current;
}
