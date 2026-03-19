import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

let projectPageShellWidthPx = 1500;
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function rectFor(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON() {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
      };
    },
  } as DOMRect;
}

export function installDomGeometryMock(): () => void {
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement) {
      if (this.dataset.projectPageShell === 'true') {
        return rectFor(projectPageShellWidthPx, 900);
      }
      const width = Number.parseFloat(this.dataset.testWidth ?? this.style.width ?? '0') || 0;
      const height = Number.parseFloat(this.dataset.testHeight ?? this.style.height ?? '600') || 600;
      return rectFor(width, height);
    },
  });

  return () => {
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: originalGetBoundingClientRect,
    });
  };
}

export function setProjectPageShellWidth(widthPx: number): void {
  projectPageShellWidthPx = widthPx;
}

export function renderIntoDocument(ui: ReactElement): {
  container: HTMLDivElement;
  rerender: (next: ReactElement) => void;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });

  return {
    container,
    rerender(next: ReactElement) {
      act(() => {
        root.render(next);
      });
    },
    root,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

export function dispatchKeyboard(target: EventTarget, key: string): void {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key,
      }),
    );
  });
}

export function dispatchPointer(target: EventTarget, type: string, init: MouseEventInit = {}): void {
  const EventCtor = window.PointerEvent ?? MouseEvent;
  act(() => {
    target.dispatchEvent(
      new EventCtor(type, {
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}
