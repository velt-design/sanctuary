export const START_MODAL_OPEN_CLASS = 'start-modal-open';
export const START_MODAL_VISIBILITY_EVENT = 'start-modal-visibility-change';

export type StartModalVisibilityDetail = {
  open: boolean;
};

export function isStartModalOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.body.classList.contains(START_MODAL_OPEN_CLASS);
}

export function setStartModalOpenClass(open: boolean): void {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle(START_MODAL_OPEN_CLASS, open);
}

export function dispatchStartModalVisibility(open: boolean): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<StartModalVisibilityDetail>(START_MODAL_VISIBILITY_EVENT, {
      detail: { open },
    })
  );
}
