type Listener = { chunk: (bytes: Uint8Array) => void; done: () => void };

/** One protected body fetch feeds PDF.js progressively; it never starts range HTTP requests. */
export class ProjectPdfStream {
  private chunks: Uint8Array[] = [];
  private listeners = new Set<Listener>();
  private complete = false;
  constructor(readonly length: number) {}
  append(bytes: Uint8Array) {
    this.chunks.push(bytes);
    for (const listener of this.listeners) listener.chunk(new Uint8Array(bytes));
  }
  finish() { this.complete = true; for (const listener of this.listeners) listener.done(); this.listeners.clear(); }
  subscribe(chunk: Listener['chunk'], done: Listener['done']) {
    const listener = { chunk, done };
    for (const bytes of this.chunks) chunk(new Uint8Array(bytes));
    if (this.complete) done();
    else this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}
