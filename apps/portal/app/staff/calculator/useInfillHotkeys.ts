import { useEffect } from 'react';

type InfillHotkeysOptions = {
  enabled: boolean;
  disableEsc?: boolean;
  onDuplicate: () => void;
  onDuplicateBulk: () => void;
  onCopyGeometry: () => void;
  onPasteGeometry: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onClose: () => void;
  onDone: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable;
}

export function useInfillHotkeys({
  enabled,
  disableEsc = false,
  onDuplicate,
  onDuplicateBulk,
  onCopyGeometry,
  onPasteGeometry,
  onMoveUp,
  onMoveDown,
  onClose,
  onDone,
}: InfillHotkeysOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const typingTarget = isTypingTarget(event.target);

      if (typingTarget && !isCmdOrCtrl) return;

      if (event.altKey && !isCmdOrCtrl && key === 'arrowup') {
        event.preventDefault();
        onMoveUp();
        return;
      }

      if (event.altKey && !isCmdOrCtrl && key === 'arrowdown') {
        event.preventDefault();
        onMoveDown();
        return;
      }

      if (isCmdOrCtrl && key === 'd') {
        event.preventDefault();
        if (event.shiftKey) onDuplicateBulk();
        else onDuplicate();
        return;
      }

      if (isCmdOrCtrl && key === 'c') {
        event.preventDefault();
        onCopyGeometry();
        return;
      }

      if (isCmdOrCtrl && key === 'v') {
        event.preventDefault();
        onPasteGeometry();
        return;
      }

      if (isCmdOrCtrl && key === 'enter') {
        event.preventDefault();
        onDone();
        return;
      }

      if (key === 'escape' && !disableEsc) {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    disableEsc,
    enabled,
    onClose,
    onCopyGeometry,
    onDone,
    onDuplicate,
    onDuplicateBulk,
    onMoveDown,
    onMoveUp,
    onPasteGeometry,
  ]);
}
