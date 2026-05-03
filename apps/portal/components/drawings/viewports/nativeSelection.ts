function shouldBlockNativeSelection(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  return !target.closest(
    [
      'input',
      'textarea',
      'select',
      'option',
      'button',
      'label',
      'a[href]',
      '[contenteditable="true"]',
      '[contenteditable=""]',
      '[role="textbox"]',
      '[data-allow-native-selection="true"]',
    ].join(','),
  );
}

export function blockNativeSelectionEvent(event: {
  target: EventTarget | null;
  preventDefault: () => void;
}): void {
  if (shouldBlockNativeSelection(event.target)) {
    event.preventDefault();
  }
}
