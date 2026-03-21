import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

let projectPageShellWidthPx = 1500;
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key) ?? null : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  } as Storage;
}

function ensureStorage(name: 'localStorage' | 'sessionStorage'): void {
  if (typeof window === 'undefined') return;

  try {
    void window[name];
    window[name].getItem('__storage_probe__');
  } catch {
    Object.defineProperty(window, name, {
      configurable: true,
      value: createMemoryStorage(),
    });
  }
}

ensureStorage('localStorage');
ensureStorage('sessionStorage');

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
      if (this.dataset.projectPageShell === 'true' || this.dataset.projectPageFrame === 'true') {
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
