// One reversible timeline for the scene, reflections, fixtures and backdrop.
export const DAY_NIGHT_DURATION_MS = 1000;
export type DayNightTransition = { from: number; target: number; startedAt: number };

export function sampleDayNight(transition: DayNightTransition, now: number, reducedMotion = false) {
  const t = reducedMotion ? 1 : Math.min(1, Math.max(0, (now - transition.startedAt) / DAY_NIGHT_DURATION_MS));
  const eased = t * t * (3 - 2 * t);
  return transition.from + (transition.target - transition.from) * eased;
}
