export const MOBILE_STEPS = ['roof', 'size', 'extras', 'finished', 'review'] as const;
export type MobileStep = typeof MOBILE_STEPS[number];
export const MOBILE_PROGRESS_KEY = 'sanctuary.mobile-journey.v1';
export function parseMobileStep(value: unknown): MobileStep {
  if (value === 'explore') return 'extras';
  return MOBILE_STEPS.includes(value as MobileStep) ? value as MobileStep : 'roof';
}
export function readMobileStep(): MobileStep {
  try { return parseMobileStep(window.localStorage.getItem(MOBILE_PROGRESS_KEY)); }
  catch { return 'roof'; }
}
export function saveMobileStep(step: MobileStep) {
  try { window.localStorage.setItem(MOBILE_PROGRESS_KEY, step); } catch { /* Current visit still works. */ }
}
