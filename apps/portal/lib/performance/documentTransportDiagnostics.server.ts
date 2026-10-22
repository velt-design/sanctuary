import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { subscribe, unsubscribe } from 'node:diagnostics_channel';

const operations = ['rsc.identity', 'navigation.finance', 'marketing.hub', 'marketing.commercial', 'marketing.designer'] as const;
export type TransportOperation = (typeof operations)[number];
export function isTransportOperation(operation: string): operation is TransportOperation {
  return (operations as readonly string[]).includes(operation);
}
export type TransportObservation = {
  operation: TransportOperation;
  ordinal: number;
  connection: 'new' | 'reused' | 'unknown';
  dispatchMs: number | null;
  headersWaitMs: number | null;
  bodyMs: number | null;
  connectMs: null;
  outcome: 'response' | 'error' | 'incomplete' | 'not_observed';
};
export type TransportScope = {
  requestId: string;
  until: number;
  active: () => boolean;
  emit: (observation: TransportObservation) => unknown;
};
type Listener = (message: unknown) => void;
type ChannelPort = { subscribe: (name: string, listener: Listener) => void; unsubscribe: (name: string, listener: Listener) => unknown };
type Limits = { perOperation: number; perDocument: number; documents: number; active: number };
type DocumentBudget = { total: number; operations: Map<TransportOperation, number> };
type Context = { scope: TransportScope; operation: TransportOperation; budget: DocumentBudget; requests: RequestState[]; live: boolean; sawNative: boolean };
type RequestState = { context: Context; ordinal: number; created: number; send?: number; sent?: number; headers?: number; connection: TransportObservation['connection']; finished: boolean };
type Message = { request?: object; socket?: object; response?: { statusCode?: number } };
const channels = {
  create: 'undici:request:create', connected: 'undici:client:connected', send: 'undici:client:sendHeaders',
  sent: 'undici:request:bodySent', headers: 'undici:request:headers', done: 'undici:request:trailers', error: 'undici:request:error',
} as const;
type Event = keyof typeof channels;
const limits: Limits = { perOperation: 4, perDocument: 16, documents: 32, active: 64 };
function ignoreFailure(work: () => unknown) {
  try { void Promise.resolve(work()).catch(() => undefined); } catch { /* Observation cannot affect the request. */ }
}
function elapsed(end: number | undefined, start: number | undefined) {
  return end !== undefined && start !== undefined && Number.isFinite(end) && Number.isFinite(start) && end >= start
    ? Number((end - start).toFixed(1)) : null;
}

/** Native event identity only. Never reads request paths, headers, bodies or errors. */
export class DocumentTransportObserver {
  private readonly storage = new AsyncLocalStorage<Context>();
  private requests = new WeakMap<object, RequestState>();
  private sockets = new WeakMap<object, { generation: number; uses: number }>();
  private readonly budgets = new Map<string, DocumentBudget>();
  private readonly contexts = new Set<Context>();
  private readonly listeners: [string, Listener][];
  private until: number | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private subscribed = false;
  private generation = 0;

  constructor(private readonly port: ChannelPort = { subscribe, unsubscribe }, private readonly cap: Limits = limits) {
    this.listeners = Object.entries(channels).map(([event, name]) => [name, message => {
      // diagnostics_channel rethrows subscriber failures outside the publisher.
      try {
        if (this.subscribed && this.until !== null && Date.now() < this.until) this.handle(event as Event, message as Message);
      } catch { /* Includes malformed payloads and failing diagnostic callbacks. */ }
    }]);
  }
  private admitted(scope: TransportScope) {
    try { return Number.isFinite(scope.until) && Date.now() < scope.until && scope.active(); } catch { return false; }
  }
  private start(until: number) {
    if (this.until !== null && this.until !== until) {
      // A fresh compiled window cannot inherit old socket coverage or budgets.
      if (this.contexts.size) return false;
      this.expire();
    }
    this.until = until;
    if (!this.timer) {
      this.timer = setTimeout(() => this.expire(), Math.max(0, until - Date.now()));
      this.timer.unref();
    }
    if (!this.subscribed) {
      this.generation++; this.subscribed = true;
      try { for (const [name, listener] of this.listeners) this.port.subscribe(name, listener); }
      catch { this.stop(); return false; }
    }
    return true;
  }
  private stop() {
    if (!this.subscribed) return;
    this.subscribed = false;
    for (const [name, listener] of this.listeners) ignoreFailure(() => this.port.unsubscribe(name, listener));
  }
  private expire() {
    this.stop();
    for (const context of this.contexts) context.live = false;
    this.contexts.clear(); this.budgets.clear();
    this.requests = new WeakMap(); this.sockets = new WeakMap();
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined; this.until = null;
  }
  dispose() { this.expire(); this.storage.disable(); }

  private prepare(scope: TransportScope, operation: TransportOperation): Context | null {
    if (!isTransportOperation(operation) || !this.admitted(scope) || this.contexts.size >= this.cap.active) return null;
    if (!this.start(scope.until)) return null;
    let budget = this.budgets.get(scope.requestId);
    if (!budget) {
      if (this.budgets.size >= this.cap.documents) { if (!this.contexts.size) this.stop(); return null; }
      budget = { total: 0, operations: new Map() }; this.budgets.set(scope.requestId, budget);
    }
    const context: Context = { scope: { ...scope }, operation, budget, requests: [], live: true, sawNative: false };
    this.contexts.add(context);
    return context;
  }
  async observe<T>(scope: TransportScope, operation: TransportOperation, work: () => PromiseLike<T> | T): Promise<T> {
    let context: Context | null = null;
    try { context = this.prepare(scope, operation); } catch { if (!this.contexts.size) this.stop(); }
    if (!context) return work();
    try { return await this.storage.run(context, work); }
    finally {
      ignoreFailure(() => {
        for (const request of context.requests) this.finish(request, 'incomplete');
        if (!context.sawNative && this.current(context)) {
          const ordinal = this.reserve(context);
          if (ordinal !== null) this.emit(context, { operation, ordinal, connection: 'unknown', dispatchMs: null, headersWaitMs: null, bodyMs: null, connectMs: null, outcome: 'not_observed' });
        }
      });
      context.live = false; this.contexts.delete(context);
      if (!this.contexts.size) this.stop();
    }
  }
  private current(context: Context) {
    if (context.live && this.subscribed && this.admitted(context.scope)) return true;
    context.live = false; this.contexts.delete(context);
    if (!this.contexts.size) this.stop();
    return false;
  }
  private reserve(context: Context) {
    const count = context.budget.operations.get(context.operation) ?? 0;
    if (count >= this.cap.perOperation || context.budget.total >= this.cap.perDocument) return null;
    context.budget.operations.set(context.operation, count + 1); context.budget.total++;
    return count + 1;
  }
  private handle(event: Event, message: Message) {
    if (event === 'connected') {
      if (message.socket && typeof message.socket === 'object') this.sockets.set(message.socket, { generation: this.generation, uses: 0 });
      return;
    }
    if (event === 'create') {
      const context = this.storage.getStore();
      if (!context || !this.current(context) || !message.request || typeof message.request !== 'object') return;
      context.sawNative = true;
      const ordinal = this.reserve(context);
      if (ordinal === null) return;
      const request: RequestState = { context, ordinal, created: performance.now(), connection: 'unknown', finished: false };
      context.requests.push(request); this.requests.set(message.request, request);
      return;
    }
    const request = message.request ? this.requests.get(message.request) : undefined;
    if (event === 'send') {
      let socket = message.socket ? this.sockets.get(message.socket) : undefined;
      if (!socket && message.socket && typeof message.socket === 'object') {
        socket = { generation: 0, uses: 0 }; this.sockets.set(message.socket, socket);
      }
      if (request && this.current(request.context)) {
        request.send = performance.now();
        request.connection = socket && socket.uses > 0 ? 'reused' : socket?.generation === this.generation ? 'new' : 'unknown';
      }
      // Socket use carries no document/user data, including unrelated requests.
      if (socket) socket.uses++;
      return;
    }
    if (!request || request.finished || !this.current(request.context)) return;
    if (event === 'sent') request.sent = performance.now();
    if (event === 'headers' && (message.response?.statusCode ?? 0) >= 200) request.headers = performance.now();
    if (event === 'done') this.finish(request, 'response');
    if (event === 'error') this.finish(request, 'error');
  }
  private emit(context: Context, observation: TransportObservation) {
    if (this.current(context)) ignoreFailure(() => context.scope.emit(observation));
  }
  private finish(request: RequestState, outcome: TransportObservation['outcome']) {
    if (request.finished || !this.current(request.context)) return;
    request.finished = true;
    this.emit(request.context, {
      operation: request.context.operation, ordinal: request.ordinal, connection: request.connection,
      dispatchMs: elapsed(request.send, request.created), headersWaitMs: elapsed(request.headers, request.sent),
      bodyMs: elapsed(outcome === 'response' ? performance.now() : undefined, request.headers), connectMs: null, outcome,
    });
  }
}

let observer: DocumentTransportObserver | undefined;
export function observeDocumentTransport<T>(scope: TransportScope, operation: TransportOperation, work: () => PromiseLike<T> | T): Promise<T> {
  try { observer ??= new DocumentTransportObserver(); } catch { return Promise.resolve().then(work); }
  return observer.observe(scope, operation, work);
}
