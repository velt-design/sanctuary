import { createRoot, type ReconcilerRoot, type RenderProps } from '@react-three/fiber';
import type { ReactNode } from 'react';

type Frame = { options: RenderProps<HTMLCanvasElement>; children: ReactNode };

/** Serializes asynchronous renderer configuration without rendering stale children. */
export class SceneRootLifecycle {
  private root: ReconcilerRoot<HTMLCanvasElement> | null = null;
  private pending: Frame | null = null;
  private running = false;
  private active = true;
  private closed = false;

  constructor(private canvas: HTMLCanvasElement, private report: (error: unknown) => void) {}

  resume(): void { this.active = true; }

  update(frame: Frame): void {
    if (this.closed) return;
    this.pending = frame;
    void this.flush();
  }

  release(): void {
    this.active = false;
    // React StrictMode replays effects on the same live canvas. Do not ask Fiber
    // to schedule its deferred disposal for that transient replay.
    queueMicrotask(() => {
      if (this.active) return;
      this.closed = true;
      this.pending = null;
      if (!this.running) this.dispose();
    });
  }

  private dispose(): void {
    this.root?.unmount();
    this.root = null;
  }

  private async flush(): Promise<void> {
    if (this.running || !this.active || this.closed) return;
    this.running = true;
    try {
      while (this.pending && this.active && !this.closed) {
        const frame = this.pending;
        this.pending = null;
        this.root ??= createRoot(this.canvas);
        await this.root.configure(frame.options);
        if (!this.pending && this.active && !this.closed) this.root.render(frame.children);
      }
    } catch (error) {
      this.pending = null;
      if (this.active && !this.closed) this.report(error);
    } finally {
      this.running = false;
      if (this.closed) this.dispose();
    }
  }
}
