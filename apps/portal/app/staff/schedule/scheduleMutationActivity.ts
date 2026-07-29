type ScheduleMutationActivityState = {
  tokens: Map<symbol, symbol>;
  listeners: Set<() => void>;
};

const activityByScope = new Map<string, ScheduleMutationActivityState>();

function stateForScope(scope: string): ScheduleMutationActivityState {
  const existing = activityByScope.get(scope);
  if (existing) return existing;
  const created: ScheduleMutationActivityState = {
    tokens: new Map(),
    listeners: new Set(),
  };
  activityByScope.set(scope, created);
  return created;
}

function notify(state: ScheduleMutationActivityState): void {
  for (const listener of state.listeners) listener();
}

export function beginScheduleMutationActivity(scope: string, owner: symbol): () => void {
  const state = stateForScope(scope);
  const token = Symbol(scope);
  let ended = false;
  state.tokens.set(token, owner);
  notify(state);

  return () => {
    if (ended) return;
    ended = true;
    state.tokens.delete(token);
    notify(state);
    if (!state.tokens.size && !state.listeners.size) activityByScope.delete(scope);
  };
}

export function getScheduleMutationActivityCount(scope: string): number {
  return activityByScope.get(scope)?.tokens.size ?? 0;
}

export function getForeignScheduleMutationActivityCount(scope: string, owner: symbol): number {
  const state = activityByScope.get(scope);
  if (!state) return 0;
  let count = 0;
  for (const tokenOwner of state.tokens.values()) {
    if (tokenOwner !== owner) count += 1;
  }
  return count;
}

export function subscribeScheduleMutationActivity(scope: string, listener: () => void): () => void {
  const state = stateForScope(scope);
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
    if (!state.tokens.size && !state.listeners.size) activityByScope.delete(scope);
  };
}
