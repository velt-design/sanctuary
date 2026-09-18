export const MOBILE_STEPS = ['shape', 'roof', 'size', 'explore', 'extras', 'finished', 'review'] as const;
export type MobileStep = typeof MOBILE_STEPS[number];
export const MOBILE_PROGRESS_KEY = 'sanctuary.mobile-journey.v1';
export function parseMobileStep(value: unknown): MobileStep {
  return MOBILE_STEPS.includes(value as MobileStep) ? value as MobileStep : 'shape';
}
export function readMobileStep(): MobileStep {
  try { return parseMobileStep(window.localStorage.getItem(MOBILE_PROGRESS_KEY)); }
  catch { return 'shape'; }
}
export function saveMobileStep(step: MobileStep) {
  try { window.localStorage.setItem(MOBILE_PROGRESS_KEY, step); } catch { /* Current visit still works. */ }
}
