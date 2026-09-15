// Lightweight navigation state; design contents remain owned by usePreviewDraft.
export const DESIGN_CONTINUATION_EVENT = 'sanctuary:design-continuation';
const KEY = 'sanctuary.design-continuation.v1';
export const DESIGN_SECTIONS = ['structure', 'roof', 'sides', 'lighting', 'personalise', 'review'] as const;
export type DesignSection = typeof DESIGN_SECTIONS[number];
export type DesignContinuation = { started: boolean; dismissed: boolean; section: DesignSection };
const INITIAL: DesignContinuation = { started: false, dismissed: false, section: 'structure' };
let memory = INITIAL;

export function readDesignContinuation(): DesignContinuation {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return memory;
    const value = JSON.parse(raw);
    memory = {
      started: value.started === true,
      dismissed: value.dismissed === true,
      section: DESIGN_SECTIONS.includes(value.section) ? value.section : 'structure',
    };
  } catch { /* Keep the current session usable when storage is unavailable. */ }
  return memory;
}

export function updateDesignContinuation(patch: Partial<DesignContinuation>) {
  memory = { ...readDesignContinuation(), ...patch };
  try { window.sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* In-memory fallback. */ }
  window.dispatchEvent(new Event(DESIGN_CONTINUATION_EVENT));
}
