export type BoardDragSnapshot = { id: string; node: HTMLElement; width: number; height: number };

export function captureBoardDragSnapshot(id: string, source: HTMLElement): BoardDragSnapshot {
  const rect = source.getBoundingClientRect();
  // Freeze the rendered card instead of rebuilding a different card under the
  // pointer. The copy is visual only: no identity, focus targets or listeners.
  const node = source.cloneNode(true) as HTMLElement;
  for (const element of [node, ...Array.from(node.querySelectorAll<HTMLElement>('*'))]) {
    for (const attribute of ['id', 'aria-describedby', 'data-schedule-card-id', 'data-dragging', 'data-drop-target']) element.removeAttribute(attribute);
    if (element.matches('button, a, input, select, textarea, [tabindex]')) element.setAttribute('tabindex', '-1');
  }
  node.inert = true;
  node.setAttribute('aria-hidden', 'true');
  node.style.opacity = '1';
  return { id, node, width: rect.width, height: rect.height };
}
